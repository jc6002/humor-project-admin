import Link from 'next/link';
import { checkSuperadmin, fetchAdminDashboardData } from '@/lib/admin/server';
import { AdminDashboard } from '@/components/admin-dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  const [{ authError }, gate] = await Promise.all([searchParams, checkSuperadmin()]);

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link href="/" className="brand">
          <span className="brand-mark">ai</span>
          <span>
            joke arena admin<span className="brand-dot">.</span>
          </span>
        </Link>

        {gate.status !== 'unauthenticated' ? (
          <div className="account-actions">
            <span className="meta-label">{gate.user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-button" type="submit">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <a className="button button-small" href="/auth/signin">
            Sign in with Google ↗
          </a>
        )}
      </header>

      <main>
        {authError === 'domain_restricted' && (
          <p className="error-message" role="alert" style={{ marginTop: 22 }}>
            Sign-in restricted: your account’s email domain is not in the Allowed Signup Domains list or Whitelisted E-mail Addresses.
          </p>
        )}
        {authError === 'signin' && (
          <p className="error-message" role="alert" style={{ marginTop: 22 }}>
            Google sign-in could not be started right now. Please try again.
          </p>
        )}
        {gate.status === 'unauthenticated' ? (
          <div className="battle-empty" style={{ maxWidth: 640, margin: '60px auto' }}>
            <span className="versus">🔒</span>
            <h2>Admin Area · Google Login Required</h2>
            <p>
              Every route in the AI Joke Arena Admin Panel is protected behind Google OAuth and requires{' '}
              <code>profiles.is_superadmin == TRUE</code>.
            </p>
            <a className="button" href="/auth/signin">
              Sign in with Google ↗
            </a>
          </div>
        ) : gate.status === 'forbidden' ? (
          <div className="battle-empty" style={{ maxWidth: 720, margin: '60px auto' }}>
            <span className="versus">403</span>
            <h2>Access Denied: Superadmin Required</h2>
            <p>
              You are signed in as <strong>{gate.user.email}</strong> (<code>{gate.user.id}</code>), but your profile has{' '}
              <code>profiles.is_superadmin == FALSE</code>.
            </p>
            <div className="admin-panel-box" style={{ textAlign: 'left', width: '100%' }}>
              <p className="eyebrow">HOW TO BOOTSTRAP YOUR ACCOUNT (SUPABASE SQL EDITOR)</p>
              <pre style={{ overflowX: 'auto', fontSize: 13 }}>
                {`UPDATE public.profiles\nSET is_superadmin = TRUE\nWHERE id = '${gate.user.id}';`}
              </pre>
            </div>
          </div>
        ) : (
          <AdminContent user={gate.user} />
        )}
      </main>
      <footer className="site-footer">
        <span>AI Joke Arena · Superadmin Observability Console</span>
        <span>The Humor Project · Week 7</span>
        <span>Protected by Google OAuth + profiles.is_superadmin</span>
      </footer>
    </div>
  );
}

async function AdminContent({ user }: { user: { id: string; email: string } }) {
  const data = await fetchAdminDashboardData();
  return <AdminDashboard adminUser={user} initialData={data} />;
}
