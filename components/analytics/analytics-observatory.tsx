import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Crosshair,
  Layers3,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { AiInsightPanel } from '@/components/analytics/ai-insight-panel';
import { ReadinessTrajectory } from '@/components/analytics/readiness-trajectory';
import { AppMenuButton } from '@/components/app-menu-button';
import { CountUp } from '@/components/dashboard/count-up';
import { Reveal } from '@/components/dashboard/reveal';
import type { AnalyticsOverview, CategoryStat } from '@/lib/analytics/overview';

export function AnalyticsObservatory({
  overview,
  targetScore,
  examDate,
  referenceDate,
}: {
  overview: AnalyticsOverview;
  targetScore: number | null;
  examDate: string | null;
  referenceDate: string;
}) {
  const current = overview.readiness.current;
  const comparisonPoint = overview.readiness.series.at(-15)?.value ?? null;
  const readinessDelta =
    current.value === null || comparisonPoint === null ? null : current.value - comparisonPoint;
  const accuracyDelta =
    current.recent14Accuracy === null || current.previous14Accuracy === null
      ? null
      : Math.round((current.recent14Accuracy - current.previous14Accuracy) * 100);
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${referenceDate}T12:00:00`));
  const exam = examDate ? new Date(`${examDate}T00:00:00`) : null;
  const reference = new Date(`${referenceDate}T00:00:00`);
  const daysToExam = exam
    ? Math.max(0, Math.ceil((exam.getTime() - reference.getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <div className="observatory-page">
      <div className="observatory-glow observatory-glow-one" aria-hidden="true" />
      <div className="observatory-glow observatory-glow-two" aria-hidden="true" />
      <div className="observatory-inner">
        <header className="observatory-header">
          <div className="observatory-heading-row">
            <AppMenuButton className="observatory-inline-menu" />
            <div>
              <p className="observatory-eyebrow">Performance orbit · {dateLabel}</p>
              <h1>Your score is gaining altitude.</h1>
              <p>One honest signal, one high-leverage move, and the evidence behind both.</p>
            </div>
          </div>
          <Link href="/settings" className="observatory-destination">
            <Target size={15} aria-hidden="true" />
            <span>
              <small>Destination</small>
              <strong>{targetScore ? `${targetScore} target` : 'Set score target'}</strong>
            </span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </header>

        <section className="observatory-hero" aria-label="Readiness and coach signal">
          <Reveal className="observatory-card observatory-trajectory-card">
            <div className="observatory-card-head">
              <div>
                <p className="observatory-label">Readiness trajectory · 30 days</p>
                <h2>{trajectoryHeadline(current.value, readinessDelta)}</h2>
              </div>
              <div className="observatory-readiness-number">
                <strong>
                  {current.value === null ? '—' : <CountUp value={current.value} />}
                </strong>
                <span>
                  readiness / 100
                  {readinessDelta !== null && (
                    <> · {readinessDelta >= 0 ? '↑' : '↓'} {Math.abs(readinessDelta)}</>
                  )}
                </span>
                <em className={`is-${current.confidence}`}>{current.confidence} confidence</em>
              </div>
            </div>
            <ReadinessTrajectory series={overview.readiness.series} current={current} />
          </Reveal>

          <Reveal className="observatory-card observatory-coach-card" delay={90}>
            <AiInsightPanel
              priority={overview.signals.priority}
              potentialGain={overview.readiness.potentialGain}
            />
          </Reveal>
        </section>

        <section className="observatory-metrics" aria-label="Supporting readiness evidence">
          <MetricCard
            label="30-day accuracy"
            icon={<Crosshair size={14} />}
            value={current.accuracy === null ? null : Math.round(current.accuracy * 100)}
            suffix="%"
            note={
              accuracyDelta === null
                ? 'Building a comparison window'
                : `${accuracyDelta >= 0 ? '↑' : '↓'} ${Math.abs(accuracyDelta)}% vs previous 14 days`
            }
          />
          <MetricCard
            label="Practice volume"
            icon={<Layers3 size={14} />}
            value={current.attempts}
            note="answers in the last 30 days"
            delay={60}
          />
          <MetricCard
            label="Reliable coverage"
            icon={<Check size={14} />}
            value={current.reliableCategories}
            suffix={` / ${current.availableCategories}`}
            note="skills with at least three answers"
            delay={120}
          />
          <RunwayCard activeDays={current.activeDays7} daysToExam={daysToExam} />
        </section>

        <div className="observatory-section-heading">
          <div>
            <p className="observatory-eyebrow">Skill signals</p>
            <h2>Where the next points are hiding</h2>
          </div>
          <Link href="/question-bank">Explore all skills <ArrowRight size={14} /></Link>
        </div>

        <section className="observatory-signals" aria-label="Skill signals">
          <SkillSignal
            kind="power"
            label="Power skill"
            category={overview.signals.power}
            icon={<Trophy size={15} />}
          />
          <SkillSignal
            kind="rising"
            label="Rising"
            category={overview.signals.rising}
            icon={<TrendingUp size={15} />}
            delay={70}
          />
          <SkillSignal
            kind="priority"
            label="Priority signal"
            category={overview.signals.priority}
            icon={<Sparkles size={15} />}
            delay={140}
          />
        </section>

        <div className="observatory-section-heading">
          <div>
            <p className="observatory-eyebrow">Evidence deck</p>
            <h2>The performance underneath the signal</h2>
          </div>
        </div>

        <section className="observatory-evidence">
          <Reveal className="observatory-card observatory-breakdown-card">
            <div className="observatory-card-head compact">
              <div>
                <p className="observatory-label">Category mastery</p>
                <h2>Every skill, in one scan</h2>
              </div>
              <span className="observatory-evidence-pill">30-day signal</span>
            </div>
            <div className="observatory-skill-bars">
              {overview.byCategory.map(category => (
                <CategoryBar key={`${category.subjectSlug}-${category.slug}`} category={category} />
              ))}
            </div>
          </Reveal>

          <div className="observatory-evidence-side">
            <Reveal className="observatory-card observatory-subject-card" delay={70}>
              <div className="observatory-card-head compact">
                <div>
                  <p className="observatory-label">Subject balance</p>
                  <h2>Two sides of the score</h2>
                </div>
              </div>
              <div className="observatory-subjects">
                {overview.bySubject.map(subject => (
                  <div key={subject.subjectSlug}>
                    <span>{subject.subject}</span>
                    <strong>{Math.round(subject.accuracy * 100)}%</strong>
                    <i><b style={{ width: `${Math.round(subject.accuracy * 100)}%` }} /></i>
                    <small>{subject.attempts} answers</small>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal className="observatory-card observatory-activity-card" delay={110}>
              <div className="observatory-card-head compact">
                <div>
                  <p className="observatory-label"><CalendarDays size={13} /> Practice rhythm</p>
                  <h2>Thirty-day activity</h2>
                </div>
                <span className="observatory-evidence-pill">{current.attempts} answers</span>
              </div>
              <div className="observatory-activity-grid" aria-label="Daily answer volume for the last 30 days">
                {overview.daily.map((day, index) => (
                  <span
                    key={day.date}
                    className={`is-${activityLevel(day.attempts)}`}
                    style={{ '--observatory-cell-index': index } as CSSProperties}
                    title={`${day.date}: ${day.attempts} answers`}
                  />
                ))}
              </div>
              <div className="observatory-activity-legend"><span>Less</span><i /><i className="is-1" /><i className="is-2" /><i className="is-3" /><span>More</span></div>
            </Reveal>
          </div>
        </section>

        <footer className="observatory-footer">
          <span>Score Observatory · live student evidence</span>
          <span>Readiness is not a predicted SAT score</span>
        </footer>
      </div>
    </div>
  );
}

function trajectoryHeadline(value: number | null, delta: number | null) {
  if (value === null) return 'Ready for a fresh signal';
  if (delta === null) return 'Your baseline is taking shape';
  if (delta >= 3) return 'Momentum is building';
  if (delta <= -3) return 'A focused reset starts here';
  return 'Your signal is holding steady';
}

function MetricCard({
  label,
  icon,
  value,
  suffix = '',
  note,
  delay = 0,
}: {
  label: string;
  icon: ReactNode;
  value: number | null;
  suffix?: string;
  note: string;
  delay?: number;
}) {
  return (
    <Reveal className="observatory-card observatory-metric-card" delay={delay}>
      <p className="observatory-label">{icon}{label}</p>
      <strong>{value === null ? '—' : <CountUp value={value} suffix={suffix} />}</strong>
      <span>{note}</span>
    </Reveal>
  );
}

function RunwayCard({ activeDays, daysToExam }: { activeDays: number; daysToExam: number | null }) {
  const status = daysToExam === null
    ? 'Set test date'
    : activeDays >= 4
      ? 'On pace'
      : activeDays >= 2
        ? 'Steady'
        : 'Needs a session';
  const width = Math.min(100, (activeDays / 4) * 100);
  return (
    <Reveal className="observatory-card observatory-metric-card observatory-runway" delay={180}>
      <p className="observatory-label"><Clock3 size={14} /> Practice runway</p>
      <strong>{status}</strong>
      <span>{daysToExam === null ? 'Add your exam date in Settings' : `${daysToExam} days until test day · ${activeDays} active this week`}</span>
      <i style={{ '--observatory-runway-width': `${width}%` } as CSSProperties}><b /></i>
    </Reveal>
  );
}

function SkillSignal({
  kind,
  label,
  category,
  icon,
  delay = 0,
}: {
  kind: 'power' | 'rising' | 'priority';
  label: string;
  category: CategoryStat | null;
  icon: ReactNode;
  delay?: number;
}) {
  const percentage = Math.round((category?.recentAccuracy ?? 0) * 100);
  const supportingCopy = !category
    ? 'Keep practicing across categories to unlock this signal.'
    : kind === 'rising' && category.accuracyChange !== null
      ? `↑ ${Math.round(category.accuracyChange * 100)}% across the comparison window`
      : `${category.recentAttempts} answers in the evidence window`;

  return (
    <Reveal className={`observatory-card observatory-signal-card is-${kind}`} delay={delay}>
      <div>
        <p className="observatory-label">{icon}{label}</p>
        <h3>{category?.category ?? 'Building evidence'}</h3>
        <p>{supportingCopy}</p>
        {kind === 'priority' && category && (
          <Link href={`/question-bank?category=${encodeURIComponent(category.slug)}&mode=focus`}>
            Train this skill <ArrowRight size={13} />
          </Link>
        )}
      </div>
      <div
        className="observatory-signal-ring"
        style={{ '--observatory-ring': `${percentage * 3.6}deg` } as CSSProperties}
        aria-label={category ? `${percentage}% accuracy` : 'Not enough evidence'}
      >
        <span>{category ? `${percentage}%` : '—'}</span>
      </div>
    </Reveal>
  );
}

function CategoryBar({ category }: { category: CategoryStat }) {
  const percentage = Math.round(category.recentAccuracy * 100);
  return (
    <div className="observatory-skill-row">
      <div>
        <strong>{category.category}</strong>
        <span>{category.subject} · {category.recentAttempts} recent</span>
      </div>
      <em>{percentage}%</em>
      <i><b style={{ width: `${Math.max(2, percentage)}%` }} /></i>
    </div>
  );
}

function activityLevel(attempts: number) {
  if (attempts === 0) return 0;
  if (attempts <= 3) return 1;
  if (attempts <= 7) return 2;
  return 3;
}

export function ObservatoryLocked() {
  return (
    <div className="observatory-page observatory-state-page">
      <div className="observatory-glow observatory-glow-one" aria-hidden="true" />
      <div className="observatory-inner">
        <header className="observatory-header">
          <div className="observatory-heading-row">
            <AppMenuButton className="observatory-inline-menu" />
            <div>
              <p className="observatory-eyebrow">Score Observatory · Pro & Elite</p>
              <h1>Turn every answer into altitude.</h1>
              <p>See the signal behind your practice and the most useful move to make next.</p>
            </div>
          </div>
        </header>
        <section className="observatory-card observatory-lock-card">
          <div className="observatory-lock-copy">
            <p className="observatory-label"><Sparkles size={14} /> Your performance orbit</p>
            <h2>Know what is moving.<span>Know what to fix.</span></h2>
            <p>Unlock the 30-day Readiness trajectory, Coach Signal, skill coverage, and focused-drill shortcuts.</p>
            <ul>
              <li><Check size={15} /> Transparent Readiness Index</li>
              <li><Check size={15} /> AI coach narrative</li>
              <li><Check size={15} /> Actionable skill signals</li>
            </ul>
            <Link href="/settings" className="observatory-primary-button">Unlock Observatory <ArrowRight size={14} /></Link>
          </div>
          <div className="observatory-lock-preview" aria-hidden="true">
            <span className="orbit one" /><span className="orbit two" />
            <strong>71</strong><small>readiness</small><i /><b />
          </div>
        </section>
      </div>
    </div>
  );
}

export function ObservatoryEmpty({ stale = false }: { stale?: boolean }) {
  return (
    <div className="observatory-page observatory-state-page">
      <div className="observatory-inner">
        <header className="observatory-header">
          <div className="observatory-heading-row">
            <AppMenuButton className="observatory-inline-menu" />
            <div>
              <p className="observatory-eyebrow">Performance orbit</p>
              <h1>{stale ? 'Your next session restarts the signal.' : 'Launch your baseline.'}</h1>
              <p>{stale ? 'Your older history is safe. Fresh work will rebuild a current 30-day trajectory.' : 'A few focused answers are all it takes to make your progress visible.'}</p>
            </div>
          </div>
        </header>
        <section className="observatory-card observatory-empty-card">
          <div className="observatory-empty-art" aria-hidden="true"><i /><i /><i /><span>✦</span></div>
          <div>
            <p className="observatory-label">Readiness engines standing by</p>
            <h2>{stale ? 'Put a new point on the map.' : 'Your first signal starts with one answer.'}</h2>
            <p>Practice across a few SAT categories and the Observatory will reveal momentum, coverage, and the highest-leverage next move.</p>
            <Link href="/question-bank" className="observatory-primary-button">Start a practice mission <ArrowRight size={14} /></Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export function ObservatoryError() {
  return (
    <div className="observatory-page observatory-state-page">
      <div className="observatory-inner">
        <section className="observatory-card observatory-empty-card">
          <div className="observatory-empty-art is-error" aria-hidden="true"><i /><i /><i /><span>!</span></div>
          <div>
            <p className="observatory-label">Signal interrupted</p>
            <h2>Your history is safe.</h2>
            <p>The Observatory could not load the latest evidence. Refresh the page, or keep practicing and return shortly.</p>
            <div className="observatory-error-actions">
              <Link href="/analytics" className="observatory-primary-button">Try again <ArrowRight size={14} /></Link>
              <Link href="/question-bank" className="observatory-quiet-link">Continue practicing</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
