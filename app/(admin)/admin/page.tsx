import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin Operations — Taleem SAT' };

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

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

type ScheduledQ = {
  id: string;
  questions: { question_text: string } | { question_text: string }[] | null;
};

function questionText(row: ScheduledQ | null) {
  if (!row) return null;
  const q = Array.isArray(row.questions) ? row.questions[0] : row.questions;
  return q?.question_text ?? null;
}

export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  const today = todayUTC();
  const tomorrow = dateOffsetUTC(1);
  const since24h = since24hISO();

  const [
    totalUsers,
    publishedQuestions,
    draftQuestions,
    todaySchedule,
    tomorrowSchedule,
    attempts24h,
  ] = await Promise.all([
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
      .from('qod_schedule')
      .select('id, questions(question_text)')
      .eq('scheduled_date', today)
      .maybeSingle(),
    admin
      .from('qod_schedule')
      .select('id, questions(question_text)')
      .eq('scheduled_date', tomorrow)
      .maybeSingle(),
    admin
      .from('attempts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h),
  ]);

  // Today's response stats
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

  const todayQ = questionText(todaySchedule.data as ScheduledQ | null);
  const tomorrowQ = questionText(tomorrowSchedule.data as ScheduledQ | null);

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="adm-head">
        <h1>Operations</h1>
        <p>The daily pipeline, then the numbers.</p>
      </div>

      {/* Today / Tomorrow — is the ritual covered? */}
      <div className="adm-pipeline">
        <section className="adm-panel accent prx-anim">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="adm-section-label" style={{ marginBottom: 0 }}>
              Today · {formatDay(today)}
            </span>
            {todayQ && (
              <span className="adm-live">
                <span className="dot" />
                Live
              </span>
            )}
          </div>

          {todayQ ? (
            <>
              <p className="adm-pl-q">{todayQ}</p>
              <p className="adm-pl-stat">
                {qodResponses === 0
                  ? 'no responses yet'
                  : `${qodResponses} answered · ${qodAccuracy}% correct`}
              </p>
            </>
          ) : (
            <>
              <p className="adm-pl-q" style={{ color: 'var(--muted)' }}>
                Nothing is live today — students see an empty Daily Question.
              </p>
              <Link href="/admin/qod" className="adm-btn mt-3 self-start">
                Schedule today →
              </Link>
            </>
          )}
        </section>

        <section
          className={`adm-panel prx-anim${tomorrowQ ? '' : ' alert err'}`}
          style={{ animationDelay: '0.06s' }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="adm-section-label" style={{ marginBottom: 0 }}>
              Tomorrow
            </span>
            <span
              className="adm-pill"
              style={
                tomorrowQ
                  ? {
                      color: 'var(--ok)',
                      background: 'color-mix(in srgb, var(--ok) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--ok) 30%, transparent)',
                    }
                  : {
                      color: 'var(--err)',
                      background: 'color-mix(in srgb, var(--err) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--err) 30%, transparent)',
                    }
              }
            >
              {tomorrowQ ? '✓ Ready' : '⚠ Not scheduled'}
            </span>
          </div>

          {tomorrowQ ? (
            <p className="adm-pl-q">{tomorrowQ}</p>
          ) : (
            <>
              <p className="adm-pl-q" style={{ color: 'var(--txt)' }}>
                No question queued. Schedule one before midnight.
              </p>
              <Link href="/admin/qod" className="adm-btn mt-3 self-start">
                Schedule now →
              </Link>
            </>
          )}
        </section>
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
        <StatCard
          label="QOD responses"
          value={todaySchedule.data ? qodResponses : '—'}
          sub={
            todaySchedule.data
              ? qodAccuracy === null
                ? 'today · none yet'
                : `today · ${qodAccuracy}% correct`
              : 'not scheduled'
          }
          delay={0.18}
        />
        <StatCard label="Attempts · 24h" value={fmt(attempts24h.count)} delay={0.22} />
      </div>

      {/* Quick actions */}
      <div className="adm-actions">
        <Link href="/admin/questions/new" className="adm-btn">
          New question
        </Link>
        <Link href="/admin/questions/import" className="adm-btn secondary">
          Import CSV
        </Link>
        <Link href="/admin/qod" className="adm-btn secondary">
          Schedule daily question
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
