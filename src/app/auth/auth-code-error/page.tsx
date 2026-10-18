import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f0e5] px-5 text-[#1d1d1b]">
      <section className="w-full max-w-xl rounded-[2rem] border border-black/15 bg-white/70 p-8 shadow-[0_20px_70px_rgba(37,32,22,0.08)] sm:p-12">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-[#e24d2a]">
          Authentication note
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em]">
          That sign-in did not land.
        </h1>
        <p className="mt-4 leading-7 text-black/60">
          The login link may have expired or the OAuth redirect is not configured yet.
          Try again from the home page.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-[#1d1d1b] px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white"
        >
          Back to the Laugh List
        </Link>
      </section>
    </main>
  );
}
