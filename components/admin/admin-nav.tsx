'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconType } from 'react-icons';
import {
  FiBookOpen,
  FiCreditCard,
  FiSettings,
  FiUploadCloud,
  FiUsers,
} from 'react-icons/fi';

const NAV_LINKS: {
  href: string;
  label: string;
  icon: IconType;
  active: boolean;
  exact?: boolean;
  section?: 'Workspace' | 'Management';
}[] = [
  { href: '/admin/questions', label: 'Questions', icon: FiBookOpen, active: true, section: 'Workspace' },
  { href: '/admin/import-jobs', label: 'Imports', icon: FiUploadCloud, active: true },
  { href: '/admin/users', label: 'Users', icon: FiUsers, active: true, section: 'Management' },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: FiCreditCard, active: true },
  { href: '/admin/settings', label: 'Settings', icon: FiSettings, active: false },
];

export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="adm-nav">
      {NAV_LINKS.map((link, index) => {
        const Icon = link.icon;
        const sectionLabel = link.section ? (
          <span className="admin-cockpit-nav-label" key={`${link.href}-section`}>
            {link.section}
          </span>
        ) : null;

        if (!link.active) {
          return (
            <div key={link.href}>
              {sectionLabel}
              <span className="adm-nav-link off" title="Coming soon">
                <span className="mark"><Icon aria-hidden="true" /></span>
                <span>{link.label}</span>
                <small>Soon</small>
              </span>
            </div>
          );
        }

        const active = isActive(link.href, link.exact);
        return (
          <div key={link.href}>
            {sectionLabel}
            <Link
              href={link.href}
              className={`adm-nav-link${active ? ' on' : ''}`}
              style={{ '--admin-nav-index': index } as React.CSSProperties}
            >
              <span className="mark"><Icon aria-hidden="true" /></span>
              <span>{link.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
