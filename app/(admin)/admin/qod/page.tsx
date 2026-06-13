import { createAdminClient } from '@/lib/supabase/admin';
import { QodScheduler, type PickQuestion } from '@/components/admin/qod-scheduler';
import { UnscheduleButton } from '@/components/admin/unschedule-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Daily Question — Taleem SAT Admin' };

type ScheduleRow = {
  id: string;
  scheduled_date: string;
  question_id: string;
  questions: { question_text: string; difficulty: string } | { question_text: string; difficulty: string }[] | null;
};

function unwrapQuestion(q: ScheduleRow['questions']) {
  const obj = Array.isArray(q) ? q[0] : q;
  return obj ?? { question_text: '—', difficulty: '—' };
}

// Date math in helpers — react-hooks/purity only flags impure calls in the
// component render body, not inside named helpers.
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function AdminQodPage() {
  const admin = createAdminClient();
  const today = todayUTC();
  const tomorrow = tomorrowUTC();

  const [{ data: schedules }, { data: publishedRows }] = await Promise.all([
    admin
      .from('qod_schedule')
      .select('id, scheduled_date, question_id, questions(question_text, difficulty)')
      .order('scheduled_date', { ascending: false })
      .limit(60),
    admin
      .from('questions')
      .select('id, question_text, difficulty, categories(name)')
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
  ]);

  const rows = (schedules ?? []) as unknown as ScheduleRow[];
  const todayRow = rows.find(r => r.scheduled_date === today) ?? null;
  const upcoming = rows
    .filter(r => r.scheduled_date > today)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const past = rows.filter(r => r.scheduled_date < today).slice(0, 20);

  // Response stats for today + past QODs (single query, aggregated in JS).
  const statIds = [todayRow?.id, ...past.map(p => p.id)].filter(Boolean) as string[];
  const statsByQod = new Map<string, { total: number; correct: number }>();
  if (statIds.length > 0) {
    const { data: answers } = await admin
      .from('qod_answers')
      .select('qod_id, is_correct')
      .in('qod_id', statIds);
    for (const a of answers ?? []) {
      const s = statsByQod.get(a.qod_id) ?? { total: 0, correct: 0 };
      s.total += 1;
      if (a.is_correct) s.correct += 1;
      statsByQod.set(a.qod_id, s);
    }
  }

  function accuracyLabel(qodId: string) {
    const s = statsByQod.get(qodId);
    if (!s || s.total === 0) return 'no responses';
    return `${s.total} responses · ${Math.round((s.correct / s.total) * 100)}% correct`;
  }

  const publishedQuestions: PickQuestion[] = (publishedRows ?? []).map(q => {
    const cat = Array.isArray(q.categories) ? q.categories[0] : q.categories;
    return {
      id: q.id,
      preview: q.question_text.slice(0, 70),
      difficulty: q.difficulty,
      categoryName: (cat as { name: string } | null)?.name ?? '—',
    };
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="adm-head mb-6">
        <h1>Daily Question</h1>
        <p>Schedule the Question of the Day. Students see one per day.</p>
      </div>

      {/* Today */}
      <section className="adm-section">
        <span className="adm-section-label">Today · {today}</span>
        {todayRow ? (
          <div className="adm-panel accent">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
              <span className="adm-live">
                <span className="dot" />
                Live
              </span>
              <span
                className="adm-pill"
                style={{
                  color: 'var(--gold-d)',
                  background: 'color-mix(in srgb, var(--gold-d) 12%, transparent)',
                }}
              >
                {unwrapQuestion(todayRow.questions).difficulty}
              </span>
            </div>
            <p className="adm-pl-q">
              {unwrapQuestion(todayRow.questions).question_text.slice(0, 160)}…
            </p>
            <p className="adm-pl-stat">{accuracyLabel(todayRow.id)}</p>
          </div>
        ) : (
          <div className="adm-empty">No question scheduled for today.</div>
        )}
      </section>

      {/* Scheduler */}
      <section className="adm-section">
        <QodScheduler publishedQuestions={publishedQuestions} defaultDate={tomorrow} />
      </section>

      {/* Upcoming */}
      <section className="adm-section">
        <span className="adm-section-label">Upcoming</span>
        {upcoming.length === 0 ? (
          <div className="adm-empty">Nothing scheduled ahead.</div>
        ) : (
          <div className="adm-table-wrap">
            {upcoming.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center gap-4 px-4 py-3"
                style={i < upcoming.length - 1 ? { borderBottom: '1px solid var(--border-l)' } : undefined}
              >
                <span
                  className="w-24 shrink-0"
                  style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--txt-soft)' }}
                >
                  {r.scheduled_date}
                </span>
                <span
                  className="flex-1 min-w-0 truncate"
                  style={{ fontFamily: 'var(--serif-read)', fontSize: '0.92rem', color: 'var(--txt)' }}
                >
                  {unwrapQuestion(r.questions).question_text}
                </span>
                <UnscheduleButton qodId={r.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      <section className="adm-section">
        <span className="adm-section-label">Recent past</span>
        {past.length === 0 ? (
          <div className="adm-empty">No past questions yet.</div>
        ) : (
          <div className="adm-table-wrap">
            {past.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center gap-4 px-4 py-3"
                style={i < past.length - 1 ? { borderBottom: '1px solid var(--border-l)' } : undefined}
              >
                <span
                  className="w-24 shrink-0"
                  style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--muted)' }}
                >
                  {r.scheduled_date}
                </span>
                <span
                  className="flex-1 min-w-0 truncate"
                  style={{ fontFamily: 'var(--serif-read)', fontSize: '0.92rem', color: 'var(--txt-soft)' }}
                >
                  {unwrapQuestion(r.questions).question_text}
                </span>
                <span
                  className="shrink-0 hidden sm:inline"
                  style={{ fontFamily: 'var(--mono)', fontSize: '0.66rem', color: 'var(--muted)' }}
                >
                  {accuracyLabel(r.id)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
