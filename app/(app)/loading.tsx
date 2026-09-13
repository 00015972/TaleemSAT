import { AppMenuButton } from '@/components/app-menu-button';

/**
 * Shown inside AppShell while a page segment under (app) is still fetching
 * its data — Next.js swaps this in automatically via the Suspense boundary
 * this file creates around `{children}` in the layout. Without it, the
 * browser shows nothing/frozen content for the full server round-trip.
 *
 * Carries its own AppMenuButton (matching every real page's inline one) so
 * the shared .app-tb header can stay hidden for the whole loading window
 * instead of flashing in until the real page mounts.
 */
export default function AppLoading() {
  return (
    <div className="app-route-loading" aria-busy="true" aria-label="Loading page">
      <div className="app-route-loading-inner">
        <div className="app-route-loading-heading">
          <div className="app-route-loading-kicker-row">
            <AppMenuButton />
            <div className="app-route-loading-kicker" />
          </div>
          <div className="app-route-loading-title" />
          <div className="app-route-loading-copy" />
        </div>
        <div className="app-route-loading-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="app-route-loading-card">
              <div className="app-route-loading-card-icon" />
              <div className="app-route-loading-line short" />
              <div className="app-route-loading-line" />
              <div className="app-route-loading-line tiny" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
