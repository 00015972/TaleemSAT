import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getUser } from '@/lib/supabase/server';
import {
  computeAnalyticsOverview,
  type AnalyticsOverview,
} from '@/lib/analytics/overview';
import { AiInsightPanel } from '@/components/analytics/ai-insight-panel';
import { ScoreRing, RadarChart, ProgressArea } from '@/components/analytics/charts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics — Taleem SAT' };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('tier')
    .eq('id', user.id)
    .single();

  const tier = (profile?.tier as string | null) ?? 'free';
  const isPaid = tier === 'pro' || tier === 'elite';

  // Analytics is a Pro/Elite feature — free members get an upgrade teaser.
  if (!isPaid) {
    return (
      <div className="wrap py-5">
        <div className="app-head">
          <h1>Your analytics</h1>
          <p>Where you stand, and the one thing worth fixing next.</p>
        </div>
        <AnalyticsLocked />
      </div>
    );
  }

  const overview = await computeAnalyticsOverview(supabase, user.id);

  if (overview.total === 0) {
    return (
      <div className="wrap py-5">
        <div className="app-head">
          <h1>Your analytics</h1>
          <p>Where you stand, and the one thing worth fixing next.</p>
        </div>
        <EmptyState />
      </div>
    );
  }

  const radarAxes = overview.byCategory
    .filter(c => c.attempts > 0)
    .slice(0, 8)
    .map(c => ({ label: c.category, value: c.accuracy }));
  const hasRadar = radarAxes.length >= 3;

  const strongest = bestCategory(overview);
  const focus = weakestCategory(overview);
  const last7 = overview.daily.slice(-7).reduce((n, d) => n + d.attempts, 0);

  return (
    <div className="wrap py-5 an-page">
      <div className="app-head">
        <h1>Your analytics</h1>
        <p>Where you stand, and the one thing worth fixing next.</p>
      </div>

      {/* ── Hero score band ── */}
      <div className="an-hero prx-anim">
        <div className="an-hero-ring">
          <ScoreRing value={overview.overallAccuracy} />
        </div>
        <div className="an-hero-body">
          <p className="an-hero-eyebrow">Overall</p>
          <p className="an-hero-score">
            {overview.correct}<span className="sep"> / </span>{overview.total}
            <span className="unit"> correct</span>
          </p>
          <p className="an-hero-msg">{scoreMessage(overview.overallAccuracy)}</p>
          <div className="an-hero-bar">
            <div
              className="an-hero-bar-fill"
              style={{ width: `${Math.round(overview.overallAccuracy * 100)}%` }}
            />
          </div>
          <div className="an-hero-chips">
            <TrendChip overview={overview} />
            <span className="an-hero-chip">{last7} this week</span>
            {strongest && <span className="an-hero-chip">Best · {strongest.category}</span>}
          </div>
        </div>
      </div>

      {/* ── Quick tiles ── */}
      <div className="home-tiles">
        <Kpi label="Questions answered" value={String(overview.total)} delay={0.04} />
        <Kpi label="Strongest" value={strongest?.category ?? '—'} small delay={0.08} />
        <Kpi label="Focus area" value={focus?.category ?? '—'} small delay={0.12} />
      </div>

      {/* ── AI insight (paid-only page) ── */}
      <div className="app-panel prx-anim" style={{ animationDelay: '0.16s' }}>
        <AiInsightPanel />
      </div>

      {/* ── Mastery: radar + skill bars ── */}
      <div className={`an-grid2${hasRadar ? '' : ' single'}`}>
        {hasRadar && (
          <div className="app-panel prx-anim" style={{ animationDelay: '0.2s' }}>
            <p className="app-label mb-3">Category mastery</p>
            <RadarChart axes={radarAxes} />
            <p className="an-foot-note">Accuracy by category — further out is stronger.</p>
          </div>
        )}
        <div className="app-panel prx-anim" style={{ animationDelay: '0.24s' }}>
          <p className="app-label mb-3">Skills breakdown</p>
          <div className="an-bars">
            {overview.byCategory.map(c => (
              <BarRow
                key={`${c.subjectSlug}-${c.category}`}
                label={c.category}
                accuracy={c.accuracy}
                attempts={c.attempts}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Progress over time ── */}
      <div className="app-panel prx-anim" style={{ animationDelay: '0.28s' }}>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="app-label" style={{ margin: 0 }}>Accuracy · last 14 days</p>
          <TrendChip overview={overview} subtle />
        </div>
        <ProgressArea points={overview.daily} />
        <TrendSummary overview={overview} />
      </div>

      {/* ── By subject ── */}
      <div className="app-panel prx-anim" style={{ animationDelay: '0.32s' }}>
        <p className="app-label mb-3">By subject</p>
        <div className="an-bars">
          {overview.bySubject.map(s => (
            <BarRow
              key={s.subjectSlug}
              label={s.subject}
              accuracy={s.accuracy}
              attempts={s.attempts}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── helpers ─────────────────────────────── */

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function scoreMessage(accuracy: number) {
  if (accuracy >= 0.85) return 'Outstanding — keep this sharp and push for a perfect score.';
  if (accuracy >= 0.65) return 'Solid work. Lock in the focus area below to climb faster.';
  return 'Every attempt builds the habit. Fix one weak area at a time.';
}

function bestCategory(o: AnalyticsOverview) {
  const eligible = o.byCategory.filter(c => c.attempts >= 3);
  const pool = eligible.length ? eligible : o.byCategory;
  return [...pool].sort((a, b) => b.accuracy - a.accuracy)[0] ?? o.byCategory[0] ?? null;
}

function weakestCategory(o: AnalyticsOverview) {
  const eligible = o.byCategory.filter(c => c.attempts >= 3);
  const pool = eligible.length ? eligible : o.byCategory;
  return [...pool].sort((a, b) => a.accuracy - b.accuracy)[0] ?? null;
}

function barClass(accuracy: number) {
  if (accuracy >= 0.7) return '';
  if (accuracy >= 0.5) return ' warn';
  return ' bad';
}

/* ─── components ─────────────────────────────── */

function Kpi({
  label,
  value,
  small,
  delay,
}: {
  label: string;
  value: string;
  small?: boolean;
  delay: number;
}) {
  return (
    <div className="home-tile prx-anim" style={{ animationDelay: `${delay}s` }}>
      <p className="app-label">{label}</p>
      <p className="num" style={small ? { fontSize: '1rem', lineHeight: 1.3 } : undefined}>
        {value}
      </p>
    </div>
  );
}

function BarRow({
  label,
  accuracy,
  attempts,
}: {
  label: string;
  accuracy: number;
  attempts: number;
}) {
  return (
    <div className="an-bar-row">
      <span className="lbl">{label}</span>
      <span className="val">
        {pct(accuracy)} · {attempts}
      </span>
      <div className="an-bar-track">
        <div
          className={`an-bar-fill${barClass(accuracy)}`}
          style={{ width: `${Math.max(2, Math.round(accuracy * 100))}%` }}
        />
      </div>
    </div>
  );
}

function TrendChip({ overview, subtle }: { overview: AnalyticsOverview; subtle?: boolean }) {
  const { last7Accuracy, prev7Accuracy, direction } = overview.trend;
  if (direction === 'insufficient' || last7Accuracy === null || prev7Accuracy === null) {
    return <span className={`an-trend flat${subtle ? ' subtle' : ''}`}>Building history</span>;
  }
  const cls = direction === 'improving' ? 'up' : direction === 'declining' ? 'down' : 'flat';
  const arrow = direction === 'improving' ? '↑' : direction === 'declining' ? '↓' : '→';
  const delta = Math.round(Math.abs(last7Accuracy - prev7Accuracy) * 100);
  return (
    <span className={`an-trend ${cls}${subtle ? ' subtle' : ''}`}>
      {arrow} {direction === 'flat' ? 'Steady' : `${delta}% vs last week`}
    </span>
  );
}

function TrendSummary({ overview }: { overview: AnalyticsOverview }) {
  const { last7Accuracy, prev7Accuracy, direction } = overview.trend;
  if (direction === 'insufficient' || last7Accuracy === null) {
    return (
      <p className="an-foot-note">
        Practice across two weeks and your accuracy trend takes shape here.
      </p>
    );
  }
  const word =
    direction === 'improving' ? 'up' : direction === 'declining' ? 'down' : 'steady';
  return (
    <p className="an-foot-note">
      Last 7 days: <strong style={{ color: 'var(--txt)' }}>{pct(last7Accuracy)}</strong>
      {prev7Accuracy !== null && (
        <> vs {pct(prev7Accuracy)} the week before — trending <strong>{word}</strong>.</>
      )}
    </p>
  );
}

function AnalyticsLocked() {
  const perks = [
    ['AI weakness analysis', 'The single highest-leverage topic to fix next, with a daily plan.'],
    ['Mastery radar & skill bars', 'See accuracy by category at a glance — where you’re strong, where to drill.'],
    ['14-day progress trend', 'Watch your accuracy climb week over week.'],
    ['Strengths & focus areas', 'Your best category and the one holding your score back.'],
  ];
  return (
    <div className="app-panel accent">
      <div className="an-lock" style={{ border: 'none', background: 'transparent', padding: 0 }}>
        <p className="home-qtitle" style={{ marginBottom: '0.4rem' }}>
          📊 Analytics is a Pro feature
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--txt-soft)', maxWidth: '40rem' }}>
          Upgrade to Pro or Elite to turn your practice into a clear plan — see exactly
          where you stand and the one thing worth fixing next.
        </p>
        <ul className="an-perks">
          {perks.map(([title, desc]) => (
            <li key={title} className="an-perk">
              <span className="an-perk-tick" aria-hidden="true">✓</span>
              <span>
                <strong>{title}</strong>
                <span className="an-perk-desc">{desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <Link href="/settings" className="prx-btn inline-block" style={{ marginTop: '1.1rem' }}>
          Upgrade to unlock →
        </Link>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="app-panel">
      <div className="an-lock" style={{ border: 'none', background: 'transparent' }}>
        <p className="home-qtitle" style={{ marginBottom: '0.4rem' }}>
          No data yet.
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--txt-soft)' }}>
          Answer some practice questions and your accuracy breakdown will appear here.
        </p>
        <Link href="/question-bank" className="prx-btn inline-block">
          Start practicing →
        </Link>
      </div>
    </div>
  );
}
