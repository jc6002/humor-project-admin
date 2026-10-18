-- Week 4 additive migration. Run after the existing Week 3 schema.sql.
begin;
create table if not exists public.arena_models (
  id uuid primary key default gen_random_uuid(), provider text not null check(provider in ('openai','gemini')),
  api_model text not null, name text not null, config_version text not null default 'ai-roast-v2',
  rating double precision not null default 1000, wins integer not null default 0,
  losses integer not null default 0, ties integer not null default 0, bad integer not null default 0,
  canonical_id uuid references public.arena_models(id),
  unique(provider,api_model,config_version)
);
create unique index if not exists arena_models_identity
on public.arena_models(provider,api_model) where canonical_id is null;

create table if not exists public.arena_limits (
  id boolean primary key default true check(id), enabled boolean not null default false,
  daily_attempts integer not null default 20 check(daily_attempts between 0 and 10000),
  total_attempts integer not null default 100 check(total_attempts between 0 and 100000)
);
insert into public.arena_limits(id) values(true) on conflict do nothing;

create table if not exists public.arena_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.arena_battles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  request_id uuid not null, target text not null, angle text not null, context text not null default '',
  prompt text not null, status text not null default 'generating' check(status in ('generating','ready','closed','failed')),
  created_at timestamptz not null default now(), completed_at timestamptz,
  closes_at timestamptz, votes integer not null default 0 check(votes between 0 and 5),
  error_code text, unique(user_id,request_id)
);
create index if not exists arena_battles_user_time on public.arena_battles(user_id,created_at);

create table if not exists public.arena_generations (
  id uuid primary key default gen_random_uuid(), battle_id uuid not null references public.arena_battles(id),
  model_id uuid not null references public.arena_models(id), setup text not null, punchline text not null,
  config_version text, usage jsonb not null default '{}', latency_ms integer, request_id text,
  unique(battle_id,model_id)
);

create table if not exists public.arena_presentations (
  user_id uuid not null references auth.users(id), battle_id uuid not null references public.arena_battles(id),
  left_id uuid not null references public.arena_generations(id), right_id uuid not null references public.arena_generations(id),
  primary key(user_id,battle_id), check(left_id<>right_id)
);

create table if not exists public.arena_votes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  battle_id uuid not null references public.arena_battles(id),
  choice text not null check(choice in ('left','right','tie','bad')),
  left_id uuid not null references public.arena_generations(id), right_id uuid not null references public.arena_generations(id),
  created_at timestamptz not null default now(), unique(user_id,battle_id)
);

create table if not exists public.arena_rating_events (
  seq bigint generated always as identity primary key, vote_id uuid not null unique references public.arena_votes(id),
  left_model uuid not null references public.arena_models(id), right_model uuid not null references public.arena_models(id),
  left_before double precision not null, right_before double precision not null,
  left_after double precision not null, right_after double precision not null,
  rule_version text not null default 'elo-k16-v1'
);

-- No raw table access: model identity must not leak through REST, views or RSC props.
do $$ declare t text; begin
  foreach t in array array['arena_models','arena_limits','arena_accounts','arena_battles','arena_generations','arena_presentations','arena_votes','arena_rating_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

create or replace function public.arena_quota() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); used integer; attempts integer; busy boolean; recovery timestamptz; recovery_attempt timestamptz;
begin
  if u is null then raise exception 'Sign in to continue'; end if;
  select count(*) filter(where status in ('ready','closed') and completed_at>now()-interval '1 hour'),
    count(*) filter(where created_at>now()-interval '1 hour'),
    coalesce(bool_or(status='generating' and created_at>now()-interval '3 minutes'),false),
    min(completed_at+interval '1 hour') filter(where status in ('ready','closed') and completed_at>now()-interval '1 hour'),
    min(created_at+interval '1 hour') filter(where created_at>now()-interval '1 hour')
  into used,attempts,busy,recovery,recovery_attempt from public.arena_battles where user_id=u;
  return jsonb_build_object('remaining',greatest(0,5-used-case when busy then 1 else 0 end),'attemptsRemaining',greatest(0,8-attempts),
    'busy',busy,'nextRecovery',case when attempts>=8 then greatest(recovery,recovery_attempt) else recovery end);
end $$;

