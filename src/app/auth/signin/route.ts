import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? reqUrl.origin
      : `${forwardedProto}://${forwardedHost}`;

  const nextParam = reqUrl.searchParams.get("next");
  let safeNext: string | null = null;
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\")) {
    try {
      const candidate = new URL(nextParam, origin);
      if (candidate.origin === new URL(origin).origin) {
        safeNext = candidate.pathname + candidate.search;
      }
    } catch {
      safeNext = null;
    }
  }
  const callbackUrl = new URL("/auth/callback", origin);
  if (safeNext) {
    callbackUrl.searchParams.set("next", safeNext);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (error || !data.url) {
      throw error ?? new Error("No OAuth URL was returned.");
    }

    return NextResponse.redirect(data.url);
  } catch {
    const fallback = new URL("/", origin);
    fallback.searchParams.set("authError", "signin");
    return NextResponse.redirect(fallback);
  }
}
