import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { ThemeToggle } from '@/components/theme-toggle';
import { SignOutButton } from '@/components/sign-out-button';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', active: true },
  { href: '/practice', label: 'Practice', active: true },
  { href: '/qod', label: 'Daily Question', active: false },
  { href: '/analytics', label: 'Analytics', active: false },
];

export function AppNav({ user }: { user: User }) {
  const name: string =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || (user.email?.slice(0, 2).toUpperCase() ?? '??');

  return (
    <header
      className="sticky top-0 z-40"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--surf)' }}
    >
      <div className="wrap flex items-center justify-between h-14 gap-4">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="font-serif font-bold text-lg shrink-0"
          style={{ color: 'var(--green)' }}
        >
          Taleem SAT
        </Link>

        {/* Nav links — desktop only */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map(link => (
            link.active ? (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm rounded transition-colors hover:bg-surf2"
                style={{ color: 'var(--txt-soft)' }}
              >
                {link.label}
              </Link>
            ) : (
              <span
                key={link.href}
                className="px-3 py-1.5 text-sm rounded cursor-not-allowed"
                style={{ color: 'var(--muted)' }}
                title="Coming soon"
              >
                {link.label}
              </span>
            )
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/settings"
            className="hidden md:flex w-8 h-8 rounded-full items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'var(--green)', color: '#fff' }}
            title={`Settings — ${name}`}
          >
            {initials}
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