-- Trusted server only. Global row lock makes both account and site budgets atomic.
create or replace function public.arena_reserve(p_user uuid,p_request uuid,p_target text,p_angle text,p_context text,p_prompt text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare lim public.arena_limits; b public.arena_battles; n integer; latest timestamptz;
begin
  select * into lim from public.arena_limits where id=true for update;
  select * into b from public.arena_battles where user_id=p_user and request_id=p_request;
  if found then return jsonb_build_object('id',b.id,'existing',true,'status',b.status); end if;
  if not lim.enabled then raise exception 'Generation is paused. You can still vote on existing battles.'; end if;
  insert into public.arena_accounts(user_id) values(p_user) on conflict do nothing;
  perform 1 from public.arena_accounts where user_id=p_user for update;
  -- Providers time out well before this lease. Keep attempts counted after a crash.
  update public.arena_battles set status='failed',error_code='expired' where user_id=p_user and status='generating' and created_at<=now()-interval '3 minutes';
  if exists(select 1 from public.arena_battles where user_id=p_user and status='generating') then raise exception 'A generation is already running. Please wait.'; end if;
  select count(*) into n from public.arena_battles where user_id=p_user and status in ('ready','closed') and completed_at>now()-interval '1 hour';
  if n>=5 then raise exception 'Your 5 hourly generations are used. Vote on community battles while they recover.'; end if;
  select count(*),max(created_at) into n,latest from public.arena_battles where user_id=p_user and created_at>now()-interval '1 hour';
  if n>=8 then raise exception 'Hourly attempt limit reached. Please try again later.'; end if;
  if latest>now()-interval '3 seconds' then raise exception 'Please wait a moment between generations.'; end if;
  select count(*) into n from public.arena_battles;
  if n>=lim.total_attempts then raise exception 'The arena generation budget is used. Existing battles are still open for votes.'; end if;
  select count(*) into n from public.arena_battles where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  if n>=lim.daily_attempts then raise exception 'Today’s arena generation budget is used. You can still vote.'; end if;
  if length(p_context)>300 or length(p_prompt)>4000 then raise exception 'Prompt too long'; end if;
  insert into public.arena_battles(user_id,request_id,target,angle,context,prompt)
  values(p_user,p_request,p_target,p_angle,p_context,p_prompt) returning * into b;
  return jsonb_build_object('id',b.id,'existing',false,'status',b.status);
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

drop function if exists public.arena_battle(uuid,uuid);
drop function if exists public.arena_battle(uuid,uuid[]);
create or replace function public.arena_battle(p_id uuid default null,p_skip uuid[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); b public.arena_battles; p public.arena_presentations; v public.arena_votes; ev public.arena_rating_events; ids uuid[]; payload jsonb;
begin
  if u is null then raise exception 'Sign in to continue'; end if;
  if p_id is null then
    -- Prioritize battles that already have votes (votes desc) so existing battles quickly reach 3 votes and graduate!
    select * into b from public.arena_battles x where status='ready' and closes_at>now() and votes<3
      and (p_skip is null or not (x.id = any(p_skip)))
      and not exists(select 1 from public.arena_votes y where y.battle_id=x.id and y.user_id=u)
    order by votes desc, random() limit 1;
  else
    select * into b from public.arena_battles where id=p_id;
  end if;
  if b.id is null then return null; end if;
  select * into v from public.arena_votes where battle_id=b.id and user_id=u;
  if v.id is not null then
    select * into ev from public.arena_rating_events where vote_id=v.id;
  end if;
  if b.status in ('generating','failed') then
    if b.user_id<>u then return null; end if;
    return jsonb_build_object('id',b.id,'status',case when b.status='generating' and b.created_at<=now()-interval '3 minutes' then 'failed' else b.status end);
  end if;
  if v.id is null and (b.status='closed' or b.closes_at<=now() or b.votes>=3) then return jsonb_build_object('id',b.id,'status','closed'); end if;
  select * into p from public.arena_presentations where user_id=u and battle_id=b.id;
  if not found then
    select array_agg(id order by random()) into ids from public.arena_generations where battle_id=b.id;
    if array_length(ids,1)<>2 then return null; end if;
    insert into public.arena_presentations(user_id,battle_id,left_id,right_id) values(u,b.id,ids[1],ids[2]) on conflict do nothing;
    select * into p from public.arena_presentations where user_id=u and battle_id=b.id;
  end if;
  select jsonb_object_agg(case when g.id=p.left_id then 'left' else 'right' end,
    jsonb_build_object('setup',g.setup,'punchline',g.punchline)||
    case when v.id is not null then jsonb_build_object(
      'model',m.name,
      'version',m.api_model,
      'rating',m.rating,
      'delta',case when ev.vote_id is not null then (case when g.id=p.left_id then ev.left_after-ev.left_before else ev.right_after-ev.right_before end) else null end
    ) else '{}'::jsonb end)
  into payload from public.arena_generations g join public.arena_models m on m.id=g.model_id where g.id in (p.left_id,p.right_id);
  return jsonb_build_object('id',b.id,'status','ready','target',b.target,'angle',b.angle,'context',b.context,'choice',v.choice,
    'votes',b.votes,'prompt',case when v.id is not null then b.prompt else null end)||payload;
end $$;

create or replace function public.arena_vote(p_battle uuid,p_choice text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); b public.arena_battles; p public.arena_presentations; v public.arena_votes;
  lm uuid; rm uuid; lr double precision; rr double precision; score double precision; delta double precision;
begin
  if u is null then raise exception 'Sign in to vote'; end if;
  if p_choice not in ('left','right','tie','bad') then raise exception 'Invalid vote'; end if;
  select * into b from public.arena_battles where id=p_battle for update;
  if not found then raise exception 'Battle not found'; end if;
  if exists(select 1 from public.arena_votes where battle_id=p_battle and user_id=u) then return public.arena_battle(p_battle); end if;
  if b.status<>'ready' or b.votes>=3 or b.closes_at<=now() then raise exception 'This battle has closed. Try another one.'; end if;
  select * into p from public.arena_presentations where battle_id=p_battle and user_id=u;
  if not found then raise exception 'Open this battle before voting'; end if;
  select model_id into lm from public.arena_generations where id=p.left_id;
  select model_id into rm from public.arena_generations where id=p.right_id;
  perform id from public.arena_models where id in(lm,rm) order by id for update;
  select rating into lr from public.arena_models where id=lm;
  select rating into rr from public.arena_models where id=rm;
  score:=case p_choice when 'left' then 1 when 'right' then 0 else 0.5 end;
  delta:=16*(score-1/(1+power(10,(rr-lr)/400)));
  insert into public.arena_votes(user_id,battle_id,choice,left_id,right_id) values(u,p_battle,p_choice,p.left_id,p.right_id) returning * into v;
  update public.arena_models set rating=lr+delta,wins=wins+case when score=1 then 1 else 0 end,
    losses=losses+case when score=0 then 1 else 0 end,ties=ties+case when score=0.5 then 1 else 0 end,bad=bad+case when p_choice='bad' then 1 else 0 end where id=lm;
  update public.arena_models set rating=rr-delta,wins=wins+case when score=0 then 1 else 0 end,
    losses=losses+case when score=1 then 1 else 0 end,ties=ties+case when score=0.5 then 1 else 0 end,bad=bad+case when p_choice='bad' then 1 else 0 end where id=rm;
  insert into public.arena_rating_events(vote_id,left_model,right_model,left_before,right_before,left_after,right_after) values(v.id,lm,rm,lr,rr,lr+delta,rr-delta);
  update public.arena_battles set votes=votes+1,status=case when votes+1>=3 then 'closed' else 'ready' end where id=p_battle;
  return public.arena_battle(p_battle);
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
   having count(*) filter(where v.choice in ('left','right'))>=2 and
     count(*) filter(where (v.choice='left' and v.left_id=g.id) or (v.choice='right' and v.right_id=g.id))>count(*) filter(where v.choice in ('left','right'))/2.0
   order by score desc,decisive desc,b.completed_at desc limit 12) r),'[]'::jsonb),
 'stats',jsonb_build_object('battles',(select count(*) from public.arena_battles where status in ('ready','closed')),
 'votes',(select count(*) from public.arena_votes),'open',(select count(*) from public.arena_battles where status='ready' and closes_at>now() and votes<3)))
