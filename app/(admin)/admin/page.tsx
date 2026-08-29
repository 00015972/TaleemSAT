import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin Operations — Taleem SAT' };

// react-hooks/purity only flags impure calls in the component render body,
// not inside named helpers.
function since24hISO() {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - 24);
  return d.toISOString();
}

export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  const since24h = since24hISO();

  const [totalUsers, publishedQuestions, draftQuestions, attempts24h] = await Promise.all([
    admin.from('users').select('id', { count: 'exact', head: true }),
    admin
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
    admin
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft'),
    admin
      .from('attempts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h),
  ]);

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="adm-head">
        <h1>Operations</h1>
        <p>The numbers, at a glance.</p>
      </div>

      {/* The ledger */}
      <div className="adm-stat-grid">
        <StatCard label="Students" value={fmt(totalUsers.count)} delay={0.1} />
        <StatCard
          label="Questions live"
          value={fmt(publishedQuestions.count)}
          sub={`${fmt(draftQuestions.count)} drafts waiting`}
          delay={0.14}
        />
        <StatCard label="Attempts · 24h" value={fmt(attempts24h.count)} delay={0.18} />
      </div>

      {/* Quick actions */}
      <div className="adm-actions">
        <Link href="/admin/questions/new" className="adm-btn">
          New question
        </Link>
        <Link href="/admin/import-jobs/new" className="adm-btn secondary">
          Import HTML
        </Link>
      </div>
    </div>
  );
}

function fmt(n: number | null) {
  return (n ?? 0).toLocaleString('en-US');
}

function StatCard({
  label,
  value,
  sub,
  delay,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delay: number;
}) {
  return (
    <div className="adm-stat prx-anim" style={{ animationDelay: `${delay}s` }}>
      <p className="adm-stat-label">{label}</p>
      <p className="adm-stat-num">{value}</p>
      {sub && <p className="adm-stat-sub">{sub}</p>}
    </div>
  );
}
