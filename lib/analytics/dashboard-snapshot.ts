import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { ProgressionSnapshot } from '@/lib/progression/types';
import { DAILY_STREAK_GOAL } from '@/lib/progression/types';
import { shiftIsoDate } from '@/lib/progression/dates';

/**
 * Lightweight aggregation for the student dashboard. Deliberately separate
 * from lib/analytics/overview.ts (the Pro-gated Analytics page + AI insight
 * prompt) so dashboard changes never touch that contract.
 *
 * Everything here comes from one `get_dashboard_snapshot` call. It used to be
 * eight queries in two dependent waves — the per-subject all-time totals
 * could not even start until the subjects list returned — plus two more for
 * progression. Each of those is a network round trip, and a warm round trip
 * to Supabase measures 300-700 ms from Tashkent, so the page spent well over
 * a second doing nothing but waiting. Postgres now does the aggregation and
 * this module only reshapes the result.
 */

export type SubjectSnapshot = {
  subject: string;
  slug: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
};

export type AccuracyTrendPoint = {
  createdAt: string;
  attemptNumber: number;
  windowSize: number;
  accuracy: number; // 0..1, rolling over this attempt and up to four before it
};

export type SubjectTrend = {
  subject: string;
  slug: string;
  last30: number | null; // 0..1
  prior30: number | null; // 0..1
};

export type DayActivity = {
  date: string; // ISO date
  count: number;
};

export type DashboardSnapshot = {
  totalAttempts: number;
  overallAccuracy: number; // 0..1
  bySubject: SubjectSnapshot[];
  accuracyTrend: AccuracyTrendPoint[]; // latest 30 attempts, oldest first
  subjectTrend: SubjectTrend[];
  dailyActivity: DayActivity[]; // last 28 days, oldest first
  todayCount: number;
  weekCount: number;
  monthCount: number;
  progression: ProgressionSnapshot;
};

/** Points charted on the accuracy trend, and the rolling window each averages. */
const TREND_POINTS = 30;
const TREND_WINDOW = 5;

type RawSnapshot = {
  total_attempts: number;
  total_correct: number;
  window_attempts: number;
  by_subject: { slug: string; name: string; attempts: number; correct: number }[];
  subject_trend: {
    slug: string;
    name: string;
    last30: number | string | null;
    prior30: number | string | null;
  }[];
  daily_activity: { date: string; count: number }[];
  recent: { created_at: string; is_correct: boolean }[];
  progression: {
    total_xp: number;
    current_streak: number;
    longest_streak: number;
    last_streak_date: string | null;
    days: {
      activity_date: string;
      qualifying_question_count: number;
      xp_earned: number;
      streak_earned: boolean;
    }[];
  };
};

/** Postgres returns `avg()` as numeric, which the driver hands over as a string. */
function toRatio(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

export async function computeDashboardSnapshot(
  supabase: SupabaseClient<Database>,
  options: { timezone: string; today: string; weekStart: string }
): Promise<DashboardSnapshot> {
  const { data, error } = await supabase.rpc('get_dashboard_snapshot', {
    p_timezone: options.timezone,
    p_today: options.today,
    p_week_start: options.weekStart,
  });

  if (error) {
    throw new Error(`Dashboard snapshot query failed: ${error.message}`);
  }

  const raw = data as unknown as RawSnapshot;

  const totalAttempts = raw.total_attempts ?? 0;

  const bySubject: SubjectSnapshot[] = (raw.by_subject ?? []).map(row => ({
    subject: row.name,
    slug: row.slug,
    attempts: row.attempts,
    correct: row.correct,
    accuracy: row.attempts ? row.correct / row.attempts : 0,
  }));

  const subjectTrend: SubjectTrend[] = (raw.subject_trend ?? []).map(row => ({
    subject: row.name,
    slug: row.slug,
    last30: toRatio(row.last30),
    prior30: toRatio(row.prior30),
  }));

  // `recent` carries up to four attempts older than the charted window so the
  // leftmost points average over a full five-attempt window rather than a
  // truncated one. Those lead-in rows are consumed here, never plotted.
  const recent = raw.recent ?? [];
  const firstPlotted = Math.max(0, recent.length - TREND_POINTS);
  const windowAttempts = raw.window_attempts ?? recent.length;
  const accuracyTrend: AccuracyTrendPoint[] = recent
    .slice(firstPlotted)
    .map((row, index) => {
      const rowIndex = firstPlotted + index;
      const sample = recent.slice(Math.max(0, rowIndex - (TREND_WINDOW - 1)), rowIndex + 1);
      const correct = sample.filter(item => item.is_correct).length;
      return {
        createdAt: row.created_at,
        attemptNumber: windowAttempts - (recent.length - 1 - rowIndex),
        windowSize: sample.length,
        accuracy: sample.length ? correct / sample.length : 0,
      };
    });

  const dailyActivity: DayActivity[] = (raw.daily_activity ?? []).map(day => ({
    date: day.date,
    count: Number(day.count) || 0,
  }));

  const progressionDays = raw.progression?.days ?? [];
  const todayRow = progressionDays.find(day => day.activity_date === options.today);
  const lastStreakDate = raw.progression?.last_streak_date ?? null;
  const yesterday = shiftIsoDate(options.today, -1);

  return {
    totalAttempts,
    overallAccuracy: totalAttempts ? (raw.total_correct ?? 0) / totalAttempts : 0,
    bySubject,
    accuracyTrend,
    subjectTrend,
    dailyActivity,
    todayCount: dailyActivity.at(-1)?.count ?? 0,
    weekCount: dailyActivity.slice(-7).reduce((n, d) => n + d.count, 0),
    monthCount: dailyActivity.reduce((n, d) => n + d.count, 0),
    progression: {
      timezone: options.timezone,
      today: {
        activityDate: options.today,
        newQuestions: todayRow?.qualifying_question_count ?? 0,
        xpEarned: todayRow?.xp_earned ?? 0,
        streakEarned: todayRow?.streak_earned ?? false,
        goal: DAILY_STREAK_GOAL,
      },
      weekXp: progressionDays.reduce((sum, day) => sum + day.xp_earned, 0),
      totalXp: raw.progression?.total_xp ?? 0,
      // A streak only survives if it was earned today or yesterday; anything
      // older has already lapsed.
      currentStreak:
        lastStreakDate && lastStreakDate >= yesterday
          ? (raw.progression?.current_streak ?? 0)
          : 0,
      longestStreak: raw.progression?.longest_streak ?? 0,
      lastStreakDate,
    },
  };
}
