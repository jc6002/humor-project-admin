import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/auth/auth-code-error', requestUrl.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error('oauth_exchange_failed', {
      name: error?.name,
      code: error?.code,
      status: error?.status,
      missingVerifier: error?.message.toLowerCase().includes('verifier'),
    });
    return NextResponse.redirect(new URL('/auth/auth-code-error', requestUrl.origin));
  }

  const nextParam = requestUrl.searchParams.get('next');
  const destination = nextParam && nextParam.startsWith('/') ? nextParam : '/';

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const origin =
    process.env.NODE_ENV === 'development' || !forwardedHost
      ? requestUrl.origin
      : `${forwardedProto}://${forwardedHost}`;

  return NextResponse.redirect(new URL(destination, origin));
}
