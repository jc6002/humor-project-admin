import { requireSuperadminApi, adminFailure } from '@/lib/admin/server';
import { buildPrompt, generateJoke } from '@/lib/arena/providers';
import { UUID } from '@/lib/arena/server';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireSuperadminApi(request);
    const body = await request.json();
    const mode = body.mode ?? 'generate_battle';

    if (mode === 'generate_battle') {
      const target = String(body.target || 'Custom Topic').trim().slice(0, 80);
      const angle = String(body.angle || 'Admin challenge').trim().slice(0, 100);
      const context = String(body.context || 'Admin-triggered live benchmark roast.').trim().slice(0, 280);
      const prompt = buildPrompt(target, angle, context);

      const { data: battle, error: bErr } = await admin!
        .from('arena_battles')
        .insert({
          user_id: user.id,
          request_id: crypto.randomUUID(),
          target,
          angle,
          context,
          prompt,
          status: 'generating',
        })
        .select('*')
        .single();

      if (bErr || !battle) throw new Error(bErr?.message ?? 'Could not create battle record.');

      const [gptJoke, geminiJoke] = await Promise.all([
        generateJoke('openai', prompt),
        generateJoke('gemini', prompt),
      ]);

      const { error: finErr } = await admin!.rpc('arena_finish', {
        p_battle: battle.id,
        p_outputs: [gptJoke, geminiJoke],
        p_error: null,
      });
      if (finErr) throw new Error(finErr.message);

      const { data: insertedJokes } = await admin!
        .from('ai_jokes')
        .insert([
          {
            setup: gptJoke.setup,
            punchline: gptJoke.punchline,
            category: `${target} · ${angle}`,
            author: `${gptJoke.name} (${gptJoke.model})`,
          },
          {
            setup: geminiJoke.setup,
            punchline: geminiJoke.punchline,
            category: `${target} · ${angle}`,
            author: `${geminiJoke.name} (${geminiJoke.model})`,
          },
        ])
        .select('*');

      const { data: createdGens } = await admin!
        .from('arena_generations')
        .select('*')
        .eq('battle_id', battle.id);

      const { data: allModels } = await admin!.from('arena_models').select('*');
      const modelById = new Map((allModels ?? []).map((m: any) => [m.id, m]));

      const formattedGens = (createdGens ?? []).map((g: any) => {
        const m = modelById.get(g.model_id);
        return {
          id: g.id,
          battle_id: battle.id,
          model_name: m?.name ?? 'AI',
          model_version: m?.api_model ?? '',
          target,
          angle,
          context,
          status: 'ready',
          votes: 0,
          setup: g.setup,
          punchline: g.punchline,
          latency_ms: g.latency_ms ?? null,
          created_at: battle.created_at,
        };
      });

      return Response.json({
        ok: true,
        battleId: battle.id,
        generations: formattedGens,
        aiJokes: insertedJokes ?? [],
      });
    }

    const setup = String(body.setup ?? '').trim();
    const punchline = String(body.punchline ?? '').trim();
    const category = String(body.category ?? 'AI Roast').trim();
    const author = String(body.author ?? 'GPT / Gemini Admin Curated').trim();

    if (!setup || !punchline) {
      throw new Error('Both setup and punchline are required.');
    }

    const { data: created, error } = await admin!
      .from('ai_jokes')
      .insert({ setup, punchline, category, author })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return Response.json({ ok: true, joke: created });
  } catch (error) {
    return adminFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await requireSuperadminApi(request);
    const body = await request.json();
    const table = body.table === 'ai_jokes' ? 'ai_jokes' : 'arena_generations';
    const setup = String(body.setup ?? '').trim();
    const punchline = String(body.punchline ?? '').trim();

    if (!setup || !punchline) {
      throw new Error('Setup and punchline cannot be empty.');
    }

    if (table === 'ai_jokes') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) throw new Error('Invalid ai_jokes ID.');
      const category = String(body.category ?? 'AI').trim();
      const author = String(body.author ?? 'AI Joke Lab').trim();

      const { data: updated, error } = await admin!
        .from('ai_jokes')
        .update({ setup, punchline, category, author })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return Response.json({ ok: true, joke: updated });
    }

    const id = String(body.id ?? '');
    if (!UUID.test(id)) throw new Error('Invalid generation UUID.');

    const { data: gen, error: gErr } = await admin!
      .from('arena_generations')
      .update({ setup, punchline })
      .eq('id', id)
      .select('battle_id')
      .single();

    if (gErr || !gen) throw new Error(gErr?.message ?? 'Generation not found.');

    if (body.target || body.angle || body.status) {
      const battlePatch: Record<string, string> = {};
      if (typeof body.target === 'string' && body.target.trim()) battlePatch.target = body.target.trim();
      if (typeof body.angle === 'string' && body.angle.trim()) battlePatch.angle = body.angle.trim();
      if (['ready', 'closed', 'failed'].includes(body.status)) battlePatch.status = body.status;
      if (Object.keys(battlePatch).length > 0) {
        await admin!.from('arena_battles').update(battlePatch).eq('id', gen.battle_id);
      }
    }

    return Response.json({ ok: true, id });
  } catch (error) {
    return adminFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin } = await requireSuperadminApi(request);
    const body = await request.json();
    const table = body.table === 'ai_jokes' ? 'ai_jokes' : 'arena_generations';

    if (table === 'ai_jokes') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) throw new Error('Invalid ai_jokes ID.');
      const { error } = await admin!.from('ai_jokes').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, deletedId: id });
    }

    const id = String(body.id ?? '');
    if (!UUID.test(id)) throw new Error('Invalid generation UUID.');

    const { data: gen, error: gErr } = await admin!
      .from('arena_generations')
      .select('battle_id')
      .eq('id', id)
      .maybeSingle();

    if (gErr) throw new Error(gErr.message);

    // Clean up referencing rows in arena_rating_events, arena_votes, and arena_presentations
    // so Postgres foreign keys without ON DELETE CASCADE never block deletion.
    if (gen?.battle_id) {
      const { data: battleVotes } = await admin!
        .from('arena_votes')
        .select('id')
        .eq('battle_id', gen.battle_id);
      const voteIds = (battleVotes ?? []).map((v: any) => v.id);
      if (voteIds.length > 0) {
        await admin!.from('arena_rating_events').delete().in('vote_id', voteIds);
      }
      await admin!.from('arena_votes').delete().eq('battle_id', gen.battle_id);
      await admin!.from('arena_presentations').delete().eq('battle_id', gen.battle_id);
    } else {
      const { data: genVotes } = await admin!
        .from('arena_votes')
        .select('id')
        .or(`left_id.eq.${id},right_id.eq.${id}`);
      const voteIds = (genVotes ?? []).map((v: any) => v.id);
      if (voteIds.length > 0) {
        await admin!.from('arena_rating_events').delete().in('vote_id', voteIds);
        await admin!.from('arena_votes').delete().in('id', voteIds);
      }
      await admin!.from('arena_presentations').delete().or(`left_id.eq.${id},right_id.eq.${id}`);
    }

    const { error: delErr } = await admin!.from('arena_generations').delete().eq('id', id);
    if (delErr) throw new Error(delErr.message);

    // If no generations remain for that battle, clean up the parent battle row too
    if (gen?.battle_id) {
      const { data: remaining } = await admin!
        .from('arena_generations')
        .select('id')
        .eq('battle_id', gen.battle_id);
      if (!remaining || remaining.length === 0) {
        await admin!.from('arena_battles').delete().eq('id', gen.battle_id);
      }
    }

    return Response.json({ ok: true, deletedId: id });
  } catch (error) {
    return adminFailure(error);
  }
}
