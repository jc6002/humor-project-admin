import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { adminClient, checkOrigin } from '@/lib/arena/server';

export type AdminGateResult =
  | { status: 'unauthenticated' }
  | { status: 'forbidden'; user: { id: string; email: string } }
  | { status: 'authorized'; user: { id: string; email: string } };

/**
 * Verifies Google OAuth session AND checks public.profiles.is_superadmin === true
 * (or active auto_superadmin entry in public.whitelisted_emails) using service-role client.
 */
export async function checkSuperadmin(): Promise<AdminGateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: 'unauthenticated' };
  }

  const admin = adminClient();
  const [{ data: profile }, whitelistRes] = await Promise.all([
    admin.from('profiles').select('id, email, is_superadmin').eq('id', user.id).maybeSingle(),
    user.email
      ? admin
          .from('whitelisted_emails')
          .select('email, auto_superadmin, is_active')
          .ilike('email', user.email)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const autoAdmin = Boolean(whitelistRes?.data?.is_active && whitelistRes?.data?.auto_superadmin);
  if (autoAdmin && !profile?.is_superadmin) {
    await admin
      .from('profiles')
      .upsert({ id: user.id, email: user.email, is_superadmin: true }, { onConflict: 'id' });
  }

  if (!profile?.is_superadmin && !autoAdmin) {
    return {
      status: 'forbidden',
      user: { id: user.id, email: user.email ?? profile?.email ?? 'Unknown email' },
    };
  }

  return {
    status: 'authorized',
    user: { id: user.id, email: user.email ?? profile?.email ?? 'Superadmin' },
  };
}

export async function requireSuperadminApi(request?: Request) {
  if (request) {
    checkOrigin(request);
  }
  const gate = await checkSuperadmin();
  if (gate.status === 'unauthenticated') {
    throw new Error('Sign in with Google to access the admin area.');
  }
  if (gate.status === 'forbidden') {
    throw new Error('Forbidden: profiles.is_superadmin == TRUE is required.');
  }
  return { admin: adminClient(), user: gate.user };
}

export function adminFailure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Admin operation failed.';
  const status = message.startsWith('Sign in') ? 401 : message.startsWith('Forbidden') ? 403 : 400;
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function fetchAdminDashboardData() {
  const admin = adminClient();

  const [
    profilesRes,
    authUsersRes,
    modelsRes,
    battlesRes,
    generationsRes,
    votesRes,
    ratingEventsRes,
    providersRes,
    chainsRes,
    stepsRes,
    termsRes,
    examplesRes,
    llmResponsesRes,
    domainsRes,
    whitelistRes,
  ] = await Promise.all([
    admin.from('profiles').select('*').order('created_at', { ascending: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin.from('arena_models').select('*').order('rating', { ascending: false }),
    admin.from('arena_battles').select('*').order('created_at', { ascending: false }).limit(300),
    admin.from('arena_generations').select('*').limit(400),
    admin.from('arena_votes').select('*').order('created_at', { ascending: false }).limit(300),
    admin.from('arena_rating_events').select('*').order('seq', { ascending: false }).limit(300),
    admin.from('llm_providers').select('*').order('created_at', { ascending: true }),
    admin.from('prompt_chains').select('*').order('mix_weight', { ascending: false }),
    admin.from('prompt_chain_steps').select('*').order('step_order', { ascending: true }),
    admin.from('comedy_terms').select('*').order('created_at', { ascending: false }),
    admin.from('ai_generation_examples').select('*').order('created_at', { ascending: false }),
    admin.from('llm_responses').select('*').order('created_at', { ascending: false }).limit(300),
    admin.from('allowed_signup_domains').select('*').order('created_at', { ascending: false }),
    admin.from('whitelisted_emails').select('*').order('created_at', { ascending: false }),
  ]);

  const week7Migrated = !chainsRes.error;

  const profiles = profilesRes.data ?? [];
  const authUsers = authUsersRes.data;
  const allModels = modelsRes.data ?? [];
  const models = allModels.filter((m) => !m.canonical_id);
  const battles = battlesRes.data ?? [];
  const rawGenerations = generationsRes.data ?? [];
  const votes = votesRes.data ?? [];
  const ratingEvents = ratingEventsRes.data ?? [];
  const llmProviders = providersRes.data ?? [];
  const promptChains = chainsRes.data ?? [];
  const promptChainSteps = stepsRes.data ?? [];
  const comedyTerms = termsRes.data ?? [];
  const generationExamples = examplesRes.data ?? [];
  const llmResponses = llmResponsesRes.data ?? [];
  const allowedDomains = domainsRes.data ?? [];
  const whitelistedEmails = whitelistRes.data ?? [];

  const modelById = new Map<string, any>();
  for (const m of allModels) modelById.set(m.id, m);

  const battleById = new Map<string, any>();
  for (const b of battles) battleById.set(b.id, b);

  const userEmailMap = new Map<string, string>();
  for (const u of authUsers?.users ?? []) {
    if (u.email) userEmailMap.set(u.id, u.email);
  }
  for (const p of profiles) {
    if (p.email && !userEmailMap.has(p.id)) userEmailMap.set(p.id, p.email);
  }

  const battleCountByUser = new Map<string, number>();
  for (const b of battles) {
    battleCountByUser.set(b.user_id, (battleCountByUser.get(b.user_id) ?? 0) + 1);
  }

  const voteCountByUser = new Map<string, number>();
  for (const v of votes) {
    voteCountByUser.set(v.user_id, (voteCountByUser.get(v.user_id) ?? 0) + 1);
  }

  const enrichedProfiles = profiles.map((p) => ({
    id: p.id,
    email: p.email || userEmailMap.get(p.id) || '—',
    first_name: p.first_name || '',
    last_name: p.last_name || '',
    avatar_url: p.avatar_url || null,
    is_superadmin: Boolean(p.is_superadmin),
    battles_created: battleCountByUser.get(p.id) ?? 0,
    votes_cast: voteCountByUser.get(p.id) ?? 0,
    created_at: p.created_at,
  }));

  const genById = new Map<string, any>();
  for (const g of rawGenerations) genById.set(g.id, g);

  const eventByVoteId = new Map<string, any>();
  for (const ev of ratingEvents) eventByVoteId.set(ev.vote_id, ev);

  const enrichedVotes = votes.map((v) => {
    const battle = battleById.get(v.battle_id);
    const leftGen = genById.get(v.left_id);
    const rightGen = genById.get(v.right_id);
    const leftModel = leftGen ? modelById.get(leftGen.model_id) : null;
    const rightModel = rightGen ? modelById.get(rightGen.model_id) : null;
    const ev = eventByVoteId.get(v.id);
    return {
      id: v.id,
      created_at: v.created_at,
      voter_email: userEmailMap.get(v.user_id) || v.user_id.slice(0, 8),
      battle_id: v.battle_id,
      target: battle?.target ?? '—',
      angle: battle?.angle ?? '—',
      choice: v.choice as 'left' | 'right' | 'tie' | 'bad',
      left_model: leftModel?.name ?? 'Left',
      right_model: rightModel?.name ?? 'Right',
      left_punchline: leftGen ? `${leftGen.setup} — ${leftGen.punchline}` : '—',
      right_punchline: rightGen ? `${rightGen.setup} — ${rightGen.punchline}` : '—',
      left_delta: ev ? Number((ev.left_after - ev.left_before).toFixed(1)) : null,
      right_delta: ev ? Number((ev.right_after - ev.right_before).toFixed(1)) : null,
    };
  });

  const totalVotes = enrichedVotes.length;
  const decisiveVotes = enrichedVotes.filter((v) => v.choice === 'left' || v.choice === 'right').length;
  const groanVotes = enrichedVotes.filter((v) => v.choice === 'bad').length;
  const tieVotes = enrichedVotes.filter((v) => v.choice === 'tie').length;

  let totalLatency = 0;
  let latencyCount = 0;
  for (const g of rawGenerations) {
    if (typeof g.latency_ms === 'number' && g.latency_ms > 0) {
      totalLatency += g.latency_ms;
      latencyCount++;
    }
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  for (const r of llmResponses) {
    totalInputTokens += Number(r.input_tokens) || 0;
    totalOutputTokens += Number(r.output_tokens) || 0;
  }

  const angleMap = new Map<
    string,
    { angle: string; total: number; gptWins: number; geminiWins: number; ties: number; groans: number }
  >();
  for (const v of enrichedVotes) {
    const key = v.angle && v.angle !== '—' ? v.angle : 'General';
    const row = angleMap.get(key) ?? { angle: key, total: 0, gptWins: 0, geminiWins: 0, ties: 0, groans: 0 };
    row.total++;
    const winnerModel = v.choice === 'left' ? v.left_model : v.choice === 'right' ? v.right_model : null;
    if (winnerModel === 'GPT') row.gptWins++;
    else if (winnerModel === 'Gemini') row.geminiWins++;
    else if (v.choice === 'tie') row.ties++;
    else if (v.choice === 'bad') row.groans++;
    angleMap.set(key, row);
  }

  const enrichedGenerations = rawGenerations
    .map((g) => {
      const m = modelById.get(g.model_id);
      const b = battleById.get(g.battle_id);
      return {
        id: g.id,
        battle_id: g.battle_id,
        model_name: m?.name ?? 'AI',
        model_version: m?.api_model ?? '',
        target: b?.target ?? 'AI Comedy',
        angle: b?.angle ?? 'Tech roast',
        context: b?.context ?? '',
        status: b?.status ?? 'ready',
        votes: b?.votes ?? 0,
        setup: g.setup,
        punchline: g.punchline,
        cliche_to_avoid: g.cliche_to_avoid ?? null,
        comic_twist: g.comic_twist ?? null,
        prompt_chain_name: g.prompt_chain_name ?? b?.prompt_chain_name ?? 'Late-Night Stand-Up Roast',
        usage: g.usage ?? {},
        latency_ms: g.latency_ms ?? null,
        created_at: b?.created_at ?? null,
      };
    })
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

  const generationRequests = battles.map((b) => ({
    id: b.id,
    request_id: b.request_id,
    user_id: b.user_id,
    requester_email: userEmailMap.get(b.user_id) || b.user_id.slice(0, 8),
    target: b.target,
    angle: b.angle,
    context: b.context,
    prompt: b.prompt,
    prompt_chain_name: b.prompt_chain_name ?? 'Late-Night Stand-Up Roast',
    status: b.status,
    error_code: b.error_code ?? null,
    votes: b.votes ?? 0,
    created_at: b.created_at,
    completed_at: b.completed_at ?? null,
  }));

  return {
    week7Migrated,
    summary: {
      totalUsers: enrichedProfiles.length,
      superadmins: enrichedProfiles.filter((p) => p.is_superadmin).length,
      totalBattles: battles.length,
      totalGenerations: enrichedGenerations.length,
      totalVotes,
      decisiveRate: totalVotes > 0 ? Math.round((decisiveVotes / totalVotes) * 100) : 0,
      groanRate: totalVotes > 0 ? Math.round((groanVotes / totalVotes) * 100) : 0,
      tieRate: totalVotes > 0 ? Math.round((tieVotes / totalVotes) * 100) : 0,
      avgLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
      totalLlmResponses: llmResponses.length,
      totalInputTokens,
      totalOutputTokens,
    },
    models: models.map((m) => ({
      ...m,
      is_enabled: m.is_enabled ?? true,
      max_output_tokens: m.max_output_tokens ?? 600,
    })),
    llmProviders,
    promptChains,
    promptChainSteps,
    comedyTerms,
    generationExamples,
    generationRequests,
    llmResponses,
    allowedDomains,
    whitelistedEmails,
    angleBreakdown: Array.from(angleMap.values()).sort((a, b) => b.total - a.total),
    profiles: enrichedProfiles,
    generations: enrichedGenerations,
    votes: enrichedVotes,
  };
}
