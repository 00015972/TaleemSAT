import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getAppProfile, getClaimsUser } from '@/lib/supabase/server';
import { AdminNav } from '@/components/admin/admin-nav';
import { SignOutButton } from '@/components/sign-out-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { FiArrowUpRight, FiLogOut, FiMenu, FiSearch } from 'react-icons/fi';

export const metadata = { title: 'Admin — Taleem SAT' };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, profile] = await Promise.all([getClaimsUser(), getAppProfile()]);

  // proxy.ts already forces login, but guard here too.
  if (!user) redirect('/login');

  // Role gate: non-admins get a 404 — we don't acknowledge the route exists.
  if (profile?.role !== 'admin') notFound();

  const name = (profile.full_name as string | null) ?? user.email ?? 'Admin';
  const initials = name
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="admin-cockpit-shell">
      <div className="admin-cockpit-signal" aria-hidden="true" />

      <header className="admin-cockpit-topbar">
        <div className="admin-cockpit-brand-wrap">
          <details className="admin-cockpit-mobile-nav">
            <summary aria-label="Open admin navigation">
              <FiMenu aria-hidden="true" />
            </summary>
            <div className="admin-cockpit-mobile-nav-panel">
              <AdminNav />
            </div>
          </details>

          <Link href="/admin/questions" className="admin-cockpit-brand">
            Taleem<span>SAT</span>
            <small>Admin</small>
          </Link>
        </div>

        <form action="/admin/questions" method="get" className="admin-cockpit-command">
          <FiSearch aria-hidden="true" />
          <label htmlFor="admin-question-search" className="sr-only">
            Search questions
          </label>
          <input
            id="admin-question-search"
            name="q"
            type="search"
            placeholder="Find a question by text or source ID…"
          />
          <span aria-hidden="true">↵</span>
        </form>

        <div className="admin-cockpit-account">
          <Link href="/dashboard" className="admin-cockpit-back-link">
            Back to app
            <FiArrowUpRight aria-hidden="true" />
          </Link>
          <div className="admin-cockpit-user">
            <span className="admin-cockpit-avatar" aria-hidden="true">{initials}</span>
            <span className="admin-cockpit-user-copy">
              <strong>{name}</strong>
              <small>Administrator</small>
            </span>
          </div>
          <span className="admin-cockpit-theme"><ThemeToggle /></span>
          <SignOutButton className="admin-cockpit-signout">
            <FiLogOut aria-hidden="true" />
            <span>Sign out</span>
          </SignOutButton>
        </div>
      </header>

      <div className="admin-cockpit-body">
        <aside className="admin-cockpit-sidebar">
          <div className="admin-cockpit-sidebar-inner">
            <AdminNav />
            <div className="admin-cockpit-sidebar-note">
              <span className="admin-cockpit-status-dot" aria-hidden="true" />
              <div>
                <strong>Systems operational</strong>
                <small>Content workspace online</small>
              </div>
            </div>
          </div>
        </aside>

        <main className="admin-cockpit-main">{children}</main>
      </div>
    </div>
  );
}
