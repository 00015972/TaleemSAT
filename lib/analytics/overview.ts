import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Aggregates a user's practice attempt history into the stats the analytics
 * page renders and the AI insight prompt consumes. One DB read, aggregated in
 * JS. Shared so the page and the AI route compute the exact same numbers.
 */

export type CategoryStat = {
  category: string;
  subject: string;
  subjectSlug: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
  avgTimeMs: number;
  topWrongTags: string[];
};

export type SubjectStat = {
  subject: string;
  subjectSlug: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
};

export type WeeklyPoint = {
  weekStart: string; // ISO date (YYYY-MM-DD)
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
};

export type DailyPoint = {
  date: string; // ISO date (YYYY-MM-DD)
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
};

export type AnalyticsOverview = {
  total: number;
  correct: number;
  overallAccuracy: number; // 0..1
  bySubject: SubjectStat[];
  byCategory: CategoryStat[];
  trend: {
    last7Accuracy: number | null;
    prev7Accuracy: number | null;
    direction: 'improving' | 'declining' | 'flat' | 'insufficient';
  };
  weekly: WeeklyPoint[]; // most recent 8 weeks, oldest first
  daily: DailyPoint[]; // most recent 14 days, oldest first
};

type AttemptRow = {
  is_correct: boolean;
  time_taken_ms: number | null;
  created_at: string;
  questions: {
    category_id: string | null;
    tags: string[] | null;
    categories: { name: string } | null;
    subjects: { name: string; slug: string } | null;
  } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function computeAnalyticsOverview(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AnalyticsOverview> {
  const { data } = await supabase
    .from('attempts')
    .select(
      'is_correct, time_taken_ms, created_at, questions(category_id, tags, categories(name), subjects(name, slug))'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const rows = (data ?? []) as unknown as AttemptRow[];

  const total = rows.length;
  const correct = rows.filter(r => r.is_correct).length;

  const catMap = new Map<
    string,
    {
      category: string;
      subject: string;
      subjectSlug: string;
      attempts: number;
      correct: number;
      timeSum: number;
      timeCount: number;
      wrongTags: Map<string, number>;
    }
  >();
  const subjMap = new Map<
    string,
    { subject: string; subjectSlug: string; attempts: number; correct: number }
  >();

  for (const r of rows) {
    const q = r.questions;
    const catName = q?.categories?.name ?? 'Uncategorized';
    const subjName = q?.subjects?.name ?? 'Unknown';
    const subjSlug = q?.subjects?.slug ?? 'unknown';
    const key = `${subjSlug}::${catName}`;

    let c = catMap.get(key);
    if (!c) {
      c = {
        category: catName,
        subject: subjName,
        subjectSlug: subjSlug,
        attempts: 0,
        correct: 0,
        timeSum: 0,
        timeCount: 0,
        wrongTags: new Map(),
      };
      catMap.set(key, c);
    }
    c.attempts += 1;
    if (r.is_correct) c.correct += 1;
    if (typeof r.time_taken_ms === 'number') {
      c.timeSum += r.time_taken_ms;
      c.timeCount += 1;
    }
    if (!r.is_correct && q?.tags) {
      for (const t of q.tags) c.wrongTags.set(t, (c.wrongTags.get(t) ?? 0) + 1);
    }

    let s = subjMap.get(subjSlug);
    if (!s) {
      s = { subject: subjName, subjectSlug: subjSlug, attempts: 0, correct: 0 };
      subjMap.set(subjSlug, s);
    }
    s.attempts += 1;
    if (r.is_correct) s.correct += 1;
  }

  const byCategory: CategoryStat[] = [...catMap.values()]
    .map(c => ({
      category: c.category,
      subject: c.subject,
      subjectSlug: c.subjectSlug,
      attempts: c.attempts,
      correct: c.correct,
      accuracy: c.attempts ? c.correct / c.attempts : 0,
      avgTimeMs: c.timeCount ? Math.round(c.timeSum / c.timeCount) : 0,
      topWrongTags: [...c.wrongTags.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => e[0]),
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const bySubject: SubjectStat[] = [...subjMap.values()]
    .map(s => ({
      subject: s.subject,
      subjectSlug: s.subjectSlug,
      attempts: s.attempts,
      correct: s.correct,
      accuracy: s.attempts ? s.correct / s.attempts : 0,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  // Recent trend: last 7 days vs the 7 days before that.
  const now = Date.now();
  const ageMs = (iso: string) => now - new Date(iso).getTime();
  const last7 = rows.filter(r => ageMs(r.created_at) <= 7 * DAY_MS);
  const prev7 = rows.filter(r => {
    const age = ageMs(r.created_at);
    return age > 7 * DAY_MS && age <= 14 * DAY_MS;
  });
  const accuracyOf = (arr: AttemptRow[]) =>
    arr.length ? arr.filter(r => r.is_correct).length / arr.length : null;
  const last7Accuracy = accuracyOf(last7);
  const prev7Accuracy = accuracyOf(prev7);

  let direction: AnalyticsOverview['trend']['direction'] = 'insufficient';
  if (last7Accuracy !== null && prev7Accuracy !== null) {
    const delta = last7Accuracy - prev7Accuracy;
    direction =
      Math.abs(delta) < 0.03 ? 'flat' : delta > 0 ? 'improving' : 'declining';
  }

  // Weekly buckets — last 8 weeks, oldest first.
  const weekly: WeeklyPoint[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = now - (i + 1) * 7 * DAY_MS;
    const end = now - i * 7 * DAY_MS;
    const bucket = rows.filter(r => {
      const t = new Date(r.created_at).getTime();
      return t > start && t <= end;
    });
    const bCorrect = bucket.filter(r => r.is_correct).length;
    weekly.push({
      weekStart: new Date(start).toISOString().slice(0, 10),
      attempts: bucket.length,
      correct: bCorrect,
      accuracy: bucket.length ? bCorrect / bucket.length : 0,
    });
  }

  // Daily buckets — last 14 calendar days (local), oldest first. Denser than
  // the weekly view, so the progress chart has shape even for newer students.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const daily: DailyPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = startOfToday.getTime() - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const bucket = rows.filter(r => {
      const t = new Date(r.created_at).getTime();
      return t >= dayStart && t < dayEnd;
    });
    const dCorrect = bucket.filter(r => r.is_correct).length;
    daily.push({
      date: new Date(dayStart).toISOString().slice(0, 10),
      attempts: bucket.length,
      correct: dCorrect,
      accuracy: bucket.length ? dCorrect / bucket.length : 0,
    });
  }

  return {
    total,
    correct,
    overallAccuracy: total ? correct / total : 0,
    bySubject,
    byCategory,
    trend: { last7Accuracy, prev7Accuracy, direction },
    weekly,
    daily,
  };
}
