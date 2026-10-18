import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { adminClient, checkOrigin } from '@/lib/arena/server';

export type AdminGateResult =
  | { status: 'unauthenticated' }
  | { status: 'forbidden'; user: { id: string; email: string } }
  | { status: 'authorized'; user: { id: string; email: string } };

/**
 * Verifies Google OAuth session AND checks public.profiles.is_superadmin === true
 * using the service-role client so RLS never hides the flag.
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
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, is_superadmin')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_superadmin) {
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
    { data: profiles },
    { data: authUsers },
    { data: models },
    { data: battles },
    { data: generations },
    { data: votes },
    { data: ratingEvents },
    { data: aiJokes },
  ] = await Promise.all([
    admin.from('profiles').select('*').order('created_at', { ascending: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin.from('arena_models').select('*').is('canonical_id', null).order('rating', { ascending: false }),
    admin.from('arena_battles').select('*').order('created_at', { ascending: false }).limit(200),
    admin
      .from('arena_generations')
      .select('*, arena_models(name, api_model, provider), arena_battles(target, angle, context, status, votes, created_at)')
      .order('id', { ascending: false })
      .limit(200),
    admin
      .from('arena_votes')
      .select('*, arena_battles(target, angle, context)')
      .order('created_at', { ascending: false })
      .limit(200),
    admin.from('arena_rating_events').select('*').order('seq', { ascending: false }).limit(200),
    admin.from('ai_jokes').select('*').order('created_at', { ascending: false }).limit(100),
  ]);

  const userEmailMap = new Map<string, string>();
  for (const u of authUsers?.users ?? []) {
    if (u.email) userEmailMap.set(u.id, u.email);
  }

  const battleCountByUser = new Map<string, number>();
  for (const b of battles ?? []) {
    battleCountByUser.set(b.user_id, (battleCountByUser.get(b.user_id) ?? 0) + 1);
  }

  const voteCountByUser = new Map<string, number>();
  for (const v of votes ?? []) {
    voteCountByUser.set(v.user_id, (voteCountByUser.get(v.user_id) ?? 0) + 1);
  }

  const enrichedProfiles = (profiles ?? []).map((p) => ({
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
  for (const g of generations ?? []) {
    genById.set(g.id, g);
  }

  const eventByVoteId = new Map<string, any>();
  for (const ev of ratingEvents ?? []) {
    eventByVoteId.set(ev.vote_id, ev);
  }

  const enrichedVotes = (votes ?? []).map((v) => {
    const leftGen = genById.get(v.left_id);
    const rightGen = genById.get(v.right_id);
    const ev = eventByVoteId.get(v.id);
    return {
      id: v.id,
      created_at: v.created_at,
      voter_email: userEmailMap.get(v.user_id) || v.user_id.slice(0, 8),
      battle_id: v.battle_id,
      target: v.arena_battles?.target ?? '—',
      angle: v.arena_battles?.angle ?? '—',
      choice: v.choice as 'left' | 'right' | 'tie' | 'bad',
      left_model: leftGen?.arena_models?.name ?? 'Left',
      right_model: rightGen?.arena_models?.name ?? 'Right',
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
  for (const g of generations ?? []) {
    if (typeof g.latency_ms === 'number' && g.latency_ms > 0) {
      totalLatency += g.latency_ms;
      latencyCount++;
    }
  }

  const angleMap = new Map<
    string,
    { angle: string; total: number; gptWins: number; geminiWins: number; ties: number; groans: number }
  >();
  for (const v of enrichedVotes) {
    const key = v.angle || 'General';
    const row = angleMap.get(key) ?? { angle: key, total: 0, gptWins: 0, geminiWins: 0, ties: 0, groans: 0 };
    row.total++;
    const winnerModel = v.choice === 'left' ? v.left_model : v.choice === 'right' ? v.right_model : null;
    if (winnerModel === 'GPT') row.gptWins++;
    else if (winnerModel === 'Gemini') row.geminiWins++;
    else if (v.choice === 'tie') row.ties++;
    else if (v.choice === 'bad') row.groans++;
    angleMap.set(key, row);
  }

  return {
    summary: {
      totalUsers: enrichedProfiles.length,
      superadmins: enrichedProfiles.filter((p) => p.is_superadmin).length,
      totalBattles: (battles ?? []).length,
      totalGenerations: (generations ?? []).length,
      totalAiJokes: (aiJokes ?? []).length,
      totalVotes,
      decisiveRate: totalVotes > 0 ? Math.round((decisiveVotes / totalVotes) * 100) : 0,
      groanRate: totalVotes > 0 ? Math.round((groanVotes / totalVotes) * 100) : 0,
      tieRate: totalVotes > 0 ? Math.round((tieVotes / totalVotes) * 100) : 0,
      avgLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
    },
    models: models ?? [],
    angleBreakdown: Array.from(angleMap.values()).sort((a, b) => b.total - a.total),
    profiles: enrichedProfiles,
    generations: (generations ?? []).map((g) => ({
      id: g.id,
      battle_id: g.battle_id,
      model_name: g.arena_models?.name ?? 'AI',
      model_version: g.arena_models?.api_model ?? '',
      target: g.arena_battles?.target ?? 'AI',
      angle: g.arena_battles?.angle ?? 'General',
      context: g.arena_battles?.context ?? '',
      status: g.arena_battles?.status ?? 'ready',
      votes: g.arena_battles?.votes ?? 0,
      setup: g.setup,
      punchline: g.punchline,
      latency_ms: g.latency_ms,
      created_at: g.arena_battles?.created_at ?? null,
    })),
    aiJokes: aiJokes ?? [],
    votes: enrichedVotes,
  };
}
