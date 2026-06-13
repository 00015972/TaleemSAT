'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/admin', label: 'Operations', active: true, exact: true },
  { href: '/admin/questions', label: 'Questions', active: true },
  { href: '/admin/qod', label: 'Daily Question', active: true },
  { href: '/admin/users', label: 'Users', active: true },
  { href: '/admin/subscriptions', label: 'Subscriptions', active: true },
  { href: '/admin/settings', label: 'Settings', active: false },
];

export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="adm-nav">
      {NAV_LINKS.map(link => {
        if (!link.active) {
          return (
            <span key={link.href} className="adm-nav-link off" title="Coming soon">
              <span className="mark" />
              {link.label}
            </span>
          );
        }

        const active = isActive(link.href, link.exact);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`adm-nav-link${active ? ' on' : ''}`}
          >
            <span className="mark" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
