'use client';

import { AppMenuButton } from '@/components/app-menu-button';

/**
 * Mobile-only menu trigger. Desktop has no top chrome — every page owns its
 * own heading, and theme lives in the sidebar (see AppSidebar). This bar
 * only renders visibly under the 900px breakpoint (app-tb CSS),
 * where the sidebar becomes an off-canvas drawer that needs a trigger.
 */
export function AppTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="app-tb">
      <AppMenuButton onClick={onMenuClick} />
    </header>
  );
}
