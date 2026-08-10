'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/practice': 'Practice',
  '/mock': 'Mock Test',
  '/qod': 'Daily Question',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

function titleFor(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  const base = `/${pathname.split('/')[1] ?? ''}`;
  return TITLES[base] ?? 'Taleem SAT';
}

export function AppTopbar({
  onMenuClick,
  user,
}: {
  onMenuClick: () => void;
  user: { initials: string; points: number; streak: number };
}) {
  const pathname = usePathname();

  return (
    <header className="app-tb">
      <button
        type="button"
        className="tb-menu-btn"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu size={18} strokeWidth={2} />
      </button>

      <h1 className="tb-title">{titleFor(pathname)}</h1>

      <div className="tb-right">
        <span className="tb-pill streak" title="Day streak">
          <strong>{user.streak}</strong> day{user.streak === 1 ? '' : 's'}
        </span>
        <span className="tb-pill points" title="Points earned">
          <strong>{user.points}</strong> pts
        </span>
        <ThemeToggle />
        <Link href="/settings" className="tb-avatar" title="Settings">
          {user.initials}
        </Link>
      </div>
    </header>
  );
}
