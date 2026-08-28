import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Lightweight aggregation for the student dashboard. Deliberately separate
 * from lib/analytics/overview.ts (the Pro-gated Analytics page + AI insight
 * prompt) so dashboard changes never touch that contract — this only reads
 * what the free dashboard needs: subject-level accuracy, a rolling recent-
 * attempt trend, a 30-day-ago comparison, and daily activity counts.
 */

export type SubjectSnapshot = {
  subject: string;
  slug: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
};

export type WeekPoint = {
  weekStart: string; // ISO date
  attempts: number;
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
  weekly: WeekPoint[]; // last 6 weeks, oldest first
  accuracyTrend: AccuracyTrendPoint[]; // latest 30 attempts, oldest first
  subjectTrend: SubjectTrend[];
  dailyActivity: DayActivity[]; // last 28 days, oldest first
  todayCount: number;
  weekCount: number;
  monthCount: number;
};

type Row = {
  is_correct: boolean;
  created_at: string;
  questions: { subjects: { name: string; slug: string } | null } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function computeDashboardSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<DashboardSnapshot> {
  const { data } = await supabase
    .from('attempts')
    .select('is_correct, created_at, questions(subjects(name, slug))')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const rows = (data ?? []) as unknown as Row[];
  const now = Date.now();

  const totalAttempts = rows.length;
  const totalCorrect = rows.filter(r => r.is_correct).length;

  const subjMap = new Map<
    string,
    { subject: string; slug: string; attempts: number; correct: number }
  >();
  for (const r of rows) {
    const subj = r.questions?.subjects;
    const slug = subj?.slug ?? 'unknown';
    let s = subjMap.get(slug);
    if (!s) {
      s = { subject: subj?.name ?? 'Unknown', slug, attempts: 0, correct: 0 };
      subjMap.set(slug, s);
    }
    s.attempts += 1;
    if (r.is_correct) s.correct += 1;
  }
  const bySubject: SubjectSnapshot[] = [...subjMap.values()]
    .map(s => ({ ...s, accuracy: s.attempts ? s.correct / s.attempts : 0 }))
    .sort((a, b) => b.attempts - a.attempts);

  // Weekly buckets — last 6 weeks, oldest first.
  const weekly: WeekPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = now - (i + 1) * 7 * DAY_MS;
    const end = now - i * 7 * DAY_MS;
    const bucket = rows.filter(r => {
      const t = new Date(r.created_at).getTime();
      return t > start && t <= end;
    });
    const correct = bucket.filter(r => r.is_correct).length;
    weekly.push({
      weekStart: new Date(start).toISOString().slice(0, 10),
      attempts: bucket.length,
      accuracy: bucket.length ? correct / bucket.length : 0,
    });
  }

  // A weekly average can collapse an active month into only a few dots. The
  // dashboard's hero chart instead follows the latest 30 attempts and uses a
  // five-attempt rolling window. This keeps the curve detailed while every
  // point still represents the student's real work rather than interpolation.
  const recentRows = rows.slice(-30);
  const recentStartIndex = rows.length - recentRows.length;
  const accuracyTrend: AccuracyTrendPoint[] = recentRows.map((row, index) => {
    const rowIndex = recentStartIndex + index;
    const sample = rows.slice(Math.max(0, rowIndex - 4), rowIndex + 1);
    const correct = sample.filter(item => item.is_correct).length;
    return {
      createdAt: row.created_at,
      attemptNumber: rowIndex + 1,
      windowSize: sample.length,
      accuracy: sample.length ? correct / sample.length : 0,
    };
  });

  // Per-subject: last 30 days vs the 30 days before that.
  const inWindow = (iso: string, fromMs: number, toMs: number) => {
    const t = new Date(iso).getTime();
    return t > fromMs && t <= toMs;
  };
  const subjectTrend: SubjectTrend[] = [...subjMap.keys()].map(slug => {
    const name = subjMap.get(slug)!.subject;
    const last30Rows = rows.filter(
      r => r.questions?.subjects?.slug === slug && inWindow(r.created_at, now - 30 * DAY_MS, now)
    );
    const prior30Rows = rows.filter(
      r =>
        r.questions?.subjects?.slug === slug &&
        inWindow(r.created_at, now - 60 * DAY_MS, now - 30 * DAY_MS)
    );
    const acc = (arr: Row[]) =>
      arr.length ? arr.filter(r => r.is_correct).length / arr.length : null;
    return { subject: name, slug, last30: acc(last30Rows), prior30: acc(prior30Rows) };
  });

  // Daily activity — last 28 days, oldest first.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dailyActivity: DayActivity[] = [];
  for (let i = 27; i >= 0; i--) {
    const dayStart = startOfToday.getTime() - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const count = rows.filter(r => {
      const t = new Date(r.created_at).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;
    dailyActivity.push({ date: new Date(dayStart).toISOString().slice(0, 10), count });
  }

  const todayCount = dailyActivity[dailyActivity.length - 1]?.count ?? 0;
  const weekCount = dailyActivity.slice(-7).reduce((n, d) => n + d.count, 0);
  const monthCount = dailyActivity.reduce((n, d) => n + d.count, 0);

  return {
    totalAttempts,
    overallAccuracy: totalAttempts ? totalCorrect / totalAttempts : 0,
    bySubject,
    weekly,
    accuracyTrend,
    subjectTrend,
    dailyActivity,
    todayCount,
    weekCount,
    monthCount,
  };
}
