'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: '▦', active: true, exact: true },
  { href: '/admin/questions', label: 'Questions', icon: '❓', active: true },
  { href: '/admin/qod', label: 'Daily Question', icon: '⭐', active: true },
  { href: '/admin/users', label: 'Users', icon: '👥', active: false },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: '💳', active: false },
  { href: '/admin/settings', label: 'Settings', icon: '⚙', active: false },
];

export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_LINKS.map(link => {
        if (!link.active) {
          return (
            <span
              key={link.href}
              className="flex items-center gap-2.5 px-3 py-2 text-sm rounded cursor-not-allowed"
              style={{ color: 'var(--muted)' }}
              title="Coming soon"
            >
              <span className="w-4 text-center opacity-60">{link.icon}</span>
              {link.label}
            </span>
          );
        }

        const active = isActive(link.href, link.exact);
        return (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-2.5 px-3 py-2 text-sm rounded transition-colors"
            style={
              active
                ? { background: 'color-mix(in srgb, var(--green) 14%, transparent)', color: 'var(--green)', fontWeight: 600 }
                : { color: 'var(--txt-soft)' }
            }
          >
            <span className="w-4 text-center">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