$$;

create or replace function public.arena_request(p_request uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;
  select id into b from public.arena_battles where user_id=auth.uid() and request_id=p_request;
  if b is null then return null; end if;
  return public.arena_battle(b);
end $$;

create or replace function public.arena_history() returns jsonb
language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) from (
  select b.id,b.target,b.angle,case when b.status='generating' and b.created_at<=now()-interval '3 minutes' then 'failed'
    when b.status='ready' and b.closes_at<=now() then 'closed' else b.status end as status,b.created_at,
    exists(select 1 from public.arena_votes v where v.battle_id=b.id and v.user_id=auth.uid()) as voted
  from public.arena_battles b where b.user_id=auth.uid() order by b.created_at desc limit 100) r
$$;

revoke all on function public.arena_reserve(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.arena_finish(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.arena_reserve(uuid,uuid,text,text,text,text),public.arena_finish(uuid,jsonb,text) to service_role;
revoke all on function public.arena_quota(),public.arena_battle(uuid,uuid[]),public.arena_vote(uuid,text),public.arena_history(),public.arena_request(uuid) from public,anon;
grant execute on function public.arena_quota(),public.arena_battle(uuid,uuid[]),public.arena_vote(uuid,text),public.arena_history(),public.arena_request(uuid) to authenticated;
revoke all on function public.arena_public() from public;
grant execute on function public.arena_public() to anon,authenticated;
commit;
