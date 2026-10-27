import { requireSuperadminApi, adminFailure } from '@/lib/admin/server';
import { generateJoke, resolveDynamicGenerationPlan } from '@/lib/arena/providers';
import { UUID } from '@/lib/arena/server';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireSuperadminApi(request);
    const body = await request.json();
    const mode = body.mode ?? 'generate_battle';

    if (mode === 'generate_battle') {
      const target = String(body.target || 'AI Agents').trim().slice(0, 80);
      const angle = String(body.angle || 'Coding disasters').trim().slice(0, 100);
      const context = String(body.context || 'Admin-triggered live benchmark roast.').trim().slice(0, 280);
      const reqId = crypto.randomUUID();
      const plan = await resolveDynamicGenerationPlan(admin!, target, angle, context);
      if (plan.disabledProviders && plan.disabledProviders.length > 0) {
        throw new Error(
          `Cannot run live battle while LLM provider (${plan.disabledProviders.join(', ')}) is disabled in Tab 3.`
        );
      }

      const { data: battle, error: bErr } = await admin!
        .from('arena_battles')
        .insert({
          user_id: user.id,
          request_id: reqId,
          target,
          angle,
          context,
          prompt: plan.prompt,
          prompt_chain_id: plan.chainId,
          prompt_chain_name: plan.chainName,
          status: 'generating',
        })
        .select('*')
        .single();

      if (bErr || !battle) throw new Error(bErr?.message ?? 'Could not create battle record.');

      const [gptJoke, geminiJoke] = await Promise.all([
        generateJoke('openai', plan.prompt, plan.openaiModelOverride, {
          maxTokens: plan.openaiMaxTokens,
          promptChainName: plan.chainName,
        }),
        generateJoke('gemini', plan.prompt, plan.geminiModelOverride, {
          maxTokens: plan.geminiMaxTokens,
          promptChainName: plan.chainName,
        }),
      ]);

      const { error: finErr } = await admin!.rpc('arena_finish', {
        p_battle: battle.id,
        p_outputs: [gptJoke, geminiJoke],
        p_error: null,
      });
      if (finErr) throw new Error(finErr.message);

      const { data: createdGens } = await admin!
        .from('arena_generations')
        .select('*')
        .eq('battle_id', battle.id);

      try {
        const traces = [gptJoke, geminiJoke].map((val) => {
          const matched = (createdGens ?? []).find(
            (g: any) => g.setup === val.setup && g.punchline === val.punchline
          );
          return {
            battle_id: battle.id,
            generation_id: matched?.id ?? null,
            request_id: reqId,
            provider: val.provider,
            model: val.model,
            prompt_chain_name: plan.chainName,
            prompt_text: plan.prompt,
            raw_response_text: val.rawResponseText,
            parsed_cliche_to_avoid: val.clicheToAvoid,
            parsed_comic_twist: val.comicTwist,
            parsed_setup: val.setup,
            parsed_punchline: val.punchline,
            status: 'success',
            http_status: val.httpStatus,
            latency_ms: val.latencyMs,
            input_tokens: val.inputTokens,
            output_tokens: val.outputTokens,
            reasoning_tokens: val.reasoningTokens,
            provider_request_id: val.requestId,
            usage: val.usage ?? {},
          };
        });
        await admin!.from('llm_responses').insert(traces);
      } catch {
        // non-blocking
      }

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
          cliche_to_avoid: g.cliche_to_avoid ?? null,
          comic_twist: g.comic_twist ?? null,
          prompt_chain_name: plan.chainName,
          usage: g.usage ?? {},
          latency_ms: g.latency_ms ?? null,
          created_at: battle.created_at,
        };
      });

      return Response.json({
        ok: true,
        battleId: battle.id,
        generations: formattedGens,
      });
    }

    const setup = String(body.setup ?? '').trim();
    const punchline = String(body.punchline ?? '').trim();
    const target = String(body.target || 'Custom Topic').trim().slice(0, 80);
    const angle = String(body.angle || 'Admin curated').trim().slice(0, 100);
    const modelChoice = body.modelName === 'GPT' ? 'GPT' : 'Gemini';

    if (!setup || !punchline) {
      throw new Error('Both setup and punchline are required.');
    }

    const { data: allModels } = await admin!
      .from('arena_models')
      .select('*')
      .is('canonical_id', null)
      .order('rating', { ascending: false });

    const chosenModel =
      (allModels ?? []).find((m: any) => m.name === modelChoice) ?? (allModels ?? [])[0];

    if (!chosenModel) {
      throw new Error('No arena_models found in database.');
    }

    const { data: battle, error: bErr } = await admin!
      .from('arena_battles')
      .insert({
        user_id: user.id,
        request_id: crypto.randomUUID(),
        target,
        angle,
        context: 'Admin curated joke entry',
        prompt: 'Admin direct creation',
        prompt_chain_name: 'Admin Curated',
        status: 'closed',
        completed_at: new Date().toISOString(),
        closes_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (bErr || !battle) throw new Error(bErr?.message ?? 'Could not create battle.');

    const { data: insertedGen, error: gErr } = await admin!
      .from('arena_generations')
      .insert({
        battle_id: battle.id,
        model_id: chosenModel.id,
        setup,
        punchline,
        prompt_chain_name: 'Admin Curated',
        config_version: chosenModel.config_version || 'ai-roast-v3',
        latency_ms: 0,
      })
      .select('*')
      .single();

    if (gErr || !insertedGen) throw new Error(gErr?.message ?? 'Could not insert joke.');

    return Response.json({
      ok: true,
      generations: [
        {
          id: insertedGen.id,
          battle_id: battle.id,
          model_name: chosenModel.name,
          model_version: chosenModel.api_model,
          target,
          angle,
          context: battle.context,
          status: battle.status,
          votes: 0,
          setup: insertedGen.setup,
          punchline: insertedGen.punchline,
          cliche_to_avoid: null,
          comic_twist: null,
          prompt_chain_name: 'Admin Curated',
          usage: {},
          latency_ms: 0,
          created_at: battle.created_at,
        },
      ],
    });
  } catch (error) {
    return adminFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await requireSuperadminApi(request);
    const body = await request.json();
    const setup = String(body.setup ?? '').trim();
    const punchline = String(body.punchline ?? '').trim();

    if (!setup || !punchline) {
      throw new Error('Setup and punchline cannot be empty.');
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

    const id = String(body.id ?? '');
    if (!UUID.test(id)) throw new Error('Invalid generation UUID.');

    const { data: gen, error: gErr } = await admin!
      .from('arena_generations')
      .select('battle_id')
      .eq('id', id)
      .maybeSingle();

    if (gErr) throw new Error(gErr.message);

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

    if (gen?.battle_id) {
      const { data: remaining } = await admin!
        .from('arena_generations')
        .select('id')
        .eq('battle_id', gen.battle_id);
      if (!remaining || remaining.length === 0) {
        await admin!.from('arena_battles').delete().eq('id', gen.battle_id);
      } else if (remaining.length < 2) {
        await admin!.from('arena_battles').update({ status: 'closed' }).eq('id', gen.battle_id);
      }
    }

    return Response.json({ ok: true, deletedId: id });
  } catch (error) {
    return adminFailure(error);
  }
}
