import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export async function ArenaNav() {
  const db = hasSupabaseEnv() ? await createClient() : null;
  const user = db ? (await db.auth.getUser()).data.user : null;

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-mark">ai</span>
        <span>
          joke arena<span className="brand-dot">.</span>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/">Rankings &amp; Showcase</Link>
        <Link href="/arena">Blind Arena</Link>
        {user && <Link href="/my-battles">My Battles</Link>}
      </nav>
      {user ? (
        <div className="account-actions">
          <span className="avatar-link" title={user.email ?? 'Signed in'}>
            {(user.email ?? 'U').slice(0, 1).toUpperCase()}
          </span>
          <form action="/auth/signout" method="post">
            <button className="text-button" type="submit">
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <a className="button button-small" href="/auth/signin">
          Sign in ↗
        </a>
      )}
    </header>
  );
}

export function ArenaFooter() {
  return (
    <footer className="site-footer">
      <span>AI writes. Humans decide.</span>
      <span>The Humor Project · Week 6</span>
      <Link href="/arena" className="text-link" style={{ fontSize: 12 }}>
        Enter Blind Arena ↗
      </Link>
    </footer>
  );
}
