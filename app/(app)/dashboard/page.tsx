import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ResendVerificationButton } from '@/components/resend-verification-button';

export const metadata = { title: 'Dashboard — Taleem SAT' };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, tier, points, streak_days, target_sat_score, exam_date')
    .eq('id', user.id)
    .single();

  // Fetch today's QOD status in parallel with profile

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: todayQOD } = await supabase
    .from('qod_schedule')
    .select('id')
    .eq('scheduled_date', todayStr)
    .maybeSingle();

  const qodAnswered = todayQOD
    ? (await supabase
        .from('qod_answers')
        .select('is_correct')
        .eq('user_id', user.id)
        .eq('qod_id', todayQOD.id)
        .maybeSingle()
      ).data
    : null;

  const isVerified = !!user.email_confirmed_at;
  const rawName: string =
    (profile?.full_name as string | null) ??
    (user.user_metadata?.full_name as string | undefined) ??
    '';
  const firstName = rawName.split(' ')[0] || 'there';

  // Server Component: Date.now() runs once per request, not on re-renders
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const daysToExam = profile?.exam_date
    ? Math.ceil(
        (new Date(profile.exam_date as string).getTime() - nowMs) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const tier = (profile?.tier as string | null) ?? 'free';
  const streak = profile?.streak_days ?? 0;

  const todayLabel = new Date(`${todayStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="wrap py-5">
      {/* Email verification banner */}
      {!isVerified && (
        <div
          className="mb-5 rounded p-4 flex items-center justify-between gap-4 flex-wrap"
          style={{
            background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--txt)' }}>
            <strong>Verify your email</strong> to unlock practice questions and the
            Daily Question.
          </p>
          <ResendVerificationButton email={user.email!} />
        </div>
      )}

      {/* Welcome */}
      <div className="app-head">
        <h1>Welcome back, {firstName}.</h1>
        <p>
          {daysToExam && daysToExam > 0
            ? `${daysToExam} day${daysToExam === 1 ? '' : 's'} until your exam. Keep going.`
            : 'Ready for today’s question?'}
        </p>
      </div>

      {/* Getting started (unverified only) */}
      {!isVerified && (
        <div className="app-panel mb-5">
          <p className="app-label mb-3">Getting started</p>
          <div className="flex flex-col gap-3">
            <ChecklistItem done={isVerified} label="Verify your email" />
            <ChecklistItem
              done={false}
              label="Answer your first practice question"
              disabled={!isVerified}
            />
            <ChecklistItem
              done={false}
              label="Try the Daily Question"
              disabled={!isVerified}
            />
          </div>
        </div>
      )}

      {/* Today — the ritual leads */}
      <div className="app-panel accent prx-anim">
        <p className="app-label">Today · {todayLabel}</p>
        <div className="home-today">
          <TodayStatus hasQOD={!!todayQOD} answered={qodAnswered} />
          <div className="home-streak">
            <div className={`num${streak === 0 ? ' zero' : ''}`}>{streak}</div>
            <div className="lbl">day streak</div>
          </div>
        </div>
      </div>

      {/* The ledger */}
      <div className="home-tiles">
        <Tile label="Points" value={String(profile?.points ?? 0)} delay={0.06} />
        <Tile
          label="Target score"
          value={profile?.target_sat_score ? String(profile.target_sat_score) : '—'}
          delay={0.1}
        />
        <Tile
          label="Exam in"
          value={daysToExam && daysToExam > 0 ? String(daysToExam) : '—'}
          unit={daysToExam && daysToExam > 0 ? 'days' : undefined}
          delay={0.14}
        />
        <Tile label="Plan" value={tier} capitalize delay={0.18} />
      </div>

      {/* Practice CTA */}
      <div className="app-panel prx-anim" style={{ animationDelay: '0.22s' }}>
        <div className="home-cta">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="home-cta-bubs" aria-hidden="true">
              {['A', 'B', 'C', 'D'].map(l => (
                <span key={l} className="home-cta-bub">{l}</span>
              ))}
            </div>
            <div>
              <p className="home-qtitle">Open the practice room</p>
              <p className="home-qsub">
                Eight SAT categories, one question at a time, at your own pace.
              </p>
            </div>
          </div>
          <Link href="/practice" className="prx-btn shrink-0">
            Start practicing →
          </Link>
        </div>
      </div>
    </div>
  );
}

function TodayStatus({
  hasQOD,
  answered,
}: {
  hasQOD: boolean;
  answered: { is_correct: boolean } | null;
}) {
  if (!hasQOD) {
    return (
      <div className="home-qrow">
        <span className="home-qbub" aria-hidden="true">—</span>
        <div className="min-w-0">
          <p className="home-qtitle">No question scheduled today.</p>
          <p className="home-qsub">Rest day — or sneak in some practice below.</p>
        </div>
      </div>
    );
  }

  if (!answered) {
    return (
      <div className="home-qrow">
        <span className="home-qbub wait" aria-hidden="true">?</span>
        <div className="min-w-0">
          <p className="home-qtitle">Today&rsquo;s question is waiting.</p>
          <p className="home-qsub">+1 point and your streak on the line.</p>
          <Link
            href="/qod"
            className="prx-btn inline-block"
            style={{ marginTop: '0.55rem' }}
          >
            Answer now →
          </Link>
        </div>
      </div>
    );
  }

  const correct = answered.is_correct;
  return (
    <div className="home-qrow">
      <span className={`home-qbub ${correct ? 'hit' : 'miss'}`} aria-hidden="true">
        {correct ? '✓' : '✗'}
      </span>
      <div className="min-w-0">
        <p className="home-qtitle">
          {correct ? 'Answered — correct.' : 'Answered — not your day.'}
        </p>
        <p className="home-qsub">
          {correct
            ? '+1 point earned. Streak safe.'
            : 'Streak intact. Tomorrow is a fresh chance.'}
          {'  '}
          <Link href="/qod" className="underline" style={{ color: 'var(--green)' }}>
            Review →
          </Link>
        </p>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  unit,
  capitalize,
  delay,
}: {
  label: string;
  value: string;
  unit?: string;
  capitalize?: boolean;
  delay: number;
}) {
  return (
    <div className="home-tile prx-anim" style={{ animationDelay: `${delay}s` }}>
      <p className="app-label">{label}</p>
      <p className="num" style={{ textTransform: capitalize ? 'capitalize' : undefined }}>
        {value}
        {unit && <span className="unit"> {unit}</span>}
      </p>
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  disabled,
}: {
  done: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: done ? 'var(--green)' : 'transparent',
          border: `2px solid ${done ? 'var(--green)' : 'var(--muted-l)'}`,
        }}
      >
        {done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1.5 4l2.5 2.5L8.5 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span
        className="text-sm"
        style={{ color: disabled ? 'var(--muted)' : 'var(--txt)' }}
      >
        {label}
      </span>
    </div>
  );
}
