-- ============================================================================
-- Week 6 Additive Migration: Superadmin RBAC + Multi-Dimensional Analytics + History Bug Fix
-- Run in Supabase SQL Editor (100% backwards-compatible with Week 5 snapshot)
-- ============================================================================
begin;

-- 1. Add email and is_superadmin to public.profiles
alter table public.profiles
  add column if not exists email text,
  add column if not exists is_superadmin boolean not null default false;

-- Backfill email from auth.users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email <> u.email);

-- Keep email synced on new user sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Prevent regular users from escalating is_superadmin via client-side UPDATE
create or replace function public.prevent_superadmin_escalation()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.is_superadmin is distinct from old.is_superadmin then
    if current_setting('request.jwt.claim.role', true) = 'authenticated' then
      if not exists (
        select 1 from public.profiles
        where id = auth.uid() and is_superadmin = true
      ) then
        raise exception 'Only superadmins can modify is_superadmin';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_superadmin_escalation on public.profiles;
create trigger check_superadmin_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_superadmin_escalation();

-- 2. Bootstrap Superadmin (out-of-band via Supabase SQL Editor):
-- Promotes the earliest user in auth.users by default, plus any matching email.
update public.profiles
set is_superadmin = true
where id in (
  select id from auth.users
  order by created_at asc
  limit 1
);

-- 3. Upgrade arena_public() with Multi-Dimensional Category Analytics & Top-Voted Showcase
create or replace function public.arena_public() returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
 'models', coalesce((select jsonb_agg(to_jsonb(r) order by r.rating desc) from (
   select m.id, m.name, m.api_model as version, m.rating, m.wins, m.losses, m.ties, m.bad,
     (select count(*) from public.arena_generations g where g.model_id = m.id) as battles,
     (select round(avg(g.latency_ms)) from public.arena_generations g where g.model_id = m.id and g.latency_ms is not null) as avg_latency_ms
   from public.arena_models m
   where m.canonical_id is null) r), '[]'::jsonb),
 'topJokes', coalesce((select jsonb_agg(to_jsonb(r)) from (
   select g.id, g.setup, g.punchline, m.name as model, m.api_model as version,
     b.target, b.angle, b.context,
     count(*) filter(where (v.choice='left' and v.left_id=g.id) or (v.choice='right' and v.right_id=g.id)) as wins,
     count(*) filter(where v.choice in ('left','right')) as decisive,
     (count(*) filter(where (v.choice='left' and v.left_id=g.id) or (v.choice='right' and v.right_id=g.id))+1.0)/(count(*) filter(where v.choice in ('left','right'))+2) as score
   from public.arena_generations g
   join public.arena_models m on m.id = g.model_id
   join public.arena_battles b on b.id = g.battle_id
   join public.arena_votes v on v.battle_id = b.id
   where (b.status = 'closed' or b.votes >= 1)
   group by g.id, m.id, b.id
   having count(*) filter(where (v.choice='left' and v.left_id=g.id) or (v.choice='right' and v.right_id=g.id)) >= 1
     and count(*) filter(where (v.choice='left' and v.left_id=g.id) or (v.choice='right' and v.right_id=g.id)) > count(*) filter(where v.choice in ('left','right')) / 2.0
   order by wins desc, score desc, decisive desc, b.completed_at desc limit 12) r), '[]'::jsonb),
 'categoryStats', coalesce((select jsonb_agg(to_jsonb(c) order by c.total_votes desc) from (
   select
     b.angle,
     count(v.id) as total_votes,
     count(v.id) filter(where (v.choice='left' and ml.name='GPT') or (v.choice='right' and mr.name='GPT')) as gpt_wins,
     count(v.id) filter(where (v.choice='left' and ml.name='Gemini') or (v.choice='right' and mr.name='Gemini')) as gemini_wins,
     count(v.id) filter(where v.choice='tie') as ties,
     count(v.id) filter(where v.choice='bad') as groans
   from public.arena_votes v
   join public.arena_battles b on b.id = v.battle_id
   join public.arena_generations gl on gl.id = v.left_id
   join public.arena_models ml on ml.id = gl.model_id
   join public.arena_generations gr on gr.id = v.right_id
   join public.arena_models mr on mr.id = gr.model_id
   group by b.angle
   order by total_votes desc limit 10
 ) c), '[]'::jsonb),
 'stats', jsonb_build_object(
   'battles', (select count(*) from public.arena_battles where status in ('ready','closed')),
   'votes', (select count(*) from public.arena_votes),
   'open', (select count(*) from public.arena_battles where status='ready' and closes_at>now() and votes<3),
   'customBattles', (select count(*) from public.arena_battles where target='Custom Topic' and status in ('ready','closed'))
 ));
$$;

-- 4. Fix arena_history() so pre-generated / community battles voted on or viewed by the user appear in /my-battles
create or replace function public.arena_history() returns jsonb
language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.activity_at desc), '[]'::jsonb) from (
  select
    b.id,
    b.target,
    b.angle,
    b.context,
    case
      when b.status = 'generating' and b.created_at <= now() - interval '3 minutes' then 'failed'
      when b.status = 'ready' and b.closes_at <= now() then 'closed'
      else b.status
    end as status,
    b.created_at,
    coalesce(v.created_at, b.created_at) as activity_at,
    (v.id is not null) as voted,
    v.choice,
    case when b.user_id = auth.uid() then 'mine' else 'community' end as source,
    gl.setup as left_setup,
    gl.punchline as left_punchline,
    case when v.id is not null then ml.name else null end as left_model,
    gr.setup as right_setup,
    gr.punchline as right_punchline,
    case when v.id is not null then mr.name else null end as right_model
  from public.arena_battles b
  left join public.arena_presentations p on p.battle_id = b.id and p.user_id = auth.uid()
  left join public.arena_votes v on v.battle_id = b.id and v.user_id = auth.uid()
  left join public.arena_generations gl on gl.id = coalesce(v.left_id, p.left_id)
  left join public.arena_models ml on ml.id = gl.model_id
  left join public.arena_generations gr on gr.id = coalesce(v.right_id, p.right_id)
  left join public.arena_models mr on mr.id = gr.model_id
  where b.user_id = auth.uid() or v.user_id = auth.uid() or p.user_id = auth.uid()
  order by coalesce(v.created_at, b.created_at) desc
  limit 100
 ) r
$$;

commit;
