'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import {
  BarChart3,
  ChevronsLeft,
  LayoutGrid,
  LogOut,
  SlidersHorizontal,
  Timer,
  X,
} from 'lucide-react';
import { SignOutButton } from '@/components/sign-out-button';
import { ThemeToggle } from '@/components/theme-toggle';

const SB_COLLAPSE_KEY = 'taleem_sb_collapsed';

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  icon: () => React.ReactElement;
  /** brand-tinted icon chip; primary nav only, alternated for rhythm */
  chip?: 'green' | 'gold';
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', exact: true, icon: IconGrid, chip: 'green' },
  { href: '/question-bank', label: 'Question Bank', icon: IconBubble, chip: 'gold' },
  { href: '/mock', label: 'Mock Test', icon: IconClock, chip: 'green' },
  { href: '/analytics', label: 'Analytics', icon: IconChart, chip: 'green' },
];

const UTIL_ITEMS: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: IconSliders },
];

function subscribeCollapsed(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-sb-collapsed'],
  });
  return () => observer.disconnect();
}

function getCollapsedSnapshot() {
  return document.documentElement.getAttribute('data-sb-collapsed') === 'true';
}

function getCollapsedServerSnapshot() {
  return false;
}

function toggleCollapsed() {
  const next = document.documentElement.getAttribute('data-sb-collapsed') !== 'true';
  document.documentElement.setAttribute('data-sb-collapsed', String(next));
  try {
    localStorage.setItem(SB_COLLAPSE_KEY, String(next));
  } catch {
    // localStorage unavailable (private mode) — collapse state just won't persist
  }
}

export function AppSidebar({
  onNavigate,
  onCloseMobile,
  user,
}: {
  onNavigate: () => void;
  onCloseMobile: () => void;
  user: { name: string; email: string; initials: string };
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  );

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="app-sb">
      <div className="sb-head">
        <Link href="/dashboard" className="sb-logo" onClick={onNavigate}>
          <span className="sb-logo-mark" aria-hidden="true">
            <Image src="/logo.jpg" alt="" width={40} height={40} priority />
          </span>
          <span className="sb-logo-text">
            Taleem<em>SAT</em>
          </span>
        </Link>
        <button
          type="button"
          className="sb-collapse-btn"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronsLeft size={18} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="sb-close-btn"
          onClick={onCloseMobile}
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="sb-nav-scroll">
        <nav className="sb-nav" aria-label="Primary">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={item.label}
                className={`sb-link${active ? ' on' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className={`sb-ico-chip${item.chip === 'gold' ? ' gold' : ''}`}
                  aria-hidden="true"
                >
                  <Icon />
                </span>
                <span className="sb-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sb-div" />
        <nav className="sb-nav" aria-label="Account">
          {UTIL_ITEMS.map(item => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={item.label}
                className={`sb-link${active ? ' on' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="sb-ico" aria-hidden="true">
                  <Icon />
                </span>
                <span className="sb-label">{item.label}</span>
              </Link>
            );
          })}
          <ThemeToggle variant="row" />
        </nav>
      </div>

      <div className="sb-foot">
        <Link
          href="/settings"
          className="sb-account"
          onClick={onNavigate}
          title={`${user.name} — ${user.email}`}
        >
          <span className="sb-avatar" aria-hidden="true">
            {user.initials}
          </span>
          <span className="sb-account-info">
            <span className="sb-account-name">{user.name}</span>
            <span className="sb-account-email">{user.email}</span>
          </span>
        </Link>
        <SignOutButton className="sb-logout">
          <span className="sb-ico" aria-hidden="true">
            <IconLogOut />
          </span>
          <span className="sb-label">Sign out</span>
        </SignOutButton>
      </div>
    </aside>
  );
}

/* Library icons, sized/weighted to match the sidebar's line weight */
function IconGrid() {
  return <LayoutGrid size={18} strokeWidth={1.75} />;
}
function IconClock() {
  return <Timer size={18} strokeWidth={1.75} />;
}
function IconChart() {
  return <BarChart3 size={18} strokeWidth={1.75} />;
}
function IconSliders() {
  return <SlidersHorizontal size={18} strokeWidth={1.75} />;
}
function IconLogOut() {
  return <LogOut size={18} strokeWidth={1.75} />;
}

/* Custom — the SAT answer-bubble metaphor used throughout the app.
   Kept hand-drawn rather than swapped for a library icon: this is the
   one icon that says "Taleem SAT" specifically, not "any prep app". */
function IconBubble() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
