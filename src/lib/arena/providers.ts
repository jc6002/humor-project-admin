import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export class ProviderError extends Error {
  provider: string;
  code: string;
  httpStatus?: number;
  latencyMs?: number;
  attemptedModel?: string;
  rawResponseText?: string;

  constructor(
    provider: string,
    code: string,
    meta?: { httpStatus?: number; latencyMs?: number; attemptedModel?: string; rawResponseText?: string }
  ) {
    super(`${provider}_${code}`);
    this.provider = provider;
    this.code = code;
    this.httpStatus = meta?.httpStatus;
    this.latencyMs = meta?.latencyMs;
    this.attemptedModel = meta?.attemptedModel;
    this.rawResponseText = meta?.rawResponseText;
  }
}

export function providerFailure(error: unknown, provider: string) {
  const code =
    error instanceof ProviderError
      ? error.code
      : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
        ? 'timeout'
        : 'network';
  const name = provider === 'openai' ? 'GPT' : 'Gemini';
  const reason =
    code === '429'
      ? 'is rate-limited or has exhausted its API quota'
      : code === '401' || code === '403'
        ? 'could not authorize this request'
        : code === 'timeout'
          ? 'timed out'
          : code === 'invalid_output'
            ? 'returned an invalid joke format'
            : code === 'incomplete'
              ? 'did not complete its answer'
              : code === 'network'
                ? 'could not be reached'
                : 'is temporarily unavailable';
  return { code: `${provider}_${code}`, message: `${name} ${reason}.` };
}

export function generationConfigured() {
  return (
    ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'OPENAI_MODEL', 'GEMINI_MODEL', 'SUPABASE_SERVICE_ROLE_KEY'].every((k) =>
      Boolean(process.env[k]?.trim())
    ) && process.env.GENERATION_ENABLED === 'true'
  );
}

export function buildPrompt(target: string, angle: string, context: string) {
  const isCustom = target === 'Custom Topic' || angle === 'Custom challenge';
  return [
    'You are a sharp late-night stand-up writer crafting punchy two-liner jokes for developers, students, and internet culture fans.',
    isCustom
      ? 'Write ONE biting, original two-part joke (setup + punchline) specifically about the user-submitted custom topic/premise below.'
      : 'Write ONE biting, original two-part joke (setup + punchline) roasting the AI scenario below.',
    'Rules:',
    '1. Total joke length (setup + punchline combined) MUST be 15–42 words. Keep the setup to 1 crisp sentence and the punchline to 1 killer sentence.',
    '2. Put the twist on the very last words of the punchline. Never explain the joke.',
    '3. BANNED clichés: never use puns on "context window", "draw conclusions", "neural layers", "training set", or "as an AI language model".',
    '4. Ground the joke in concrete, relatable details from the premise. Never reveal which model wrote this joke.',
    '5. First fill out `cliche_to_avoid` (under 8 words) and `comic_twist` (under 12 words) to plan a non-obvious angle, then write `setup` and `punchline`.',
    `Scenario: ${JSON.stringify({ target, angle, scene: context })}`,
  ].join('\n');
}

export type DynamicGenerationPlan = {
  prompt: string;
  chainId: string | null;
  chainName: string;
  openaiModelOverride?: string;
  openaiMaxTokens?: number;
  geminiModelOverride?: string;
  geminiMaxTokens?: number;
  disabledProviders?: string[];
};

/**
 * Dynamically compiles the prompt using the Admin-configured Prompt Chain Mix,
 * Prompt Chain Steps, Comedy Terms (banned clichés + glossary), Few-Shot Examples,
 * and active LLM Providers/Models, with seamless fallback if tables are absent.
 */
