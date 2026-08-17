'use client';

import { Menu } from 'lucide-react';

/**
 * Mobile-only menu trigger. Desktop has no top chrome — every page owns its
 * own heading, and streak/points/theme live in the sidebar (see AppSidebar).
 * This bar only renders visibly under the 900px breakpoint (app-tb CSS),
 * where the sidebar becomes an off-canvas drawer that needs a trigger.
 */
export function AppTopbar({ onMenuClick }: { onMenuClick: () => void }) {
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
    </header>
  );
}
