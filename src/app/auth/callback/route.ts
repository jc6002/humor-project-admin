import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/arena/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? requestUrl.origin
      : `${forwardedProto}://${forwardedHost}`;

  if (!code) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("oauth_exchange_failed", {
      name: error?.name,
      code: error?.code,
      status: error?.status,
      missingVerifier: error?.message.toLowerCase().includes("verifier"),
    });
    return NextResponse.redirect(new URL("/auth/auth-code-error", origin));
  }

  // Enforce Allowed Signup Domains & Whitelisted E-mail Addresses if configured
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && data.user.email) {
    try {
      const admin = adminClient();
      const emailLower = data.user.email.toLowerCase();
      const domain = emailLower.split("@")[1] ?? "";

      const [{ data: domains }, { data: whitelist }] = await Promise.all([
        admin.from("allowed_signup_domains").select("domain").eq("is_active", true),
        admin
          .from("whitelisted_emails")
          .select("email, auto_superadmin")
          .eq("is_active", true),
      ]);

      const whitelistedEntry = (whitelist ?? []).find(
        (w: any) => String(w.email).toLowerCase() === emailLower
      );

      if (domains && domains.length > 0 && !whitelistedEntry) {
        const domainAllowed = domains.some((d: any) => {
          const clean = String(d.domain).toLowerCase().replace(/^@/, "");
          return domain === clean || domain.endsWith(`.${clean}`);
        });

        if (!domainAllowed) {
          await supabase.auth.signOut();
          const deniedUrl = new URL("/", origin);
          deniedUrl.searchParams.set("authError", "domain_restricted");
          return NextResponse.redirect(deniedUrl);
        }
      }

      if (whitelistedEntry?.auto_superadmin) {
        await admin
          .from("profiles")
          .upsert(
            { id: data.user.id, email: data.user.email, is_superadmin: true },
            { onConflict: "id" }
          );
      }
    } catch {
      // Allow login if access-control tables are not yet migrated
    }
  }

  const nextParam = requestUrl.searchParams.get("next");
  let targetUrl = new URL("/", origin);
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\")) {
    try {
      const candidate = new URL(nextParam, origin);
      if (candidate.origin === new URL(origin).origin) {
        targetUrl = candidate;
      }
    } catch {
      // keep default targetUrl
    }
  }

  return NextResponse.redirect(targetUrl);
}
