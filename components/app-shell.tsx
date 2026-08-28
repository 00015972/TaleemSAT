'use client';

import { useEffect, useState } from 'react';
import { APP_MENU_OPEN_EVENT } from '@/components/app-menu-button';
import { AppSidebar } from '@/components/app-sidebar';
import { AppTopbar } from '@/components/app-topbar';

export type AppShellUser = {
  name: string;
  email: string;
  initials: string;
  points: number;
  streak: number;
};

export function AppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function openMobileMenu() {
      setMobileOpen(true);
    }

    window.addEventListener(APP_MENU_OPEN_EVENT, openMobileMenu);
    return () => window.removeEventListener(APP_MENU_OPEN_EVENT, openMobileMenu);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  return (
    <div className="app-shell" data-mobile-open={mobileOpen}>
      <div
        className="sb-backdrop"
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <AppSidebar
        onNavigate={() => setMobileOpen(false)}
        onCloseMobile={() => setMobileOpen(false)}
        user={user}
      />
      <div className="app-main">
        <AppTopbar onMenuClick={() => setMobileOpen(true)} />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
