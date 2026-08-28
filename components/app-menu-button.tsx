'use client';

import { Menu } from 'lucide-react';

export const APP_MENU_OPEN_EVENT = 'taleem:open-mobile-menu';

export function AppMenuButton({
  onClick,
  className = '',
}: {
  onClick?: () => void;
  className?: string;
}) {
  function openMenu() {
    if (onClick) {
      onClick();
      return;
    }

    window.dispatchEvent(new Event(APP_MENU_OPEN_EVENT));
  }

  return (
    <button
      type="button"
      className={`tb-menu-btn ${className}`.trim()}
      onClick={openMenu}
      aria-label="Open menu"
    >
      <Menu size={18} strokeWidth={2} />
    </button>
  );
}
