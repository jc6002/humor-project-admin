import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
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
