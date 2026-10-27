export type GenerationRow = {
  id: string;
  battle_id: string;
  model_name: string;
  model_version: string;
  target: string;
  angle: string;
  context: string;
  status: string;
  votes: number;
  setup: string;
  punchline: string;
  cliche_to_avoid?: string | null;
  comic_twist?: string | null;
  prompt_chain_name?: string | null;
  usage?: Record<string, any>;
  latency_ms: number | null;
  created_at: string | null;
};

export type GenerationRequestRow = {
  id: string;
  request_id: string;
  user_id: string;
  requester_email: string;
  target: string;
  angle: string;
  context: string;
  prompt: string;
  prompt_chain_name: string;
  status: string;
  error_code: string | null;
  votes: number;
  created_at: string;
  completed_at: string | null;
};

export type LlmResponseRow = {
  id: string;
  battle_id: string | null;
  generation_id: string | null;
  request_id: string | null;
  provider: string;
  model: string;
  prompt_chain_name: string | null;
  prompt_text: string;
  raw_response_text: string | null;
  parsed_cliche_to_avoid: string | null;
  parsed_comic_twist: string | null;
  parsed_setup: string | null;
  parsed_punchline: string | null;
  status: 'success' | 'error' | string;
  http_status: number | null;
  error_message: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  provider_request_id: string | null;
  usage: Record<string, any>;
  created_at: string;
};

export type PromptChainRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  persona_style: string;
  mix_weight: number;
  is_active: boolean;
};

export type PromptChainStepRow = {
  id: string;
  chain_id: string;
  step_order: number;
  step_name: string;
  step_role: string;
  instruction_template: string;
  output_field: string | null;
};

export type ComedyTermRow = {
  id: string;
  term: string;
  term_type: 'banned_cliche' | 'tech_glossary' | 'campus_slang' | 'punchline_device' | string;
  definition_or_rule: string;
  is_active: boolean;
  created_at: string;
};

export type GenerationExampleRow = {
  id: string;
  chain_id: string | null;
  topic: string;
  angle: string;
  premise: string;
  setup: string;
  punchline: string;
  why_it_works: string;
  is_active: boolean;
  created_at: string;
};

export type LlmProviderRow = {
  id: string;
  slug: string;
  name: string;
  api_base_url: string;
  protocol: string;
  api_key_env: string;
  is_enabled: boolean;
  created_at: string;
};

export type LlmModelRow = {
  id: string;
  provider: string;
  provider_id?: string | null;
  api_model: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
  bad: number;
  is_enabled: boolean;
  max_output_tokens: number;
};

export type AllowedDomainRow = {
  id: string;
  domain: string;
  description: string;
  is_active: boolean;
  created_at: string;
};

export type WhitelistedEmailRow = {
  id: string;
  email: string;
  note: string;
  auto_superadmin: boolean;
  is_active: boolean;
  created_at: string;
};

export async function callEntityApi(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, any>) {
  const res = await fetch('/api/admin/entities', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Admin request failed.');
  return data;
}
