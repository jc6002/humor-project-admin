-- Run after arena.sql on existing installations. Safe to rerun.
begin;
-- Match the write order used by voting and generation; prevent concurrent writes.
lock table public.arena_battles, public.arena_models, public.arena_generations,
  public.arena_votes, public.arena_rating_events in access exclusive mode;
alter table public.arena_models add column if not exists canonical_id uuid references public.arena_models(id);
alter table public.arena_generations add column if not exists config_version text;
update public.arena_generations g set config_version=m.config_version
from public.arena_models m where g.model_id=m.id and g.config_version is null;

-- Keep the original model records for audit, but route every generation to one participant.
with identities as (
  select id, first_value(id) over(partition by provider,api_model order by id) as canonical
  from public.arena_models where canonical_id is null
)
update public.arena_models m set canonical_id=i.canonical
from identities i where m.id=i.id and i.id<>i.canonical;
update public.arena_generations g set model_id=m.canonical_id
from public.arena_models m where g.model_id=m.id and m.canonical_id is not null;
update public.arena_rating_events e set left_model=m.canonical_id
from public.arena_models m where e.left_model=m.id and m.canonical_id is not null;
update public.arena_rating_events e set right_model=m.canonical_id
from public.arena_models m where e.right_model=m.id and m.canonical_id is not null;
create unique index if not exists arena_models_identity
on public.arena_models(provider,api_model) where canonical_id is null;

-- Elo is order-dependent: replay the recorded vote sequence, never average ratings.
update public.arena_models set rating=1000,wins=0,losses=0,ties=0,bad=0 where canonical_id is null;
do $$
declare e record; lr double precision; rr double precision; score double precision; delta double precision;
begin
  for e in select r.*,v.choice from public.arena_rating_events r
    join public.arena_votes v on v.id=r.vote_id order by r.seq loop
    if e.rule_version<>'elo-k16-v1' then raise exception 'Unknown Elo rule'; end if;
    select rating into lr from public.arena_models where id=e.left_model;
    select rating into rr from public.arena_models where id=e.right_model;
    score:=case e.choice when 'left' then 1 when 'right' then 0 else 0.5 end;
    delta:=16*(score-1/(1+power(10,(rr-lr)/400)));
    update public.arena_models set rating=lr+delta,wins=wins+(score=1)::int,
      losses=losses+(score=0)::int,ties=ties+(score=0.5)::int,bad=bad+(e.choice='bad')::int where id=e.left_model;
    update public.arena_models set rating=rr-delta,wins=wins+(score=0)::int,
      losses=losses+(score=1)::int,ties=ties+(score=0.5)::int,bad=bad+(e.choice='bad')::int where id=e.right_model;
    update public.arena_rating_events set left_before=lr,right_before=rr,left_after=lr+delta,right_after=rr-delta where seq=e.seq;
  end loop;
end $$;

create or replace function public.arena_finish(p_battle uuid,p_outputs jsonb,p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.arena_battles; o jsonb; mid uuid;
begin
  select * into b from public.arena_battles where id=p_battle for update;
  if not found or b.status<>'generating' then return; end if;
  if b.created_at<=now()-interval '3 minutes' or p_error is not null then
    update public.arena_battles set status='failed',error_code=coalesce(p_error,'expired') where id=p_battle; return;
  end if;
  if jsonb_array_length(p_outputs)<>2 then raise exception 'Two outputs required'; end if;
  if (p_outputs->0->>'provider')=(p_outputs->1->>'provider') then raise exception 'Different providers required'; end if;
  for o in select value from jsonb_array_elements(p_outputs) loop
    if length(o->>'setup') not between 1 and 800 or length(o->>'punchline') not between 1 and 800 then raise exception 'Invalid joke'; end if;
    insert into public.arena_models(provider,api_model,name,config_version)
    values(o->>'provider',o->>'model',o->>'name',o->>'configVersion')
    on conflict(provider,api_model) where canonical_id is null do update set name=excluded.name returning id into mid;
    insert into public.arena_generations(battle_id,model_id,config_version,setup,punchline,usage,latency_ms,request_id)
    values(p_battle,mid,o->>'configVersion',o->>'setup',o->>'punchline',coalesce(o->'usage','{}'),(o->>'latencyMs')::integer,o->>'requestId');
  end loop;
  update public.arena_battles set status='ready',completed_at=now(),closes_at=now()+interval '24 hours' where id=p_battle;
end $$;

create or replace function public.arena_public() returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
 'models',coalesce((select jsonb_agg(to_jsonb(r) order by r.rating desc) from (
   select m.id,m.name,m.api_model as version,m.rating,m.wins,m.losses,m.ties,m.bad,
   (select count(*) from public.arena_generations g where g.model_id=m.id) as battles
   from public.arena_models m where m.canonical_id is null) r),'[]'::jsonb),
 'topJokes',coalesce((select jsonb_agg(to_jsonb(r)) from (
   select g.id,g.setup,g.punchline,m.name as model,m.api_model as version,b.target,
     count(*) filter(where (v.choice='left' and v.left_id=g.id) or (v.choice='right' and v.right_id=g.id)) as wins,
     count(*) filter(where v.choice in ('left','right')) as decisive,
     (count(*) filter(where (v.choice='left' and v.left_id=g.id) or (v.choice='right' and v.right_id=g.id))+1.0)/(count(*) filter(where v.choice in ('left','right'))+2) as score
   from public.arena_generations g join public.arena_models m on m.id=g.model_id
   join public.arena_battles b on b.id=g.battle_id join public.arena_votes v on v.battle_id=b.id
   where (b.status='closed' or (b.status='ready' and b.closes_at<=now()))
   group by g.id,m.id,b.id
   having count(*) filter(where v.choice in ('left','right'))>=3 and
     count(*) filter(where (v.choice='left' and v.left_id=g.id) or (v.choice='right' and v.right_id=g.id))>count(*) filter(where v.choice in ('left','right'))/2.0
   order by score desc,decisive desc,b.completed_at desc limit 12) r),'[]'::jsonb),
 'stats',jsonb_build_object('battles',(select count(*) from public.arena_battles where status in ('ready','closed')),
 'votes',(select count(*) from public.arena_votes),'open',(select count(*) from public.arena_battles where status='ready' and closes_at>now() and votes<5)))
$$;

commit;
