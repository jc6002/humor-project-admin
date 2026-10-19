import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv, hasSupabaseEnv } from '@/lib/supabase/env';
import type { PublicArena } from './types';

export async function publicArena(): Promise<{ data: PublicArena; available: boolean }> {
  const empty: PublicArena = { models: [], topJokes: [], stats: { battles: 0, votes: 0, open: 0 } };
  if (!hasSupabaseEnv()) return { data: empty, available: false };
  const db = await createClient();
  const { data, error } = await db.rpc('arena_public');
  return { data: error ? empty : data, available: !error };
}

export function adminClient() {
  const { url } = getSupabaseEnv();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Generation is not configured yet.');
  return createSupabaseClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function session() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error('Sign in to continue.');
  return { db, user };
}

export function checkOrigin(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    throw new Error('JSON is required.');
  }
  const origin = request.headers.get('origin');
  if (!origin) return;
  const originHost = new URL(origin).host;
  const reqHost =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    new URL(request.url).host;
  if (originHost !== reqHost) {
    throw new Error('Request origin is not allowed.');
  }
}

export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  return Response.json(
    { error: message },
    { status: message.startsWith('Sign in') ? 401 : 400, headers: { 'Cache-Control': 'no-store' } }
  );
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
