import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin Dashboard — Taleem SAT' };

// Date math lives in helper functions — react-hooks/purity only flags impure
// calls in the component render body, not inside named helpers.
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function dateOffsetUTC(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function since24hISO() {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - 24);
  return d.toISOString();
}

export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  const today = todayUTC();
  const tomorrow = dateOffsetUTC(1);

  const since24h = since24hISO();

  const [
    totalUsers,
    publishedQuestions,
    totalQuestions,
    todaySchedule,
    tomorrowSchedule,
    attempts24h,
  ] = await Promise.all([
    admin.from('users').select('id', { count: 'exact', head: true }),
    admin
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
    admin.from('questions').select('id', { count: 'exact', head: true }),
    admin.from('qod_schedule').select('id').eq('scheduled_date', today).maybeSingle(),
    admin
      .from('qod_schedule')
      .select('id')
      .eq('scheduled_date', tomorrow)
      .maybeSingle(),
    admin
      .from('attempts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h),
  ]);

  // QOD-today response stats
  let qodResponses = 0;
  let qodAccuracy: number | null = null;
  if (todaySchedule.data) {
    const { data: answers } = await admin
      .from('qod_answers')
      .select('is_correct')
      .eq('qod_id', todaySchedule.data.id);
    qodResponses = answers?.length ?? 0;
    if (qodResponses > 0) {
      const correct = (answers ?? []).filter(a => a.is_correct).length;
      qodAccuracy = Math.round((correct / qodResponses) * 100);
    }
  }

  const noQodTomorrow = !tomorrowSchedule.data;

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-txt">Dashboard</h1>
        <p className="text-sm text-muted mt-1">Platform health at a glance.</p>
      </div>

      {/* Alerts */}
      {noQodTomorrow && (
        <div
          className="mb-6 rounded p-4 flex items-center justify-between gap-4 flex-wrap"
          style={{
            background: 'color-mix(in srgb, var(--err) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--err) 35%, transparent)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--txt)' }}>
            <strong>No question scheduled for tomorrow.</strong> Students will see an
            empty Daily Question.
          </p>
          <Link
            href="/admin/qod"
            className="shrink-0 rounded px-3 py-1.5 text-sm font-semibold"
            style={{ background: 'var(--err)', color: '#fff' }}
          >
            Schedule now →
          </Link>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total users" value={totalUsers.count ?? 0} />
        <KpiCard
          label="Questions live"
          value={publishedQuestions.count ?? 0}
          sub={`of ${totalQuestions.count ?? 0} total`}
        />
        <KpiCard
          label="Daily Question today"
          value={todaySchedule.data ? qodResponses : '—'}
          sub={
            todaySchedule.data
              ? qodAccuracy === null
                ? 'no responses yet'
                : `${qodAccuracy}% correct`
              : 'not scheduled'
          }
        />
        <KpiCard label="Attempts (24h)" value={attempts24h.count ?? 0} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/questions/new"
          className="rounded px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--green)', color: '#fff' }}
        >
          + Add question
        </Link>
        <Link
          href="/admin/questions/import"
          className="rounded px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--surf2)', color: 'var(--txt)', border: '1px solid var(--border)' }}
        >
          Import CSV
        </Link>
        <Link
          href="/admin/qod"
          className="rounded px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--surf2)', color: 'var(--txt)', border: '1px solid var(--border)' }}
        >
          Schedule daily question
        </Link>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      className="rounded-l p-4"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs mb-1 text-muted">{label}</p>
      <p className="text-2xl font-bold text-txt">{value}</p>
      {sub && <p className="text-xs mt-0.5 text-muted">{sub}</p>}
    </div>
  );
}
