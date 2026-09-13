/**
 * Status pills for the import pipeline. Colour carries meaning consistently
 * with the rest of the admin: gold = in flight or needs a human, red = wrong,
 * green = done.
 */

const JOB_COLORS: Record<string, string> = {
  queued: 'var(--muted)',
  running: 'var(--gold-d)',
  completed: 'var(--ok)',
  failed: 'var(--err)',
};

const ITEM_COLORS: Record<string, string> = {
  pending_review: 'var(--gold-d)',
  verification_failed: 'var(--err)',
  approved: 'var(--ok)',
  rejected: 'var(--muted)',
};

const ITEM_LABELS: Record<string, string> = {
  pending_review: 'ready to review',
  verification_failed: 'needs a fix',
  approved: 'approved',
  rejected: 'rejected',
};

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="adm-pill"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <Pill color={JOB_COLORS[status] ?? 'var(--muted)'}>{status}</Pill>;
}

export function ItemStatusPill({ status }: { status: string }) {
  return (
    <Pill color={ITEM_COLORS[status] ?? 'var(--muted)'}>
      {ITEM_LABELS[status] ?? status}
    </Pill>
  );
}
