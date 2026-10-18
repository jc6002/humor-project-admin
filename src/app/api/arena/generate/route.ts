import { adminClient, session, checkOrigin, failure, UUID } from '@/lib/arena/server';
import { buildPrompt, generateJoke, generationConfigured, providerFailure } from '@/lib/arena/providers';
import { pickRandomScenario } from '@/lib/arena/types';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const raw = await request.text();
    if (raw.length > 4000) throw new Error('Request is too large.');
    const body = JSON.parse(raw);
    const requestId = body.requestId;
    if (!UUID.test(requestId ?? '')) throw new Error('Invalid request ID.');

    const skipIds: string[] = Array.isArray(body.skipIds)
      ? body.skipIds.filter((x: unknown): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 50)
      : [];

    const customTopic = typeof body.customTopic === 'string' ? body.customTopic.trim().slice(0, 240) : '';
    const isTrending = Boolean(body.isTrending);
    const isCustom = customTopic.length > 0;
    const forceNew = Boolean(body.forceNew) || isCustom;

    const { db, user } = await session();

    // 1. Check existing unvoted battle pool & user quota in parallel
    const [{ data: poolBattle }, { data: quota }] = await Promise.all([
      db.rpc('arena_battle', { p_id: null, p_skip: skipIds.length ? skipIds : null }),
      db.rpc('arena_quota'),
    ]);

    const canGenerate =
      generationConfigured() &&
      quota &&
      quota.remaining > 0 &&
      quota.attemptsRemaining > 0 &&
      !quota.busy;

    const shouldServePool = !forceNew && poolBattle && (!canGenerate || Math.random() < 0.6);

    if (shouldServePool) {
      return Response.json(
        { battle: { ...poolBattle, source: 'pool' }, quota },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (!canGenerate) {
      if (!isCustom && poolBattle) {
        return Response.json(
          { battle: { ...poolBattle, source: 'pool' }, quota },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      }
      if (!generationConfigured()) {
        throw new Error('Live generation is currently paused.');
      }
      throw new Error('You’ve used your 5 hourly generations. Vote on open community battles while credits recover!');
    }

    const scenario = isCustom
      ? {
          target: isTrending ? 'Trending News' : 'Custom Topic',
          angle: isTrending ? 'Trending news roast' : 'Custom challenge',
          context: customTopic,
        }
      : pickRandomScenario();

    const prompt = buildPrompt(scenario.target, scenario.angle, scenario.context);
    const admin = adminClient();

    const { data: reservation, error: resError } = await admin.rpc('arena_reserve', {
      p_user: user.id,
      p_request: requestId,
      p_target: scenario.target,
      p_angle: scenario.angle,
      p_context: scenario.context,
      p_prompt: prompt,
    });

    if (resError) {
      if (!isCustom && poolBattle) {
        return Response.json(
          { battle: { ...poolBattle, source: 'pool' }, quota },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      }
      throw new Error(resError.message);
    }

    if (!reservation.existing) {
      const outcomes = await Promise.allSettled([
        generateJoke('openai', prompt),
        generateJoke('gemini', prompt),
      ]);
      const failures = outcomes.flatMap((result, i) =>
        result.status === 'rejected' ? [providerFailure(result.reason, i === 0 ? 'openai' : 'gemini')] : []
      );
      const failed = failures.length > 0;
      const outputs = outcomes.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      if (failed) console.error('arena_generation_failed', { battleId: reservation.id, codes: failures.map((f) => f.code) });
      const { error: saveError } = await admin.rpc('arena_finish', {
        p_battle: reservation.id,
        p_outputs: outputs,
        p_error: failed ? failures.map((f) => f.code).join(',') : null,
      });
      if (saveError) throw new Error('The result could not be saved. Check your history before retrying.');
      if (failed) {
        if (!isCustom && poolBattle) {
          const { data: updatedQuota } = await db.rpc('arena_quota');
          return Response.json(
            { battle: { ...poolBattle, source: 'pool' }, quota: updatedQuota ?? quota },
            { headers: { 'Cache-Control': 'no-store' } }
          );
        }
        throw new Error(`${failures.map((f) => f.message).join(' ')} No credit was used.`);
      }
    }

    const [{ data: freshBattle }, { data: freshQuota }] = await Promise.all([
      db.rpc('arena_battle', { p_id: reservation.id, p_skip: null }),
      db.rpc('arena_quota'),
    ]);

    return Response.json(
      {
        battle: freshBattle ? { ...freshBattle, source: isCustom ? 'custom' : 'fresh' } : null,
        quota: freshQuota,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return failure(error);
  }
}
