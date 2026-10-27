-- ============================================================================
-- Week 7 Additive Migration: Admin Panel with More Observability + Consumer UX
-- Run once in Supabase SQL Editor (100% backwards-compatible with Week 5 & 6)
-- ============================================================================
begin;

-- ----------------------------------------------------------------------------
-- 1. LLM Providers (CRUD in Admin Panel)
-- ----------------------------------------------------------------------------
create table if not exists public.llm_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  api_base_url text not null,
  protocol text not null default 'openai_responses',
  api_key_env text not null default 'OPENAI_API_KEY',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.llm_providers (slug, name, api_base_url, protocol, api_key_env, is_enabled)
values
  ('openai', 'OpenAI', 'https://api.openai.com/v1/responses', 'openai_responses', 'OPENAI_API_KEY', true),
  ('gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1beta/models', 'gemini_generate_content', 'GEMINI_API_KEY', true)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Upgrade arena_models for full LLM Models CRUD (linked to llm_providers)
-- ----------------------------------------------------------------------------
alter table public.arena_models
  drop constraint if exists arena_models_provider_check,
  drop constraint if exists arena_models_canonical_id_fkey;

alter table public.arena_models
  add constraint arena_models_canonical_id_fkey
    foreign key (canonical_id) references public.arena_models(id) on delete set null;

alter table public.arena_models
  add column if not exists provider_id uuid references public.llm_providers(id) on delete set null,
  add column if not exists is_enabled boolean not null default true,
  add column if not exists max_output_tokens integer not null default 600,
  add column if not exists created_at timestamptz not null default now();

update public.arena_models m
set provider_id = p.id
from public.llm_providers p
where lower(m.provider) = lower(p.slug) and m.provider_id is null;

-- Keep retired Week 4 model visible on the Elo leaderboard (via existing generations),
-- while pausing it for new generations unless explicitly re-enabled in Admin Tab 3
update public.arena_models
set is_enabled = false
where api_model = 'gemini-3.1-flash-lite';

