import 'server-only';
import { createHash } from 'node:crypto';

export class ProviderError extends Error {
  provider: string;
  code: string;
  constructor(provider: string, code: string) {
    super(`${provider}_${code}`);
    this.provider = provider;
    this.code = code;
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
  return { setup: value.setup.trim(), punchline: value.punchline.trim() };
}

export async function generateJoke(provider: 'openai' | 'gemini', prompt: string, modelOverride?: string) {
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
          max_output_tokens: 400,
          reasoning: { effort: 'none' },
          store: false,
          text: { format: { type: 'json_schema', name: 'joke', strict: true, schema } },
        }
      : {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1000,
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

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
    cache: 'no-store',
  });
  if (!response.ok) throw new ProviderError(provider, String(response.status));
  const data = await response.json();
  let text = '';
  if (provider === 'openai') {
    if (data.status !== 'completed') throw new ProviderError(provider, 'incomplete');
    for (const output of data.output ?? [])
      for (const content of output.content ?? []) if (content.type === 'output_text') text += content.text;
  } else {
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new ProviderError(provider, 'incomplete');
    text = (candidate?.content?.parts ?? [])
      .filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? '')
      .join('');
  }
  const resolved = provider === 'openai' ? (data.model ?? model) : (data.modelVersion ?? model);
  const configVersion =
    'ai-roast-v2-' +
    createHash('sha256')
      .update(JSON.stringify({ provider, model, limit: 400 }))
      .digest('hex')
      .slice(0, 10);
  let joke;
  try {
    joke = parseJoke(text);
  } catch {
    throw new ProviderError(provider, 'invalid_output');
  }
  return {
    ...joke,
    provider,
    model: resolved,
    name: provider === 'openai' ? 'GPT' : 'Gemini',
    configVersion,
    usage: provider === 'openai' ? (data.usage ?? {}) : (data.usageMetadata ?? {}),
    latencyMs: Date.now() - start,
    requestId: response.headers.get('x-request-id') ?? data.responseId ?? null,
  };
}
