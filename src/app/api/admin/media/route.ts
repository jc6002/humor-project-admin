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

      await admin!.from('ai_jokes').insert([
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
      ]);

      return Response.json({ ok: true, battleId: battle.id });
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

      const { error } = await admin!
        .from('ai_jokes')
        .update({ setup, punchline, category, author })
        .eq('id', id);

      if (error) throw new Error(error.message);
      return Response.json({ ok: true });
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

    return Response.json({ ok: true });
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
      return Response.json({ ok: true });
    }

    const id = String(body.id ?? '');
    if (!UUID.test(id)) throw new Error('Invalid generation UUID.');

    const { data: gen, error: gErr } = await admin!
      .from('arena_generations')
      .select('battle_id')
      .eq('id', id)
      .maybeSingle();

    if (gErr) throw new Error(gErr.message);

    if (body.deleteEntireBattle && gen?.battle_id) {
      const { error: bDelErr } = await admin!.from('arena_battles').delete().eq('id', gen.battle_id);
      if (bDelErr) throw new Error(bDelErr.message);
      return Response.json({ ok: true, deletedBattle: gen.battle_id });
    }

    const { error: delErr } = await admin!.from('arena_generations').delete().eq('id', id);
    if (delErr) throw new Error(delErr.message);
    return Response.json({ ok: true });
  } catch (error) {
    return adminFailure(error);
  }
}
