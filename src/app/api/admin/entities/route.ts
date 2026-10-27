import { requireSuperadminApi, adminFailure } from '@/lib/admin/server';
import { UUID } from '@/lib/arena/server';

const VALID_TERM_TYPES = ['banned_cliche', 'tech_glossary', 'campus_slang', 'punchline_device'] as const;

export async function POST(request: Request) {
  try {
    const { admin } = await requireSuperadminApi(request);
    const body = await request.json();
    const entity = String(body.entity ?? '');

    if (entity === 'comedy_terms') {
      const term = String(body.term ?? '').trim().slice(0, 120);
      const term_type = VALID_TERM_TYPES.includes(body.term_type) ? body.term_type : 'banned_cliche';
      const definition_or_rule = String(body.definition_or_rule ?? '').trim().slice(0, 400);
      const is_active = body.is_active !== false;
      if (!term) throw new Error('Term is required.');

      const { data, error } = await admin!
        .from('comedy_terms')
        .insert({ term, term_type, definition_or_rule, is_active })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, row: data });
    }

    if (entity === 'ai_generation_examples') {
      const topic = String(body.topic ?? 'AI Agents').trim().slice(0, 80);
      const angle = String(body.angle ?? 'Coding disasters').trim().slice(0, 100);
      const premise = String(body.premise ?? '').trim().slice(0, 300);
      const setup = String(body.setup ?? '').trim().slice(0, 500);
      const punchline = String(body.punchline ?? '').trim().slice(0, 500);
      const why_it_works = String(body.why_it_works ?? '').trim().slice(0, 300);
      const chain_id = body.chain_id && UUID.test(String(body.chain_id)) ? String(body.chain_id) : null;
      const is_active = body.is_active !== false;
      if (!setup || !punchline) throw new Error('Both setup and punchline are required.');

      const { data, error } = await admin!
        .from('ai_generation_examples')
        .insert({ chain_id, topic, angle, premise, setup, punchline, why_it_works, is_active })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, row: data });
    }

    if (entity === 'llm_providers') {
      const slug = String(body.slug ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
      const name = String(body.name ?? '').trim().slice(0, 80);
      const api_base_url = String(body.api_base_url ?? '').trim().slice(0, 240);
      const protocol = String(body.protocol ?? 'openai_responses').trim().slice(0, 60);
      const api_key_env = String(body.api_key_env ?? 'OPENAI_API_KEY').trim().slice(0, 80);
      const is_enabled = body.is_enabled !== false;
      if (!slug || !name || !api_base_url) {
        throw new Error('Provider slug, display name, and API base URL are required.');
      }

      const { data, error } = await admin!
        .from('llm_providers')
        .insert({ slug, name, api_base_url, protocol, api_key_env, is_enabled })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, row: data });
    }

    if (entity === 'llm_models') {
      const provider = String(body.provider ?? 'openai').trim().toLowerCase();
      const api_model = String(body.api_model ?? '').trim().slice(0, 120);
      const name = String(body.name ?? (provider === 'gemini' ? 'Gemini' : 'GPT')).trim().slice(0, 80);
      const max_output_tokens = Math.max(100, Math.min(8000, Number(body.max_output_tokens) || 600));
      const is_enabled = body.is_enabled !== false;
      if (!api_model || !name) throw new Error('Model display name and API model ID are required.');

      const { data: provRow } = await admin!
        .from('llm_providers')
        .select('id')
        .eq('slug', provider)
        .maybeSingle();

      const { data, error } = await admin!
        .from('arena_models')
        .insert({
          provider,
          provider_id: provRow?.id ?? null,
          api_model,
          name,
          config_version: 'ai-roast-v3',
          max_output_tokens,
          is_enabled,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, row: data });
    }

    if (entity === 'allowed_signup_domains') {
      const domain = String(body.domain ?? '')
        .trim()
        .toLowerCase()
        .replace(/^@/, '');
      const description = String(body.description ?? '').trim().slice(0, 240);
      const is_active = body.is_active !== false;
      if (!domain || !domain.includes('.')) throw new Error('Enter a valid domain (e.g., columbia.edu).');

      const { data, error } = await admin!
        .from('allowed_signup_domains')
        .insert({ domain, description, is_active })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, row: data });
    }

    if (entity === 'whitelisted_emails') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const note = String(body.note ?? '').trim().slice(0, 240);
      const auto_superadmin = Boolean(body.auto_superadmin);
      const is_active = body.is_active !== false;
      if (!email || !email.includes('@')) throw new Error('Enter a valid e-mail address.');

      const { data, error } = await admin!
        .from('whitelisted_emails')
        .insert({ email, note, auto_superadmin, is_active })
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      if (auto_superadmin && is_active) {
        await admin!.from('profiles').update({ is_superadmin: true }).ilike('email', email);
      }
      return Response.json({ ok: true, row: data });
    }

    throw new Error(`Unsupported entity: ${entity}`);
  } catch (error) {
    return adminFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await requireSuperadminApi(request);
    const body = await request.json();
    const entity = String(body.entity ?? '');

    if (entity === 'prompt_chain_mix') {
      const items: Array<{ id: string; mix_weight: number; is_active: boolean }> = Array.isArray(body.items)
        ? body.items
        : [];
      if (!items.length) throw new Error('No prompt chains provided.');

      const updated: any[] = [];
      for (const item of items) {
        if (!UUID.test(String(item.id))) throw new Error('Invalid prompt chain ID.');
        const mix_weight = Math.max(0, Math.min(1000, Math.round(Number(item.mix_weight) || 0)));
        const is_active = Boolean(item.is_active);
        const { data, error } = await admin!
          .from('prompt_chains')
          .update({ mix_weight, is_active, updated_at: new Date().toISOString() })
          .eq('id', item.id)
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        updated.push(data);
      }
      return Response.json({ ok: true, rows: updated });
    }

    const id = String(body.id ?? '');
    if (!UUID.test(id)) throw new Error('Invalid record UUID.');

    if (entity === 'comedy_terms') {
      const patch: Record<string, any> = {};
      if (typeof body.term === 'string' && body.term.trim()) patch.term = body.term.trim().slice(0, 120);
      if (VALID_TERM_TYPES.includes(body.term_type)) patch.term_type = body.term_type;
      if (typeof body.definition_or_rule === 'string')
        patch.definition_or_rule = body.definition_or_rule.trim().slice(0, 400);
      if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;

      const { data, error } = await admin!
        .from('comedy_terms')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, row: data });
    }

    if (entity === 'ai_generation_examples') {
      const patch: Record<string, any> = {};
      if (typeof body.topic === 'string' && body.topic.trim()) patch.topic = body.topic.trim().slice(0, 80);
      if (typeof body.angle === 'string' && body.angle.trim()) patch.angle = body.angle.trim().slice(0, 100);
      if (typeof body.premise === 'string') patch.premise = body.premise.trim().slice(0, 300);
      if (typeof body.setup === 'string' && body.setup.trim()) patch.setup = body.setup.trim().slice(0, 500);
      if (typeof body.punchline === 'string' && body.punchline.trim())
        patch.punchline = body.punchline.trim().slice(0, 500);
      if (typeof body.why_it_works === 'string') patch.why_it_works = body.why_it_works.trim().slice(0, 300);
      if (body.chain_id === null || body.chain_id === '') patch.chain_id = null;
      else if (typeof body.chain_id === 'string' && UUID.test(body.chain_id)) patch.chain_id = body.chain_id;
      if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;

      const { data, error } = await admin!
        .from('ai_generation_examples')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, row: data });
    }

    if (entity === 'llm_providers') {
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (typeof body.slug === 'string' && body.slug.trim())
        patch.slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
      if (typeof body.api_base_url === 'string' && body.api_base_url.trim())
        patch.api_base_url = body.api_base_url.trim().slice(0, 240);
      if (typeof body.protocol === 'string' && body.protocol.trim())
        patch.protocol = body.protocol.trim().slice(0, 60);
      if (typeof body.api_key_env === 'string' && body.api_key_env.trim())
        patch.api_key_env = body.api_key_env.trim().slice(0, 80);
      if (typeof body.is_enabled === 'boolean') patch.is_enabled = body.is_enabled;

      const { data, error } = await admin!
        .from('llm_providers')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, row: data });
    }

    if (entity === 'llm_models') {
      const patch: Record<string, any> = {};
      if (typeof body.provider === 'string' && body.provider.trim()) {
        const cleanProv = body.provider.trim().toLowerCase();
        patch.provider = cleanProv;
        const { data: provRow } = await admin!
          .from('llm_providers')
          .select('id')
          .eq('slug', cleanProv)
          .maybeSingle();
        patch.provider_id = provRow?.id ?? null;
      }
      if (typeof body.api_model === 'string' && body.api_model.trim())
        patch.api_model = body.api_model.trim().slice(0, 120);
      if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
      if (body.max_output_tokens !== undefined)
        patch.max_output_tokens = Math.max(100, Math.min(8000, Number(body.max_output_tokens) || 600));
      if (typeof body.is_enabled === 'boolean') patch.is_enabled = body.is_enabled;

      const { data, error } = await admin!
        .from('arena_models')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, row: data });
    }

    if (entity === 'allowed_signup_domains') {
      const patch: Record<string, any> = {};
      if (typeof body.domain === 'string' && body.domain.trim())
        patch.domain = body.domain.trim().toLowerCase().replace(/^@/, '');
      if (typeof body.description === 'string') patch.description = body.description.trim().slice(0, 240);
      if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;

      const { data, error } = await admin!
        .from('allowed_signup_domains')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, row: data });
    }

    if (entity === 'whitelisted_emails') {
      const patch: Record<string, any> = {};
      if (typeof body.email === 'string' && body.email.trim())
        patch.email = body.email.trim().toLowerCase();
      if (typeof body.note === 'string') patch.note = body.note.trim().slice(0, 240);
      if (typeof body.auto_superadmin === 'boolean') patch.auto_superadmin = body.auto_superadmin;
      if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;

      const { data, error } = await admin!
        .from('whitelisted_emails')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      if (data?.auto_superadmin && data?.is_active) {
        await admin!.from('profiles').update({ is_superadmin: true }).ilike('email', data.email);
      }
      return Response.json({ ok: true, row: data });
    }

    throw new Error(`Unsupported entity: ${entity}`);
  } catch (error) {
    return adminFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin } = await requireSuperadminApi(request);
    const body = await request.json();
    const entity = String(body.entity ?? '');
    const id = String(body.id ?? '');
    if (!UUID.test(id)) throw new Error('Invalid record UUID.');

    const tableMap: Record<string, string> = {
      comedy_terms: 'comedy_terms',
      ai_generation_examples: 'ai_generation_examples',
      llm_providers: 'llm_providers',
      allowed_signup_domains: 'allowed_signup_domains',
      whitelisted_emails: 'whitelisted_emails',
    };

    if (entity === 'llm_models') {
      await admin!.from('arena_models').update({ canonical_id: null }).eq('canonical_id', id);

      const { count } = await admin!
        .from('arena_generations')
        .select('id', { count: 'exact', head: true })
        .eq('model_id', id);

      if ((count ?? 0) > 0) {
        await admin!.from('arena_rating_events').delete().or(`left_model.eq.${id},right_model.eq.${id}`);
        const { data: gens } = await admin!.from('arena_generations').select('id, battle_id').eq('model_id', id);
        const affectedBattleIds = Array.from(new Set((gens ?? []).map((g: any) => g.battle_id).filter(Boolean)));
        for (const bid of affectedBattleIds) {
          await admin!.from('arena_votes').delete().eq('battle_id', bid);
          await admin!.from('arena_presentations').delete().eq('battle_id', bid);
        }
        await admin!.from('arena_generations').delete().eq('model_id', id);
        for (const bid of affectedBattleIds) {
          const { data: rem } = await admin!.from('arena_generations').select('id').eq('battle_id', bid);
          if (!rem || rem.length === 0) {
            await admin!.from('arena_battles').delete().eq('id', bid);
          } else if (rem.length < 2) {
            await admin!.from('arena_battles').update({ status: 'closed' }).eq('id', bid);
          }
        }
      }

      const { error } = await admin!.from('arena_models').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return Response.json({ ok: true, deletedId: id });
    }

    const table = tableMap[entity];
    if (!table) throw new Error(`Unsupported entity: ${entity}`);

    const { error } = await admin!.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true, deletedId: id });
  } catch (error) {
    return adminFailure(error);
  }
}
