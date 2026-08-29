import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Fragment, type CSSProperties } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Flame,
  Pencil,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { createClient, getAppProfile, getUser } from '@/lib/supabase/server';
import { AppMenuButton } from '@/components/app-menu-button';
import { ResendVerificationButton } from '@/components/resend-verification-button';
import {
  computeDashboardSnapshot,
  type DayActivity,
  type SubjectSnapshot,
  type SubjectTrend,
} from '@/lib/analytics/dashboard-snapshot';
import { AccuracyTrendChart } from '@/components/dashboard/accuracy-trend';
import { Reveal } from '@/components/dashboard/reveal';
import { CountUp } from '@/components/dashboard/count-up';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard — Taleem SAT' };

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) redirect('/login');

  // Server Component: captured once for every time-based value in this request.
  // eslint-disable-next-line react-hooks/purity
  const requestNowMs = Date.now();

  const [profile, snapshot] = await Promise.all([
    getAppProfile(),
    computeDashboardSnapshot(supabase, user.id),
  ]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [{ data: todayQOD }, { data: recentPoints }] = await Promise.all([
    supabase
      .from('qod_schedule')
      .select('id')
      .eq('scheduled_date', todayStr)
      .maybeSingle(),
    supabase
      .from('points_ledger')
      .select('delta')
      .eq('user_id', user.id)
      .gte('created_at', new Date(requestNowMs - 7 * DAY_MS).toISOString()),
  ]);

  const qodAnswered = todayQOD
    ? (
        await supabase
          .from('qod_answers')
          .select('is_correct')
          .eq('user_id', user.id)
          .eq('qod_id', todayQOD.id)
          .maybeSingle()
      ).data
    : null;

  const isVerified = Boolean(user.email_confirmed_at);
  const rawName: string =
    (profile?.full_name as string | null) ??
    (user.user_metadata?.full_name as string | undefined) ??
    '';
  const firstName = rawName.split(' ')[0] || 'there';

  const daysToExam = profile?.exam_date
    ? Math.ceil((new Date(profile.exam_date as string).getTime() - requestNowMs) / DAY_MS)
    : null;

  const tier = (profile?.tier as string | null) ?? 'free';
  const streak = profile?.streak_days ?? 0;
  const points = profile?.points ?? 0;
  const targetScore = profile?.target_sat_score ?? null;
  const pointsThisWeek = (recentPoints ?? []).reduce((total, row) => total + row.delta, 0);

  const todayLabel = new Date(`${todayStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const examDateLabel = profile?.exam_date
    ? new Date(`${profile.exam_date}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const renewsLabel = profile?.current_period_end
    ? new Date(profile.current_period_end as string).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const math = snapshot.bySubject.find(subject => subject.slug === 'math');
  const english = snapshot.bySubject.find(subject => subject.slug === 'english');
  const mathTrend = snapshot.subjectTrend.find(subject => subject.slug === 'math');
  const englishTrend = snapshot.subjectTrend.find(subject => subject.slug === 'english');
  const latestTrend = snapshot.accuracyTrend.at(-1);
  const earliestTrend = snapshot.accuracyTrend.at(0);
  const latestAccuracy = latestTrend?.accuracy ?? snapshot.overallAccuracy;
  const accuracyDelta =
    latestTrend && earliestTrend
      ? Math.round((latestTrend.accuracy - earliestTrend.accuracy) * 100)
      : null;

  const missionItems = [
    {
      label: todayQOD ? 'Daily question' : 'Warm-up question',
      done: todayQOD ? Boolean(qodAnswered) : snapshot.todayCount > 0,
    },
    { label: '5 practice answers', done: snapshot.todayCount >= 5 },
    { label: '10 practice answers', done: snapshot.todayCount >= 10 },
  ];
  const missionsCompleted = missionItems.filter(item => item.done).length;
  const missionHref = todayQOD && !qodAnswered ? '/qod' : '/question-bank';

  return (
    <div className="focus-dashboard">
      <div className="focus-dashboard-glow focus-dashboard-glow-one" aria-hidden="true" />
      <div className="focus-dashboard-glow focus-dashboard-glow-two" aria-hidden="true" />

      <div className="focus-dashboard-inner">
        {!isVerified && (
          <div className="focus-verify" role="status">
            <div className="focus-verify-copy">
              <span className="focus-verify-icon" aria-hidden="true">!</span>
              <div>
                <strong>Verify your email to unlock every mission.</strong>
                <p>Practice and the Daily Question are ready as soon as you confirm.</p>
              </div>
            </div>
            <ResendVerificationButton email={user.email!} />
          </div>
        )}

        <header className="focus-header">
          <div className="focus-heading">
            <p className="focus-eyebrow">Mission control · {todayLabel}</p>
            <div className="focus-heading-row">
              <AppMenuButton className="focus-inline-menu" />
              <div className="focus-heading-copy">
                <h1>Ready for the next level, {firstName}?</h1>
                <p className="focus-header-sub">
                  {daysToExam && daysToExam > 0
                    ? `${daysToExam} day${daysToExam === 1 ? '' : 's'} to test day. Your next best score starts here.`
                    : 'Your next best score starts with one focused answer.'}
                </p>
              </div>
            </div>
          </div>
          <Link href="/settings" className="focus-level-pill">
            <Sparkles size={14} aria-hidden="true" />
            <span>
              <small>Current plan</small>
              <strong>{tier}</strong>
            </span>
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </header>

        <section className="focus-hero" aria-label="Score and accuracy overview">
          <Reveal className="focus-card focus-target-card">
            <div className="focus-card-content">
              <p className="focus-label">
                <Target size={13} aria-hidden="true" /> Score quest
              </p>
              {targetScore ? (
                <h2>
                  <CountUp value={targetScore} />
                  <span>finish line</span>
                </h2>
              ) : (
                <h2 className="focus-target-empty">
                  Set your
                  <span>score goal</span>
                </h2>
              )}
              <p className="focus-target-meta">
                {examDateLabel
                  ? `${examDateLabel}${daysToExam && daysToExam > 0 ? ` · ${daysToExam} days` : ''}`
                  : 'Choose a score and test date to start your map.'}
              </p>
              <Link href="/settings" className="focus-button focus-button-ink">
                <Pencil size={13} aria-hidden="true" />
                {targetScore ? 'Edit score plan' : 'Build score plan'}
              </Link>
            </div>

            <div className="focus-target-orb" aria-hidden="true" />
            <div className="focus-plan-paper" aria-hidden="true">
              <i className="focus-plan-line" />
              <strong>SAT<br />PLAN</strong>
              <span className="focus-plan-bubbles">
                <i /><i /><i className="filled" /><i />
              </span>
              <i className="focus-plan-rule" />
            </div>
            <span className="focus-spark focus-spark-one" aria-hidden="true">✦</span>
            <span className="focus-spark focus-spark-two" aria-hidden="true">✦</span>
          </Reveal>

          <Reveal className="focus-card focus-accuracy-card" delay={80}>
            <div className="focus-card-head">
              <div>
                <p className="focus-label">Accuracy power-up</p>
                <h2>Your {snapshot.accuracyTrend.length}-attempt climb</h2>
              </div>
              <div className="focus-accuracy-metric">
                <strong><CountUp value={Math.round(latestAccuracy * 100)} suffix="%" /></strong>
                <span>
                  {accuracyDelta === null
                    ? 'building your baseline'
                    : `${accuracyDelta >= 0 ? '↑' : '↓'} ${Math.abs(accuracyDelta)}% across this run`}
                </span>
              </div>
            </div>
            <AccuracyTrendChart points={snapshot.accuracyTrend} />
          </Reveal>
        </section>

        <section className="focus-missions" aria-label="Daily momentum">
          <Reveal className="focus-card focus-stat-card focus-streak-card">
            <p className="focus-label"><Flame size={13} aria-hidden="true" /> Combo streak</p>
            <p className="focus-stat-value"><CountUp value={streak} /> <small>days</small></p>
            <p className="focus-stat-copy">
              {streak > 0 ? 'Keep the chain alive with today’s mission.' : 'Your first streak starts today.'}
            </p>
            <div className="focus-streak-cube" aria-hidden="true">
              <span>{streak}</span>
              <i />
            </div>
          </Reveal>

          <Reveal className="focus-card focus-stat-card focus-xp-card" delay={80}>
            <p className="focus-label"><Trophy size={13} aria-hidden="true" /> XP collected</p>
            <p className="focus-stat-value">
              {pointsThisWeek > 0 ? '+' : ''}<CountUp value={pointsThisWeek} />
            </p>
            <p className="focus-stat-copy"><CountUp value={points} /> total points · this week</p>
            <div className="focus-xp-medal" aria-hidden="true">
              <span>★</span><i /><b />
            </div>
          </Reveal>

          <Reveal className="focus-card focus-stat-card focus-mission-card" delay={160}>
            <div className="focus-mission-head">
              <div>
                <p className="focus-label">Daily missions</p>
                <p className="focus-stat-value">{missionsCompleted} <small>/ 3</small></p>
              </div>
              <Link href={missionHref} aria-label="Continue daily missions">
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="focus-mission-bubbles" aria-label={`${missionsCompleted} of 3 missions completed`}>
              {missionItems.map(item => (
                <span key={item.label} className={item.done ? 'done' : ''} title={item.label}>
                  {item.done ? <Check size={12} aria-hidden="true" /> : null}
                </span>
              ))}
            </div>
            <p className="focus-stat-copy">
              {missionsCompleted === 3 ? 'All clear. You owned today.' : 'Claim the next progress boost.'}
            </p>
          </Reveal>
        </section>

        <div className="focus-section-heading">
          <div>
            <p className="focus-eyebrow">Skill loadout</p>
            <h2>Where your score is moving</h2>
          </div>
          <Link href="/question-bank">View all topics <ArrowRight size={14} /></Link>
        </div>

        <section className="focus-subjects" aria-label="Subject performance">
          <SubjectCard
            kind="math"
            label={(math?.accuracy ?? 0) >= (english?.accuracy ?? 0) ? 'Power skill' : 'Next level'}
            title="Math"
            stat={math}
            trend={mathTrend}
          />
          <SubjectCard
            kind="reading"
            label={(english?.accuracy ?? 0) > (math?.accuracy ?? 0) ? 'Power skill' : 'Next level'}
            title="Reading & Writing"
            stat={english}
            trend={englishTrend}
            delay={80}
          />
        </section>

        <div className="focus-section-heading">
          <div>
            <p className="focus-eyebrow">Activity arena</p>
            <h2>Your rhythm, made visible</h2>
          </div>
        </div>

        <section className="focus-activity" aria-label="Practice activity">
          <Reveal className="focus-card focus-practice-card">
            <div className="focus-card-head">
              <div>
                <p className="focus-label">Practice this month</p>
                <h2><CountUp value={snapshot.monthCount} /> <small>answers</small></h2>
              </div>
              <span className="focus-practice-badge">+{snapshot.weekCount} this week</span>
            </div>
            <div className="focus-practice-stats">
              <div><span>Today</span><strong><CountUp value={snapshot.todayCount} /></strong></div>
              <div><span>This week</span><strong><CountUp value={snapshot.weekCount} /></strong></div>
              <div><span>All time</span><strong><CountUp value={snapshot.totalAttempts} /></strong></div>
            </div>
            <div className="focus-practice-meter" aria-label={`${snapshot.monthCount} answers this month`}>
              <i style={{ '--focus-meter': `${Math.min(100, snapshot.monthCount)}%` } as CSSProperties} />
            </div>
            <div className="focus-answer-sheet" aria-hidden="true">
              {['A', 'B', 'C', 'D'].map((choice, index) => (
                <span key={choice} className={index === 2 ? 'filled' : ''}>{choice}</span>
              ))}
            </div>
            <Link href="/question-bank" className="focus-button focus-button-mint">
              Start a practice mission <ArrowRight size={13} />
            </Link>
          </Reveal>

          <Reveal className="focus-card focus-heat-card" delay={80}>
            <div className="focus-card-head">
              <div>
                <p className="focus-label"><CalendarDays size={13} aria-hidden="true" /> Last four weeks</p>
                <h2>Activity map</h2>
              </div>
              <span className="focus-heat-total">{snapshot.monthCount} answers</span>
            </div>
            <ActivityHeatmap days={snapshot.dailyActivity} />
          </Reveal>
        </section>

        <TodayQuestCard hasQOD={Boolean(todayQOD)} answered={qodAnswered} />

        <footer className="focus-footer-note">
          <span>Focus Arcade · live student data</span>
          <span>{renewsLabel && tier !== 'free' ? `Plan renews ${renewsLabel}` : 'Keep showing up. The score follows.'}</span>
        </footer>
      </div>
    </div>
  );
}

function SubjectCard({
  kind,
  label,
  title,
  stat,
  trend,
  delay = 0,
}: {
  kind: 'math' | 'reading';
  label: string;
  title: string;
  stat?: SubjectSnapshot;
  trend?: SubjectTrend;
  delay?: number;
}) {
  const percent = Math.round((stat?.accuracy ?? 0) * 100);
  const prior = trend?.prior30 == null ? null : Math.round(trend.prior30 * 100);
  const change = prior == null ? null : percent - prior;
  const circumference = 2 * Math.PI * 35;
  const offset = circumference * (1 - Math.max(0.02, percent / 100));

  return (
    <Reveal className={`focus-card focus-subject-card focus-subject-${kind}`} delay={delay}>
      <div>
        <p className="focus-label">{label}</p>
        <h3>{title}</h3>
        <p className="focus-subject-copy">
          {stat ? `${stat.correct} of ${stat.attempts} correct` : 'No answers recorded yet'}
        </p>
        <span className={`focus-change${change != null && change < 0 ? ' down' : ''}`}>
          {change == null
            ? 'Building your baseline'
            : `${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}% vs prior 30 days`}
        </span>
      </div>

      <div className="focus-subject-visual" aria-hidden="true">
        <div className={`focus-subject-art focus-subject-art-${kind}`}>
          {kind === 'math' ? (
            <><strong>∑</strong><i>×</i><b>÷</b></>
          ) : (
            <><strong>Aa</strong><i /><b /></>
          )}
        </div>
        <div className="focus-ring">
          <svg viewBox="0 0 80 80">
            <circle className="focus-ring-track" cx="40" cy="40" r="35" />
            <circle
              className="focus-ring-progress"
              cx="40"
              cy="40"
              r="35"
              pathLength={circumference}
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              style={{ '--focus-ring-offset': offset } as CSSProperties}
            />
          </svg>
          <span><CountUp value={percent} suffix="%" /></span>
        </div>
      </div>
    </Reveal>
  );
}

function ActivityHeatmap({ days }: { days: DayActivity[] }) {
  const max = Math.max(1, ...days.map(day => day.count));
  const intensity = (count: number) => {
    if (count === 0) return 0;
    const ratio = count / max;
    if (ratio > 0.75) return 4;
    if (ratio > 0.45) return 3;
    if (ratio > 0.2) return 2;
    return 1;
  };

  const first = new Date(`${days[0]?.date ?? new Date().toISOString().slice(0, 10)}T00:00:00`);
  const leadingBlank = (first.getDay() + 6) % 7;
  const cells: (DayActivity | null)[] = [...Array(leadingBlank).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (DayActivity | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return (
    <>
      <div className="focus-heat-grid">
        <span />
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
          <span key={`${day}-${index}`} className="focus-heat-day">{day}</span>
        ))}
        {weeks.map((week, weekIndex) => (
          <Fragment key={weekIndex}>
            <span className="focus-heat-week">
              {week.find(Boolean)
                ? new Date(`${week.find(Boolean)!.date}T00:00:00`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : ''}
            </span>
            {week.map((cell, dayIndex) => (
              <span
                key={`${weekIndex}-${dayIndex}`}
                className={`focus-heat-cell focus-heat-${cell ? intensity(cell.count) : 0}`}
                title={cell ? `${cell.date}: ${cell.count} answer${cell.count === 1 ? '' : 's'}` : undefined}
                style={{ '--focus-cell-index': weekIndex * 7 + dayIndex } as CSSProperties}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="focus-heat-legend">
        <span>Rest</span><i /><i className="focus-heat-2" /><i className="focus-heat-3" /><i className="focus-heat-4" /><span>Power day</span>
      </div>
    </>
  );
}

function TodayQuestCard({
  hasQOD,
  answered,
}: {
  hasQOD: boolean;
  answered: { is_correct: boolean } | null;
}) {
  let title = 'Open the practice room';
  let copy = 'Choose a subject, lock in, and earn your next progress boost.';
  let href = '/question-bank';
  let action = 'Start practicing';
  let state: 'waiting' | 'correct' | 'miss' = 'waiting';

  if (hasQOD && !answered) {
    title = 'Today’s question is live';
    copy = 'One focused answer keeps your streak and score quest moving.';
    href = '/qod';
    action = 'Answer today’s question';
  } else if (answered?.is_correct) {
    title = 'Daily question cleared';
    copy = 'Correct answer. Your mission chain is safe for today.';
    href = '/qod';
    action = 'Review the answer';
    state = 'correct';
  } else if (answered) {
    title = 'Mission logged — keep moving';
    copy = 'That answer missed, but the review is where the score grows.';
    href = '/qod';
    action = 'Review and learn';
    state = 'miss';
  }

  return (
    <Reveal className={`focus-card focus-today-card focus-today-${state}`}>
      <div className="focus-today-copy">
        <div className="focus-today-bubbles" aria-hidden="true">
          {['A', 'B', 'C', 'D'].map((choice, index) => (
            <span key={choice} className={index === 2 ? 'active' : ''}>{choice}</span>
          ))}
        </div>
        <div>
          <p className="focus-label">Next action</p>
          <h2>{title}</h2>
          <p>{copy}</p>
        </div>
      </div>
      <Link href={href} className="focus-button focus-button-mint">
        {action} <ArrowRight size={14} />
      </Link>
    </Reveal>
  );
}
