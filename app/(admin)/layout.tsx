import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AdminNav } from '@/components/admin/admin-nav';
import { SignOutButton } from '@/components/sign-out-button';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata = { title: 'Admin — Taleem SAT' };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already forces login, but guard here too.
  if (!user) redirect('/login');

  // Role gate: non-admins get a 404 — we don't acknowledge the route exists.
  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') notFound();

  const name = (profile.full_name as string | null) ?? user.email ?? 'Admin';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Gold bar — unmistakable "you are in admin" signal */}
      <div style={{ height: 3, background: 'var(--gold)' }} />

      {/* Top bar */}
      <header
        className="sticky top-0 z-40"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surf)' }}
      >
        <div className="flex items-center justify-between h-14 px-4 gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="font-serif font-bold text-lg"
              style={{ color: 'var(--green)' }}
            >
              Taleem SAT
            </Link>
            <span
              className="text-[0.6rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                background: 'color-mix(in srgb, var(--gold) 18%, transparent)',
                color: 'var(--gold-d)',
              }}
            >
              Admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm hidden sm:inline transition-colors"
              style={{ color: 'var(--txt-soft)' }}
            >
              ← Back to app
            </Link>
            <span className="text-sm hidden md:inline" style={{ color: 'var(--muted)' }}>
              {name}
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1">
        <aside
          className="w-56 shrink-0 hidden md:block"
          style={{ borderRight: '1px solid var(--border)', background: 'var(--surf)' }}
        >
          <div className="sticky top-14">
            <AdminNav />
          </div>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
