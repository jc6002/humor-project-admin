import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to public;`);
await db.exec(await readFile(new URL('../supabase/arena.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/arena.sql',import.meta.url),'utf8'));
const users=Array.from({length:10},()=>randomUUID());
for(const u of users)await db.query('insert into auth.users values($1)',[u]);
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const login=async(u)=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);};
const reserve=async(u=users[0],rid=randomUUID())=>scalar('select public.arena_reserve($1,$2,$3,$4,$5,$6)',[u,rid,'Claude','Endless explanations','','test prompt']);
const outputs=[{provider:'openai',model:'test-gpt',name:'GPT',configVersion:'test',setup:'Test setup A',punchline:'Test punchline A',latencyMs:1},{provider:'gemini',model:'test-gemini',name:'Gemini',configVersion:'test',setup:'Test setup B',punchline:'Test punchline B',latencyMs:1}];
await assert.rejects(reserve(),/paused/);
await db.exec('update public.arena_limits set enabled=true');
await login(users[0]);
const rid=randomUUID();const first=await reserve(users[0],rid);
assert.equal((await reserve(users[0],rid)).id,first.id);
assert.equal((await reserve(users[0],rid)).existing,true);
await assert.rejects(reserve(),/already running/);
await db.query('select public.arena_finish($1,$2::jsonb)',[first.id,JSON.stringify(outputs)]);
const view=await scalar('select public.arena_battle($1)',[first.id]);
assert.ok(view.left.setup);assert.equal(view.left.model,undefined);assert.equal(view.prompt,null);
await db.exec('set role authenticated');
await assert.rejects(db.query('select * from public.arena_generations'),/permission denied/);
await assert.rejects(reserve(),/permission denied/);
await assert.rejects(db.query('select public.arena_finish($1,$2::jsonb)',[first.id,JSON.stringify(outputs)]),/permission denied/);
const voted=await scalar("select public.arena_vote($1,'left')",[first.id]);
assert.ok(voted.left.model);assert.equal(voted.left.rating,1008);assert.equal(voted.right.rating,992);
await scalar("select public.arena_vote($1,'right')",[first.id]);
await db.exec('reset role');
assert.equal(await scalar('select count(*)::int from public.arena_rating_events'),1);
assert.equal(await scalar('select sum(rating) from public.arena_models'),2000);
// Other users still get blind, independently shuffled presentations.
for(let i=1;i<3;i++){
  await login(users[i]);const b=await scalar('select public.arena_battle($1)',[first.id]);assert.equal(b.left.model,undefined);
  const choice=b.left.setup===voted.left.setup?'left':'right';
  await scalar('select public.arena_vote($1,$2)',[first.id,choice]);
}
assert.equal(await scalar('select votes from public.arena_battles where id=$1',[first.id]),3);
await login(users[5]);assert.equal((await scalar('select public.arena_battle($1)',[first.id])).status,'closed');
await assert.rejects(scalar("select public.arena_vote($1,'left')",[first.id]),/closed/);
const published=await scalar('select public.arena_public()');assert.equal(published.topJokes.length,1);assert.equal(published.topJokes[0].wins,3);
// Reproduce the legacy split caused by a response-format configuration change.
await db.exec('drop index public.arena_models_identity; alter table public.arena_models drop column canonical_id; alter table public.arena_generations drop column config_version');
const original=await scalar("select id from public.arena_models where provider='openai'");
const duplicate=randomUUID();
await db.query("insert into public.arena_models(id,provider,api_model,name,config_version) values($1,'openai','test-gpt','GPT','strict-json')",[duplicate]);
await db.query("update public.arena_generations set model_id=$1 where model_id=$2",[duplicate,original]);
await db.query("update public.arena_rating_events set left_model=$1 where left_model=$2",[duplicate,original]);
await db.query("update public.arena_rating_events set right_model=$1 where right_model=$2",[duplicate,original]);
const migration=await readFile(new URL('../supabase/model-identity.sql',import.meta.url),'utf8');
await db.exec(migration);
const merged=await scalar('select public.arena_public()');
assert.equal(merged.models.length,2);
assert.equal(merged.models.find(m=>m.name==='GPT').battles,1);
const withoutId=model=>{const copy={...model};delete copy.id;return copy;};
assert.deepEqual(merged.models.map(withoutId),published.models.map(withoutId));
assert.equal(await scalar('select count(*)::int from public.arena_votes'),3);
assert.equal(await scalar('select count(*)::int from public.arena_generations'),2);
assert.equal(await scalar('select count(*)::int from public.arena_generations where config_version is null'),0);
await db.exec(migration);
assert.deepEqual(await scalar('select public.arena_public()'),merged);
outputs[0].configVersion='strict-json';
// Successful generation cap, cooldown, and rolling recovery.
await login(users[0]);
for(let i=0;i<4;i++){
  await db.query("update public.arena_battles set created_at=now()-interval '31 seconds' where user_id=$1",[users[0]]);
  const r=await reserve();await db.query('select public.arena_finish($1,$2::jsonb)',[r.id,JSON.stringify(outputs)]);
}
assert.equal((await scalar('select public.arena_public()')).models.length,2);
assert.equal(await scalar("select count(*)::int from public.arena_generations where config_version='strict-json'"),5);
assert.equal((await scalar('select public.arena_quota()')).remaining,0);
await assert.rejects(reserve(),/5 hourly/);
await db.query("update public.arena_battles set completed_at=now()-interval '61 minutes' where id=$1",[first.id]);
assert.equal((await scalar('select public.arena_quota()')).remaining,1);
await db.query("update public.arena_battles set created_at=now()-interval '31 seconds' where user_id=$1",[users[0]]);
const failed=await reserve();await db.query("select public.arena_finish($1,'[]','provider_failed')",[failed.id]);
assert.equal((await scalar('select public.arena_quota()')).remaining,1);
// A generation whose process crashed loses only its lease, not its attempt record.
await db.query("update public.arena_battles set created_at=now()-interval '31 seconds' where user_id=$1",[users[0]]);
const stale=await reserve();await db.query("update public.arena_battles set created_at=now()-interval '4 minutes' where id=$1",[stale.id]);
assert.equal((await scalar('select public.arena_battle($1)',[stale.id])).status,'failed');
await db.query('select public.arena_finish($1,$2::jsonb)',[stale.id,JSON.stringify(outputs)]);
assert.equal(await scalar('select count(*)::int from public.arena_generations where battle_id=$1',[stale.id]),0);
// Global cap fails closed even for a new account.
await db.exec('update public.arena_limits set total_attempts=0');
await assert.rejects(reserve(users[6]),/budget/);
await db.exec('set role anon');await scalar('select public.arena_public()');
await assert.rejects(scalar('select public.arena_quota()'),/permission denied/);
await assert.rejects(scalar('select public.arena_history()'),/permission denied/);
await db.exec('reset role');
await db.close();console.log('PASS: legacy model merge, configuration changes, per-generation provenance, idempotent Elo replay, migration rerun, raw-table permissions, trusted writes, anonymous presentations, Elo, vote deduplication, five-vote closure, top jokes, hourly quota, cooldown, failure recovery, expired leases, global budget, anonymous access.');