export async function resolveDynamicGenerationPlan(
  admin: SupabaseClient,
  target: string,
  angle: string,
  context: string
): Promise<DynamicGenerationPlan> {
  try {
    const [chainsRes, stepsRes, termsRes, examplesRes, providersRes, modelsRes] = await Promise.all([
      admin.from('prompt_chains').select('*').eq('is_active', true),
      admin.from('prompt_chain_steps').select('*').order('step_order', { ascending: true }),
      admin.from('comedy_terms').select('*').eq('is_active', true),
      admin.from('ai_generation_examples').select('*').eq('is_active', true).limit(12),
      admin.from('llm_providers').select('*'),
      admin.from('arena_models').select('*').is('canonical_id', null).eq('is_enabled', true),
    ]);

    const chains = chainsRes.data ?? [];
    const steps = stepsRes.data ?? [];
    const terms = termsRes.data ?? [];
    const examples = examplesRes.data ?? [];
    const allProviderRows = providersRes.data ?? [];
    const disabledProviders = (['openai', 'gemini'] as const).filter((slug) => {
      const row = allProviderRows.find((p: any) => String(p.slug).toLowerCase() === slug);
      return row && row.is_enabled === false;
    });
    const dbModels = modelsRes.data ?? [];

    // Pick model overrides from enabled DB models if configured
    const pickDbModel = (prov: 'openai' | 'gemini') => {
      if (disabledProviders.includes(prov)) return undefined;
      const pool = dbModels.filter((m: any) => String(m.provider).toLowerCase() === prov && m.api_model);
      if (!pool.length) return undefined;
      return pool[Math.floor(Math.random() * pool.length)];
    };

    const chosenOpenAi = pickDbModel('openai');
    const chosenGemini = pickDbModel('gemini');

    if (!chains.length) {
      return {
        prompt: buildPrompt(target, angle, context),
        chainId: null,
        chainName: 'Late-Night Stand-Up Roast',
        openaiModelOverride: chosenOpenAi?.api_model,
        openaiMaxTokens: chosenOpenAi?.max_output_tokens,
        geminiModelOverride: chosenGemini?.api_model,
        geminiMaxTokens: chosenGemini?.max_output_tokens,
        disabledProviders,
      };
    }

    // Weighted random selection according to Prompt Chain Mix (mix_weight)
    const totalWeight = chains.reduce((acc: number, c: any) => acc + Math.max(0, Number(c.mix_weight) || 0), 0);
    let chosenChain = chains[0];
    if (totalWeight > 0) {
      let roll = Math.random() * totalWeight;
      for (const c of chains) {
        roll -= Math.max(0, Number(c.mix_weight) || 0);
        if (roll <= 0) {
          chosenChain = c;
          break;
        }
      }
    } else {
      chosenChain = chains[Math.floor(Math.random() * chains.length)];
    }

    const chainSteps = steps.filter((s: any) => s.chain_id === chosenChain.id);
    const bannedTerms = terms
      .filter((t: any) => t.term_type === 'banned_cliche')
      .map((t: any) => `"${t.term}"`);
    const craftTerms = terms
      .filter((t: any) => t.term_type !== 'banned_cliche')
      .slice(0, 5)
      .map((t: any) => `${t.term} (${t.definition_or_rule})`);

    const matchingExamples = examples.filter((e: any) => e.chain_id === chosenChain.id);
    const examplePool = matchingExamples.length > 0 ? matchingExamples : examples;
    const selectedExamples = examplePool.slice(0, 2);

    const isCustom = target === 'Custom Topic' || angle === 'Custom challenge';
    const lines: string[] = [
      chosenChain.persona_style ||
        'You are a sharp stand-up writer crafting punchy two-liner jokes for developers and students.',
      isCustom
        ? 'Write ONE biting, original two-part joke (setup + punchline) specifically about the user-submitted custom premise below.'
        : 'Write ONE biting, original two-part joke (setup + punchline) roasting the AI/tech scenario below.',
    ];

    if (chainSteps.length > 0) {
      lines.push('Prompt Chain Pipeline Steps:');
      chainSteps.forEach((s: any, idx: number) => {
        lines.push(`${idx + 1}. [${s.step_name}] ${s.instruction_template}`);
      });
    } else {
      lines.push(
        'Rules:',
        '1. Total joke length (setup + punchline combined) MUST be 15–42 words (1 setup sentence + 1 killer punchline sentence).',
        '2. Put the twist on the very last words of the punchline. Never explain the joke.',
        '3. First fill out `cliche_to_avoid` (under 8 words) and `comic_twist` (under 12 words), then write `setup` and `punchline`.'
      );
    }

    if (bannedTerms.length > 0) {
      lines.push(`BANNED clichés & puns (never use): ${bannedTerms.join(', ')}.`);
    }
    if (craftTerms.length > 0) {
      lines.push(`Optional comedy glossary / craft cues: ${craftTerms.join(' | ')}`);
    }
    if (selectedExamples.length > 0) {
      lines.push('Gold Few-Shot Reference Examples (match this sharpness and brevity; do NOT copy):');
      for (const ex of selectedExamples) {
        lines.push(`- Setup: ${ex.setup} / Punchline: ${ex.punchline}`);
      }
    }

    lines.push(
      'Never reveal which AI model wrote this joke.',
      `Scenario: ${JSON.stringify({ target, angle, scene: context, flavor: chosenChain.name })}`
    );

    const compiledPrompt = lines.join('\n').slice(0, 3900);
    return {
      prompt: compiledPrompt,
      chainId: chosenChain.id,
      chainName: chosenChain.name,
      openaiModelOverride: chosenOpenAi?.api_model,
      openaiMaxTokens: chosenOpenAi?.max_output_tokens,
      geminiModelOverride: chosenGemini?.api_model,
      geminiMaxTokens: chosenGemini?.max_output_tokens,
      disabledProviders,
    };
  } catch {
    return {
      prompt: buildPrompt(target, angle, context),
      chainId: null,
      chainName: 'Late-Night Stand-Up Roast',
    };
  }
}

export function parseJoke(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const value = JSON.parse(cleaned);
  if (
    typeof value.setup !== 'string' ||
    typeof value.punchline !== 'string' ||
    !value.setup.trim() ||
    !value.punchline.trim() ||
    value.setup.length > 800 ||
    value.punchline.length > 800
  )
    throw new Error('invalid_output');
  return {
    setup: value.setup.trim(),
    punchline: value.punchline.trim(),
    clicheToAvoid: typeof value.cliche_to_avoid === 'string' ? value.cliche_to_avoid.trim().slice(0, 160) : null,
    comicTwist: typeof value.comic_twist === 'string' ? value.comic_twist.trim().slice(0, 200) : null,
  };
}

