import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";

type ProfilePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?login=required");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const welcome = params.welcome === "1";
  const saved = params.saved === "1";
  const error = typeof params.error === "string" ? params.error : null;
  const initials = `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}` || "?";

  return (
    <main className="min-h-screen bg-[#f5f0e5] px-5 py-8 text-[#1d1d1b] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-black/15 pb-5">
          <Link href="/" className="font-mono text-xs font-bold uppercase tracking-[0.24em]">
            AI Joke Arena
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/arena" className="nav-pill">Enter the arena</Link>
            <form action="/auth/signout" method="post">
              <button className="nav-pill" type="submit">Sign out</button>
            </form>
          </div>
        </nav>

        <header className="grid gap-8 border-b border-black/15 py-12 md:grid-cols-[0.55fr_1fr] md:items-end md:py-16">
          <div
            aria-label="Profile photo"
            role="img"
            className="grid aspect-square w-full max-w-72 place-items-center rounded-[2rem] border border-black/15 bg-[#6552d9] bg-cover bg-center text-7xl font-semibold text-white shadow-[0_20px_60px_rgba(61,47,154,0.2)]"
            style={profile?.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}
          >
            {!profile?.avatar_url && initials.toUpperCase()}
          </div>
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[#e24d2a]">
              Human profile
            </p>
            <h1 className="mt-4 text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">
              Tune your parameters.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-black/60">
              Tell the model what to call you, then add a human-approved profile photo if you like.
            </p>
          </div>
        </header>

        <section className="grid gap-8 py-10 md:grid-cols-[0.55fr_1fr]">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-black/45">Signed in as</p>
            <p className="mt-2 break-all text-lg font-medium">{user.email}</p>
            <p className="mt-5 text-sm leading-6 text-black/50">Photos must be JPG, PNG, GIF, or WebP and under 5 MB.</p>
          </div>

          <div className="rounded-[1.75rem] border border-black/15 bg-white/65 p-6 shadow-[0_18px_50px_rgba(37,32,22,0.06)] sm:p-8">
            {welcome && (
              <Notice tone="welcome">Add your name, then head to the arena to judge some AI roasts.</Notice>
            )}
            {saved && <Notice tone="success">Profile saved. You’re ready for the arena.</Notice>}
            {error && <Notice tone="error">{error}</Notice>}

            <form action={updateProfile} className="mt-2 grid gap-6" encType="multipart/form-data">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="First name" name="first_name" defaultValue={profile?.first_name ?? ""} />
                <Field label="Last name" name="last_name" defaultValue={profile?.last_name ?? ""} />
              </div>
              <label className="grid gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-black/55">
                Profile photo
                <input
                  type="file"
                  name="avatar"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="rounded-2xl border border-black/15 bg-[#f8f5ee] px-4 py-3 font-sans text-sm font-normal normal-case tracking-normal file:mr-4 file:rounded-full file:border-0 file:bg-[#f1d36b] file:px-4 file:py-2 file:font-mono file:text-[10px] file:font-bold file:uppercase file:tracking-[0.14em]"
                />
              </label>
              <button type="submit" className="justify-self-start rounded-full bg-[#1d1d1b] px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.17em] text-white transition hover:-translate-y-0.5 hover:bg-[#6552d9]">
                Save profile
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="grid gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-black/55">
      {label}
      <input
        required
        maxLength={80}
        name={name}
        defaultValue={defaultValue}
        className="rounded-2xl border border-black/15 bg-[#f8f5ee] px-4 py-3.5 font-sans text-base font-normal normal-case tracking-normal outline-none transition focus:border-[#6552d9] focus:ring-2 focus:ring-[#6552d9]/20"
      />
    </label>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "welcome" | "success" | "error" }) {
  const styles = {
    welcome: "border-[#6552d9]/25 bg-[#6552d9]/10 text-[#4433aa]",
    success: "border-emerald-700/20 bg-emerald-100/70 text-emerald-900",
    error: "border-[#e24d2a]/25 bg-[#e24d2a]/10 text-[#9f3219]",
  };
  return <p className={`mb-6 rounded-2xl border px-4 py-3 text-sm leading-6 ${styles[tone]}`}>{children}</p>;
}
