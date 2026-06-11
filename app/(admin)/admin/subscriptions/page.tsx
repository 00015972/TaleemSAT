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
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-txt">Subscriptions</h1>
        <p className="text-sm text-muted mt-0.5">
          Read-only overview of plans and access tiers.
        </p>
      </div>

      {/* Pre-payments notice */}
      <div
        className="mb-6 rounded p-4 text-sm"
        style={{
          background: 'color-mix(in srgb, var(--gold) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)',
          color: 'var(--txt)',
        }}
      >
        Payments aren&apos;t wired up yet (that&apos;s a later phase). Tiers are
        currently assigned by hand in{' '}
        <Link href="/admin/users" className="font-semibold underline">
          Users
        </Link>
        . Once Stripe/Payme is live, real subscriptions will appear in the table below.
      </div>

      {/* Tier distribution */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Free" value={tierCounts.free} />
        <KpiCard label="Pro" value={tierCounts.pro} accent="var(--green)" />
        <KpiCard label="Elite" value={tierCounts.elite} accent="var(--gold-d)" />
        <KpiCard label="Paid total" value={paid} sub="Pro + Elite" />
      </div>

      {/* Manual tier overrides */}
      <section className="mb-8">
        <p className="eyebrow mb-3">Manual tier overrides</p>
        {overrides.length === 0 ? (
          <p className="text-sm text-muted">
            Everyone is on the Free tier. Grant Pro/Elite from the Users page to test
            paid features.
          </p>
        ) : (
          <div
            className="rounded-l overflow-hidden"
            style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <Th>User</Th>
                  <Th>Tier</Th>
                  <Th className="hidden sm:table-cell">Access until</Th>
                </tr>
              </thead>
              <tbody>
                {overrides.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <Td>
                      <div className="flex flex-col">
                        <span className="text-txt font-medium">{o.full_name || '—'}</span>
                        <span className="text-xs text-muted">{o.email}</span>
                      </div>
                    </Td>
                    <Td>
                      <TierPill tier={o.tier} />
                    </Td>
                    <Td className="hidden sm:table-cell text-muted">
                      {o.current_period_end ? formatDate(o.current_period_end) : 'no expiry'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Subscriptions table (provider-backed) */}
      <section>
        <p className="eyebrow mb-3">Provider subscriptions</p>
        {subs.length === 0 ? (
          <div
            className="rounded-l p-5 text-sm text-muted"
            style={{ background: 'var(--surf)', border: '1px dashed var(--border)' }}
          >
            No provider-backed subscriptions yet.
          </div>
        ) : (
          <div
            className="rounded-l overflow-hidden"
            style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <Th>User</Th>
                  <Th>Tier</Th>
                  <Th>Status</Th>
                  <Th className="hidden sm:table-cell">Provider</Th>
                  <Th className="hidden md:table-cell">Renews</Th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <Td>
                      <div className="flex flex-col">
                        <span className="text-txt font-medium">
                          {s.users?.full_name || '—'}
                        </span>
                        <span className="text-xs text-muted">{s.users?.email ?? '—'}</span>
                      </div>
                    </Td>
                    <Td>
                      <TierPill tier={s.tier as 'free' | 'pro' | 'elite'} />
                    </Td>
                    <Td>
                      <StatusPill status={s.status} />
                    </Td>
                    <Td className="hidden sm:table-cell capitalize text-txt-soft">
                      {s.provider}
                    </Td>
                    <Td className="hidden md:table-cell text-muted">
                      {s.current_period_end ? formatDate(s.current_period_end) : '—'}
                      {s.cancel_at_period_end && (
                        <span className="ml-1 text-xs" style={{ color: 'var(--err)' }}>
                          (cancels)
                        </span>
                      )}
                    </Td>
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

function KpiCard({
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
    <div
      className="rounded-l p-4"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs mb-1 text-muted">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent ?? 'var(--txt)' }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-0.5 text-muted">{sub}</p>}
    </div>
  );
}

function TierPill({ tier }: { tier: 'free' | 'pro' | 'elite' }) {
  const color =
    tier === 'elite' ? 'var(--gold-d)' : tier === 'pro' ? 'var(--green)' : 'var(--muted)';
  return (
    <span
      className="text-xs font-semibold capitalize px-2 py-0.5 rounded"
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
      className="text-xs font-semibold px-2 py-0.5 rounded"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left font-semibold text-xs uppercase tracking-wide px-3 py-2.5 text-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}