export async function generateJoke(
  provider: 'openai' | 'gemini',
  prompt: string,
  modelOverride?: string,
  opts?: { maxTokens?: number; promptChainName?: string }
) {
  const start = Date.now();
  const rawModel = modelOverride || process.env[provider === 'openai' ? 'OPENAI_MODEL' : 'GEMINI_MODEL']!.trim();
  const modelList = rawModel
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const model = modelList[Math.floor(Math.random() * modelList.length)] || rawModel;
  const url =
    provider === 'openai'
      ? 'https://api.openai.com/v1/responses'
      : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider === 'openai') headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  else headers['x-goog-api-key'] = process.env.GEMINI_API_KEY!;

  const schema = {
    type: 'object',
    properties: {
      cliche_to_avoid: { type: 'string' },
      comic_twist: { type: 'string' },
      setup: { type: 'string' },
      punchline: { type: 'string' },
    },
    required: ['cliche_to_avoid', 'comic_twist', 'setup', 'punchline'],
    additionalProperties: false,
  };

  const body =
    provider === 'openai'
      ? {
          model,
          input: prompt,
          max_output_tokens: opts?.maxTokens && opts.maxTokens >= 100 ? opts.maxTokens : 450,
          reasoning: { effort: 'none' },
          store: false,
          text: { format: { type: 'json_schema', name: 'joke', strict: true, schema } },
        }
      : {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: opts?.maxTokens && opts.maxTokens >= 100 ? opts.maxTokens : 1000,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                cliche_to_avoid: { type: 'STRING' },
                comic_twist: { type: 'STRING' },
                setup: { type: 'STRING' },
                punchline: { type: 'STRING' },
              },
              required: ['cliche_to_avoid', 'comic_twist', 'setup', 'punchline'],
            },
            thinkingConfig: { thinkingLevel: 'MINIMAL' },
          },
        };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
      cache: 'no-store',
    });
  } catch (err) {
    const code = err instanceof Error && ['TimeoutError', 'AbortError'].includes(err.name) ? 'timeout' : 'network';
    throw new ProviderError(provider, code, {
      latencyMs: Date.now() - start,
      attemptedModel: model,
    });
  }

  const latencyMs = Date.now() - start;
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new ProviderError(provider, String(response.status), {
      httpStatus: response.status,
      latencyMs,
      attemptedModel: model,
      rawResponseText: errBody.slice(0, 2000),
    });
  }

  const data = await response.json();
  let text = '';
  if (provider === 'openai') {
    if (data.status !== 'completed') {
      throw new ProviderError(provider, 'incomplete', {
        httpStatus: response.status,
        latencyMs,
        attemptedModel: model,
        rawResponseText: JSON.stringify(data).slice(0, 2000),
      });
    }
    for (const output of data.output ?? [])
      for (const content of output.content ?? []) if (content.type === 'output_text') text += content.text;
  } else {
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') {
      throw new ProviderError(provider, 'incomplete', {
        httpStatus: response.status,
        latencyMs,
        attemptedModel: model,
        rawResponseText: JSON.stringify(data).slice(0, 2000),
      });
    }
    text = (candidate?.content?.parts ?? [])
      .filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? '')
      .join('');
  }

  const resolved = provider === 'openai' ? (data.model ?? model) : (data.modelVersion ?? model);
  const configVersion =
    'ai-roast-v3-' +
    createHash('sha256')
      .update(JSON.stringify({ provider, model, chain: opts?.promptChainName ?? 'default' }))
      .digest('hex')
      .slice(0, 10);

  let joke;
  try {
    joke = parseJoke(text);
  } catch {
    throw new ProviderError(provider, 'invalid_output', {
      httpStatus: response.status,
      latencyMs,
      attemptedModel: resolved,
      rawResponseText: text.slice(0, 2000),
    });
  }

  const usage = provider === 'openai' ? (data.usage ?? {}) : (data.usageMetadata ?? {});
  const inputTokens =
    provider === 'openai' ? (usage.input_tokens ?? null) : (usage.promptTokenCount ?? null);
  const outputTokens =
    provider === 'openai' ? (usage.output_tokens ?? null) : (usage.candidatesTokenCount ?? null);
  const reasoningTokens =
    provider === 'openai'
      ? (usage.output_tokens_details?.reasoning_tokens ?? 0)
      : (usage.thoughtsTokenCount ?? 0);

  return {
    ...joke,
    rawResponseText: text.slice(0, 4000),
    provider,
    model: resolved,
    name: provider === 'openai' ? 'GPT' : 'Gemini',
    configVersion,
    promptChainName: opts?.promptChainName ?? 'Late-Night Stand-Up Roast',
    usage,
    inputTokens,
    outputTokens,
    reasoningTokens,
    httpStatus: response.status,
    latencyMs,
    requestId: response.headers.get('x-request-id') ?? data.responseId ?? null,
  };
}
