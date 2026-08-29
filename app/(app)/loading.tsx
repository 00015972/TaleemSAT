/**
 * Shown inside AppShell while a page segment under (app) is still fetching
 * its data — Next.js swaps this in automatically via the Suspense boundary
 * this file creates around `{children}` in the layout. Without it, the
 * browser shows nothing/frozen content for the full server round-trip.
 */
export default function AppLoading() {
  return (
    <div className="wrap py-5" aria-busy="true" aria-label="Loading">
      <div className="app-head">
        <div className="an-skel" style={{ width: 200, height: '1.5rem' }} />
      </div>
      <div className="an-skel" style={{ width: 320, height: '0.875rem', marginBottom: '1.5rem' }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="app-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="an-skel" style={{ width: '60%', height: '0.75rem' }} />
            <div className="an-skel" style={{ width: '85%', height: '1.1rem' }} />
            <div className="an-skel" style={{ width: '40%', height: '0.75rem' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
