import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Subscriptions — Taleem SAT Admin' };

type SubRow = {
  id: string;
  status: string;
  tier: string;
  provider: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  users: { email: string; full_name: string | null } | null;
};

type OverrideRow = {
  id: string;
  email: string;
  full_name: string | null;
  tier: 'free' | 'pro' | 'elite';
  current_period_end: string | null;
};

export default async function SubscriptionsPage() {
  const admin = createAdminClient();

  const [{ data: tierRows }, { data: subRows }, { data: overrideRows }] =
    await Promise.all([
      admin.from('users').select('tier'),
      admin
        .from('subscriptions')
        .select(
          'id, status, tier, provider, current_period_end, cancel_at_period_end, created_at, users(email, full_name)'
        )
        .order('created_at', { ascending: false })
        .limit(100),
      admin
        .from('users')
        .select('id, email, full_name, tier, current_period_end')
        .neq('tier', 'free')
        .order('tier', { ascending: false }),
    ]);

  const tierCounts = { free: 0, pro: 0, elite: 0 };
  for (const r of tierRows ?? []) {
    const t = r.tier as 'free' | 'pro' | 'elite';
    if (t in tierCounts) tierCounts[t] += 1;
  }
  const paid = tierCounts.pro + tierCounts.elite;

  const subs = (subRows ?? []) as unknown as SubRow[];
  const overrides = (overrideRows ?? []) as unknown as OverrideRow[];

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="adm-head">
        <h1>Subscriptions</h1>
        <p>Plans and access tiers.</p>
      </div>

      {/* Pre-payments notice */}
      <div className="adm-alert info">
        <div>
          Payments aren&apos;t wired up yet (that&apos;s a later phase). Tiers are
          currently assigned by hand in{' '}
          <Link href="/admin/users" className="font-semibold underline">
            Users
          </Link>
          . Once Stripe/Payme is live, real subscriptions appear in the table below.
        </div>
      </div>

      {/* Tier distribution */}
      <div className="adm-stat-grid">
        <StatCard label="Free" value={tierCounts.free} />
        <StatCard label="Pro" value={tierCounts.pro} accent="var(--green)" />
        <StatCard label="Elite" value={tierCounts.elite} accent="var(--gold-d)" />
        <StatCard label="Paid total" value={paid} sub="Pro + Elite" />
      </div>

      {/* Manual tier overrides */}
      <section className="adm-section">
        <span className="adm-section-label">Manual tier overrides</span>
        {overrides.length === 0 ? (
          <div className="adm-empty">
            Everyone is on the Free tier. Grant Pro or Elite from the Users page to
            test paid features.
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Tier</th>
                  <th className="hidden sm:table-cell">Access until</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map(o => (
                  <tr key={o.id}>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-txt font-medium">
                          {o.full_name || '—'}
                        </span>
                        <span className="text-xs text-muted">{o.email}</span>
                      </div>
                    </td>
                    <td>
                      <TierPill tier={o.tier} />
                    </td>
                    <td className="hidden sm:table-cell text-muted">
                      {o.current_period_end
                        ? formatDate(o.current_period_end)
                        : 'no expiry'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Subscriptions table (provider-backed) */}
      <section className="adm-section">
        <span className="adm-section-label">Provider subscriptions</span>
        {subs.length === 0 ? (
          <div className="adm-empty">No provider-backed subscriptions yet.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th className="hidden sm:table-cell">Provider</th>
                  <th className="hidden md:table-cell">Renews</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-txt font-medium">
                          {s.users?.full_name || '—'}
                        </span>
                        <span className="text-xs text-muted">
                          {s.users?.email ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <TierPill tier={s.tier as 'free' | 'pro' | 'elite'} />
                    </td>
                    <td>
                      <StatusPill status={s.status} />
                    </td>
                    <td className="hidden sm:table-cell capitalize text-txt-soft">
                      {s.provider}
                    </td>
                    <td className="hidden md:table-cell text-muted">
                      {s.current_period_end ? formatDate(s.current_period_end) : '—'}
                      {s.cancel_at_period_end && (
                        <span className="ml-1 text-xs" style={{ color: 'var(--err)' }}>
                          (cancels)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="adm-stat">
      <p className="adm-stat-label">{label}</p>
      <p className="adm-stat-num" style={{ color: accent ?? 'var(--txt)' }}>
        {value.toLocaleString('en-US')}
      </p>
      {sub && <p className="adm-stat-sub">{sub}</p>}
    </div>
  );
}

function TierPill({ tier }: { tier: 'free' | 'pro' | 'elite' }) {
  const color =
    tier === 'elite' ? 'var(--gold-d)' : tier === 'pro' ? 'var(--green)' : 'var(--muted)';
  return (
    <span
      className="adm-pill"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {tier}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'var(--ok)',
    trialing: 'var(--green)',
    past_due: 'var(--gold-d)',
    incomplete: 'var(--gold-d)',
    canceled: 'var(--muted)',
  };
  const color = colors[status] ?? 'var(--muted)';
  return (
    <span
      className="adm-pill"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