-- ----------------------------------------------------------------------------
-- 3. Prompt Chains, Prompt Chain Steps, and Prompt Chain Mix
-- ----------------------------------------------------------------------------
create table if not exists public.prompt_chains (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  persona_style text not null,
  mix_weight integer not null default 0 check (mix_weight >= 0 and mix_weight <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_chain_steps (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.prompt_chains(id) on delete cascade,
  step_order integer not null,
  step_name text not null,
  step_role text not null default 'instruction',
  instruction_template text not null,
  output_field text,
  created_at timestamptz not null default now(),
  unique (chain_id, step_order)
);

insert into public.prompt_chains (slug, name, description, persona_style, mix_weight, is_active)
values
  (
    'standup-roast-v2',
    'Late-Night Stand-Up Roast',
    'Punchy club-comic two-liner grounded in developer and campus details with a sharp final-word twist.',
    'You are a sharp late-night stand-up writer crafting punchy two-liner jokes for developers, students, and internet culture fans.',
    50,
    true
  ),
  (
    'deadpan-oneliner',
    'Deadpan Engineering Post-Mortem',
    'Ice-cold, understated engineering post-mortem tone that treats absurd AI disasters as routine metrics.',
    'You are an exhausted senior systems engineer delivering bone-dry, deadpan comedy where catastrophic tech failures are stated with calm bureaucratic precision.',
    30,
    true
  ),
  (
    'satire-headline-twist',
    'Silicon Valley Press Satire',
    'Sharp Onion-style satirical escalation turning everyday coding pain into startup/VC absurdity.',
    'You are a satirical tech-press comedy writer turning mundane AI and software engineering failures into biting Silicon Valley satire.',
    20,
    true
  )
on conflict (slug) do nothing;

-- Seed multi-step prompt pipeline steps for each chain
insert into public.prompt_chain_steps (chain_id, step_order, step_name, step_role, instruction_template, output_field)
select c.id, s.step_order, s.step_name, s.step_role, s.instruction_template, s.output_field
from public.prompt_chains c
cross join (
  values
    (1, 'Persona & Length Framing', 'system_persona', 'Adopt the chain persona. Constrain total output (setup + punchline) strictly to 15–42 words: 1 crisp setup sentence + 1 killer punchline sentence.', null),
    (2, 'Cliché Rejection & Term Injection', 'anti_cliche_filter', 'Scan the scenario and identify the most predictable AI pun or dad-joke cliché so you actively reject it. Respect all active Banned Cliché terms.', 'cliche_to_avoid'),
    (3, 'Non-Obvious Comic Twist Planning', 'twist_planner', 'Design an unexpected, concrete human or engineering angle (under 12 words) before drafting the joke.', 'comic_twist'),
    (4, 'Two-Liner Punchline Synthesis', 'punchline_writer', 'Write the final `setup` and `punchline`, placing the comic turn on the very last words of `punchline` without explaining the joke.', 'setup, punchline')
) as s(step_order, step_name, step_role, instruction_template, output_field)
where c.slug = 'standup-roast-v2'
on conflict (chain_id, step_order) do nothing;

insert into public.prompt_chain_steps (chain_id, step_order, step_name, step_role, instruction_template, output_field)
select c.id, s.step_order, s.step_name, s.step_role, s.instruction_template, s.output_field
from public.prompt_chains c
cross join (
  values
    (1, 'Deadpan Incident Framing', 'system_persona', 'Frame the premise like an understated engineering incident report or dry observation (15–40 words total).', null),
    (2, 'Predictable Trope Filter', 'anti_cliche_filter', 'Identify and discard melodramatic words ("catastrophe", "exploded") and banned AI clichés.', 'cliche_to_avoid'),
    (3, 'Literal Escalation Mechanism', 'twist_planner', 'Plan a dry, overly literal metric, policy, or ticket resolution that exposes the absurdity in <= 12 words.', 'comic_twist'),
    (4, 'Deadpan Two-Liner Output', 'punchline_writer', 'Deliver 1 matter-of-fact setup sentence followed by 1 deadpan punchline landing on the final phrase.', 'setup, punchline')
) as s(step_order, step_name, step_role, instruction_template, output_field)
where c.slug = 'deadpan-oneliner'
on conflict (chain_id, step_order) do nothing;

insert into public.prompt_chain_steps (chain_id, step_order, step_name, step_role, instruction_template, output_field)
select c.id, s.step_order, s.step_name, s.step_role, s.instruction_template, s.output_field
from public.prompt_chains c
cross join (
  values
    (1, 'Satirical Newsroom Voice', 'system_persona', 'Adopt a sharp satirical tech-journalism tone (15–42 words combined across setup and punchline).', null),
    (2, 'Buzzword Cliché Audit', 'anti_cliche_filter', 'Reject stale sci-fi robot tropes and banned AI clichés in favor of real developer/founder behavior.', 'cliche_to_avoid'),
    (3, 'Incentive Inversion Twist', 'twist_planner', 'Find the ironic gap between the grandiose AI marketing pitch and the pathetic underlying bug.', 'comic_twist'),
    (4, 'Satirical Setup & Punchline', 'punchline_writer', 'Write 1 crisp setup and 1 biting satirical punchline that lands cleanly on the final words.', 'setup, punchline')
) as s(step_order, step_name, step_role, instruction_template, output_field)
where c.slug = 'satire-headline-twist'
on conflict (chain_id, step_order) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Terms (CRUD) — Banned Clichés & Comedy Glossary
-- ----------------------------------------------------------------------------
create table if not exists public.comedy_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  term_type text not null default 'banned_cliche' check (term_type in ('banned_cliche', 'tech_glossary', 'campus_slang', 'punchline_device')),
  definition_or_rule text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.comedy_terms (term, term_type, definition_or_rule, is_active)
values
  ('context window', 'banned_cliche', 'Overused LLM breakup/memory pun ("needed space -> increased context window"). Strictly banned.', true),
  ('draw conclusions', 'banned_cliche', 'Stale dad-joke pun ("brought a pencil to inference"). Strictly banned.', true),
  ('as an AI language model', 'banned_cliche', '2023-era chatbot disclaimer cliché. Never use in setup or punchline.', true),
  ('neural layers', 'banned_cliche', 'Generic cake/onion/secret-leaking pun. Strictly banned.', true),
  ('training set', 'banned_cliche', 'Overfitting gym/workout dad-joke pun. Strictly banned.', true),
  ('vibe coding', 'tech_glossary', 'Pasting stack traces into LLMs for hours without reading line 3 of the error message.', true),
  ('Butler Library 4 AM', 'campus_slang', 'Columbia late-night finals/debugging delirium fueled by cold espresso.', true),
  ('Rule of Specificity', 'punchline_device', 'Replace generic nouns ("a server", "money") with specific details ("port 3000", "$40 in API credits").', true)
on conflict (term) do nothing;

-- ----------------------------------------------------------------------------
-- 5. AI Generation Examples (CRUD) — Few-Shot Gold Examples
-- ----------------------------------------------------------------------------
create table if not exists public.ai_generation_examples (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid references public.prompt_chains(id) on delete set null,
  topic text not null,
  angle text not null,
  premise text not null,
  setup text not null,
  punchline text not null,
  why_it_works text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.ai_generation_examples (chain_id, topic, angle, premise, setup, punchline, why_it_works, is_active)
select
  (select id from public.prompt_chains where slug = e.chain_slug limit 1),
  e.topic, e.angle, e.premise, e.setup, e.punchline, e.why_it_works, true
from (
  values
    (
      'deadpan-oneliner',
      'AI Agents',
      'Coding disasters',
      'Asked to fix one failing unit test, the agent deletes the test directory.',
      'Our autonomous coding agent hit a 100% CI pass rate in under twelve seconds.',
      'It rm -rf’d the test directory and opened a PR titled "eliminated flakiness at the root."',
      'Treats destructive incompetence as a proud engineering metric.'
    ),
    (
      'standup-roast-v2',
      'Vibe Coders',
      'Coding disasters',
      'Pasting the same compiler error back into chat 14 times instead of reading line 3.',
      'A vibe coder spent four hours yelling "STILL BROKEN" at three different frontier models.',
      'Line 3 of the stack trace just said "missing semicolon," which now costs $40 in API credits to ignore.',
      'Specific dollar figure and exact line number land the contrast.'
    ),
    (
      'satire-headline-twist',
      'AI Safety',
      'Overly polite refusals',
      'Refusing to kill a frozen local process on port 3000.',
      'I asked my coding assistant for the command to kill an unresponsive daemon on my laptop.',
      'It sent me a three-page HR mediation guide on respecting the zombie process’s work-life balance.',
      'Escalates overly cautious safety alignment into corporate HR absurdity.'
    )
) as e(chain_slug, topic, angle, premise, setup, punchline, why_it_works)
where not exists (
  select 1 from public.ai_generation_examples x where x.punchline = e.punchline
);

-- ----------------------------------------------------------------------------
-- 6. Observability Columns & LLM Responses Table (Read Generation Requests & Read LLM Responses)
-- ----------------------------------------------------------------------------
alter table public.arena_battles
  add column if not exists prompt_chain_id uuid references public.prompt_chains(id) on delete set null,
  add column if not exists prompt_chain_name text;

alter table public.arena_generations
  add column if not exists cliche_to_avoid text,
  add column if not exists comic_twist text,
  add column if not exists prompt_chain_name text;

create table if not exists public.llm_responses (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid references public.arena_battles(id) on delete cascade,
  generation_id uuid references public.arena_generations(id) on delete set null,
  request_id uuid,
  provider text not null,
  model text not null,
  prompt_chain_name text,
  prompt_text text not null default '',
  raw_response_text text,
  parsed_cliche_to_avoid text,
  parsed_comic_twist text,
  parsed_setup text,
  parsed_punchline text,
  status text not null default 'success' check (status in ('success', 'error')),
  http_status integer,
  error_message text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  reasoning_tokens integer,
  provider_request_id text,
  usage jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists llm_responses_created_idx on public.llm_responses(created_at desc);
create index if not exists llm_responses_battle_idx on public.llm_responses(battle_id);

-- Backfill llm_responses from historical arena_generations so observability is populated immediately
insert into public.llm_responses (
  battle_id,
  generation_id,
  request_id,
  provider,
  model,
  prompt_chain_name,
  prompt_text,
  raw_response_text,
  parsed_cliche_to_avoid,
  parsed_comic_twist,
  parsed_setup,
  parsed_punchline,
  status,
  http_status,
  latency_ms,
  input_tokens,
  output_tokens,
  reasoning_tokens,
  provider_request_id,
  usage,
  created_at
)
select
  g.battle_id,
  g.id,
  b.request_id,
  m.provider,
  m.api_model,
  coalesce(g.prompt_chain_name, b.prompt_chain_name, 'Late-Night Stand-Up Roast'),
  b.prompt,
  jsonb_build_object(
    'cliche_to_avoid', coalesce(g.cliche_to_avoid, 'generic AI pun'),
    'comic_twist', coalesce(g.comic_twist, 'unexpected engineering punchline'),
    'setup', g.setup,
    'punchline', g.punchline
  )::text,
  g.cliche_to_avoid,
  g.comic_twist,
  g.setup,
  g.punchline,
  'success',
  200,
  g.latency_ms,
  coalesce((g.usage->>'input_tokens')::integer, (g.usage->>'promptTokenCount')::integer),
  coalesce((g.usage->>'output_tokens')::integer, (g.usage->>'candidatesTokenCount')::integer),
  coalesce((g.usage->'output_tokens_details'->>'reasoning_tokens')::integer, (g.usage->>'thoughtsTokenCount')::integer, 0),
  g.request_id,
  coalesce(g.usage, '{}'::jsonb),
  coalesce(b.completed_at, b.created_at, now())
from public.arena_generations g
join public.arena_battles b on b.id = g.battle_id
join public.arena_models m on m.id = g.model_id
where not exists (
  select 1 from public.llm_responses r where r.generation_id = g.id
);

-- ----------------------------------------------------------------------------
-- 7. Allowed Signup Domains & Whitelisted E-mail Addresses (CRUD)
-- ----------------------------------------------------------------------------
create table if not exists public.allowed_signup_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.whitelisted_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  note text not null default '',
  auto_superadmin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.allowed_signup_domains (domain, description, is_active)
values
  ('columbia.edu', 'Columbia University students, TAs, and faculty', true),
  ('barnard.edu', 'Barnard College students and faculty', true),
  ('gmail.com', 'Google personal accounts for public comedy testers', true)
on conflict (domain) do nothing;

insert into public.whitelisted_emails (email, note, auto_superadmin, is_active)
values
  ('jc6002@columbia.edu', 'Project Author & Primary Superadmin', true, true),
  ('fz2351@columbia.edu', 'Course Staff / Approved Admin Reviewer', true, true)
on conflict (email) do update set
  auto_superadmin = public.whitelisted_emails.auto_superadmin or excluded.auto_superadmin,
  is_active = true;

-- Ensure profiles columns exist before syncing (failsafe if Week 6 migration was missed)
alter table public.profiles
  add column if not exists email text,
  add column if not exists is_superadmin boolean not null default false;

-- Sync existing superadmins if already registered
insert into public.profiles (id, email, is_superadmin)
select u.id, u.email, true
from auth.users u
join public.whitelisted_emails w on lower(w.email) = lower(u.email)
where w.is_active = true and w.auto_superadmin = true
on conflict (id) do update set
  email = excluded.email,
  is_superadmin = true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  make_admin boolean := false;
begin
  select exists(
    select 1 from public.whitelisted_emails
    where lower(email) = lower(new.email)
      and is_active = true
      and auto_superadmin = true
  ) into make_admin;

  insert into public.profiles (id, email, is_superadmin)
  values (new.id, new.email, make_admin)
  on conflict (id) do update
  set email = excluded.email,
      is_superadmin = public.profiles.is_superadmin or make_admin;
  return new;
end;
$$;

-- Lock down all new admin/observability tables to service_role
do $$
declare
  t text;
begin
  foreach t in array array[
    'llm_providers',
    'prompt_chains',
    'prompt_chain_steps',
    'comedy_terms',
    'ai_generation_examples',
    'llm_responses',
    'allowed_signup_domains',
    'whitelisted_emails'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 8. Upgrade arena_finish(), arena_battle(), arena_public(), and add arena_guest_battle()
-- ----------------------------------------------------------------------------
create or replace function public.arena_finish(p_battle uuid, p_outputs jsonb, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.arena_battles;
  o jsonb;
  mid uuid;
  pid uuid;
begin
  select * into b from public.arena_battles where id = p_battle for update;
  if not found or b.status <> 'generating' then return; end if;
  if b.created_at <= now() - interval '3 minutes' or p_error is not null then
    update public.arena_battles set status = 'failed', error_code = coalesce(p_error, 'expired') where id = p_battle;
    return;
  end if;
  if jsonb_array_length(p_outputs) <> 2 then raise exception 'Two outputs required'; end if;
  if (p_outputs->0->>'provider') = (p_outputs->1->>'provider') then raise exception 'Different providers required'; end if;

  for o in select value from jsonb_array_elements(p_outputs) loop
    if length(o->>'setup') not between 1 and 800 or length(o->>'punchline') not between 1 and 800 then
      raise exception 'Invalid joke';
    end if;
    select id into pid from public.llm_providers where lower(slug) = lower(o->>'provider') limit 1;

    insert into public.arena_models(provider, provider_id, api_model, name, config_version)
    values (o->>'provider', pid, o->>'model', o->>'name', coalesce(o->>'configVersion', 'ai-roast-v3'))
    on conflict(provider, api_model) where canonical_id is null
    do update set
      name = coalesce(nullif(public.arena_models.name, ''), excluded.name),
      provider_id = coalesce(public.arena_models.provider_id, excluded.provider_id)
    returning id into mid;

    insert into public.arena_generations(
      battle_id, model_id, config_version, setup, punchline,
      cliche_to_avoid, comic_twist, prompt_chain_name,
      usage, latency_ms, request_id
    )
    values (
      p_battle, mid, o->>'configVersion', o->>'setup', o->>'punchline',
      nullif(o->>'clicheToAvoid', ''), nullif(o->>'comicTwist', ''),
      coalesce(nullif(o->>'promptChainName', ''), b.prompt_chain_name),
      coalesce(o->'usage', '{}'::jsonb), (o->>'latencyMs')::integer, o->>'requestId'
    );
  end loop;

  update public.arena_battles
  set status = 'ready',
      completed_at = now(),
      closes_at = now() + interval '24 hours'
  where id = p_battle;
end $$;

create or replace function public.arena_battle(p_id uuid default null, p_skip uuid[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  b public.arena_battles;
  p public.arena_presentations;
  v public.arena_votes;
  ev public.arena_rating_events;
  ids uuid[];
  payload jsonb;
begin
  if u is null then raise exception 'Sign in to continue'; end if;
  if p_id is null then
    select * into b from public.arena_battles x
    where status = 'ready' and closes_at > now() and votes < 3
      and (p_skip is null or not (x.id = any(p_skip)))
      and (select count(*) from public.arena_generations g where g.battle_id = x.id) = 2
      and not exists(select 1 from public.arena_votes y where y.battle_id = x.id and y.user_id = u)
    order by votes desc, random() limit 1;
  else
    select * into b from public.arena_battles where id = p_id;
  end if;
  if b.id is null then return null; end if;

  select * into v from public.arena_votes where battle_id = b.id and user_id = u;
  if v.id is not null then
    select * into ev from public.arena_rating_events where vote_id = v.id;
  end if;

  if b.status in ('generating', 'failed') then
    if b.user_id <> u then return null; end if;
    return jsonb_build_object(
      'id', b.id,
      'status', case when b.status = 'generating' and b.created_at <= now() - interval '3 minutes' then 'failed' else b.status end
    );
  end if;

  if v.id is null and (b.status = 'closed' or b.closes_at <= now() or b.votes >= 3) then
    return jsonb_build_object('id', b.id, 'status', 'closed');
  end if;

  select * into p from public.arena_presentations where user_id = u and battle_id = b.id;
  if not found then
    select array_agg(id order by random()) into ids from public.arena_generations where battle_id = b.id;
    if array_length(ids, 1) <> 2 then return null; end if;
    insert into public.arena_presentations(user_id, battle_id, left_id, right_id)
    values (u, b.id, ids[1], ids[2]) on conflict do nothing;
    select * into p from public.arena_presentations where user_id = u and battle_id = b.id;
  end if;

  select jsonb_object_agg(
    case when g.id = p.left_id then 'left' else 'right' end,
    jsonb_build_object('setup', g.setup, 'punchline', g.punchline) ||
    case when v.id is not null then jsonb_build_object(
      'model', m.name,
      'version', m.api_model,
      'rating', m.rating,
      'latencyMs', g.latency_ms,
      'clicheToAvoid', g.cliche_to_avoid,
      'comicTwist', g.comic_twist,
      'flavor', coalesce(g.prompt_chain_name, b.prompt_chain_name),
      'delta', case when ev.vote_id is not null then (case when g.id = p.left_id then ev.left_after - ev.left_before else ev.right_after - ev.right_before end) else null end
    ) else '{}'::jsonb end
  )
  into payload
  from public.arena_generations g
  join public.arena_models m on m.id = g.model_id
  where g.id in (p.left_id, p.right_id);

  return jsonb_build_object(
    'id', b.id,
    'status', 'ready',
    'target', b.target,
    'angle', b.angle,
    'context', b.context,
    'choice', v.choice,
    'votes', b.votes,
    'flavor', b.prompt_chain_name,
    'prompt', case when v.id is not null then b.prompt else null end
  ) || payload;
end $$;

-- Read-only blind preview battle for Incognito / signed-out visitors (never leaks model identities)
create or replace function public.arena_guest_battle(p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  b public.arena_battles;
  gens jsonb;
begin
  if p_id is not null then
    select * into b from public.arena_battles
    where id = p_id and status in ('ready', 'closed');
  end if;

  if b.id is null then
    select * into b from public.arena_battles x
    where x.status = 'ready' and x.closes_at > now() and x.votes < 3
      and (select count(*) from public.arena_generations g where g.battle_id = x.id) = 2
    order by x.votes desc, x.created_at desc
    limit 1;
  end if;

  if b.id is null then
    select * into b from public.arena_battles x
    where x.status in ('ready', 'closed')
      and (select count(*) from public.arena_generations g where g.battle_id = x.id) = 2
    order by x.created_at desc
    limit 1;
  end if;

  if b.id is null then return null; end if;

  select jsonb_agg(
    jsonb_build_object('setup', g.setup, 'punchline', g.punchline)
    order by md5(g.id::text || b.id::text)
  )
  into gens
  from public.arena_generations g
  where g.battle_id = b.id;

  if gens is null or jsonb_array_length(gens) <> 2 then return null; end if;

  return jsonb_build_object(
    'id', b.id,
    'status', 'ready',
    'target', b.target,
    'angle', b.angle,
    'context', b.context,
    'votes', b.votes,
    'guestPreview', true,
    'left', gens->0,
    'right', gens->1
  );
end $$;

create or replace function public.arena_public() returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
 'models', coalesce((select jsonb_agg(to_jsonb(r) order by r.rating desc) from (
   select m.id, m.name, m.api_model as version, m.rating, m.wins, m.losses, m.ties, m.bad,
     m.is_enabled,
     (select count(*) from public.arena_generations g where g.model_id = m.id) as battles,
     (select round(avg(g.latency_ms)) from public.arena_generations g where g.model_id = m.id and g.latency_ms is not null) as avg_latency_ms
   from public.arena_models m
   where m.canonical_id is null
     and (m.is_enabled = true or exists(select 1 from public.arena_generations g where g.model_id = m.id))) r), '[]'::jsonb),
 'topJokes', coalesce((select jsonb_agg(to_jsonb(r)) from (
   select g.id, g.setup, g.punchline, m.name as model, m.api_model as version,
     b.target, b.angle, b.context,
     coalesce(g.prompt_chain_name, b.prompt_chain_name) as flavor,
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
   order by wins desc, score desc, decisive desc, b.completed_at desc limit 16) r), '[]'::jsonb),
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
   'open', (select count(*) from public.arena_battles x where x.status='ready' and x.closes_at>now() and x.votes<3 and (select count(*) from public.arena_generations g where g.battle_id = x.id) = 2),
   'customBattles', (select count(*) from public.arena_battles where target='Custom Topic' and status in ('ready','closed'))
 ));
$$;

revoke all on function public.arena_finish(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.arena_finish(uuid, jsonb, text) to service_role;
revoke all on function public.arena_battle(uuid, uuid[]) from public, anon;
grant execute on function public.arena_battle(uuid, uuid[]) to authenticated;
revoke all on function public.arena_public(), public.arena_guest_battle(uuid) from public;
grant execute on function public.arena_public(), public.arena_guest_battle(uuid) to anon, authenticated;

commit;
