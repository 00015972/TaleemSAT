import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { computePracticeOverview } from '@/lib/practice/overview';
import {
  buildReadinessSeries,
  computeFocusedDrillGain,
  computeReadiness,
  DAY_MS,
  type ReadinessAttempt,
  type ReadinessPoint,
  type ReadinessSnapshot,
} from './readiness';

export type CategoryStat = {
  id: string | null;
  slug: string;
  category: string;
  subject: string;
  subjectSlug: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avgTimeMs: number;
  topWrongTags: string[];
  recentAttempts: number;
  recentCorrect: number;
  recentAccuracy: number;
  recent14Attempts: number;
  previous14Attempts: number;
  accuracyChange: number | null;
};

export type SubjectStat = {
  subject: string;
  subjectSlug: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

export type WeeklyPoint = {
  weekStart: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

export type DailyPoint = {
  date: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

export type AnalyticsOverview = {
  total: number;
  correct: number;
  overallAccuracy: number;
  bySubject: SubjectStat[];
  byCategory: CategoryStat[];
  trend: {
    last7Accuracy: number | null;
    prev7Accuracy: number | null;
    direction: 'improving' | 'declining' | 'flat' | 'insufficient';
  };
  weekly: WeeklyPoint[];
  daily: DailyPoint[];
  readiness: {
    current: ReadinessSnapshot;
    series: ReadinessPoint[];
    potentialGain: number | null;
  };
  signals: {
    power: CategoryStat | null;
    rising: CategoryStat | null;
    priority: CategoryStat | null;
  };
};

type AttemptRow = {
  is_correct: boolean;
  time_taken_ms: number | null;
  created_at: string;
  questions: {
    category_id: string | null;
    tags: string[] | null;
    categories: { id: string; name: string; slug: string } | null;
    subjects: { name: string; slug: string } | null;
  } | null;
};

type CategoryAccumulator = {
  id: string | null;
  slug: string;
  category: string;
  subject: string;
  subjectSlug: string;
  attempts: number;
  correct: number;
  timeSum: number;
  timeCount: number;
  wrongTags: Map<string, number>;
};

function accuracyOf(rows: AttemptRow[]) {
  return rows.length ? rows.filter(row => row.is_correct).length / rows.length : null;
}

function rowsInWindow(rows: AttemptRow[], end: number, startDays: number, endDays = 0) {
  return rows.filter(row => {
    const timestamp = new Date(row.created_at).getTime();
    return timestamp <= end - endDays * DAY_MS && timestamp > end - startDays * DAY_MS;
  });
}

function categorySlug(row: AttemptRow) {
  return row.questions?.categories?.slug ?? 'uncategorized';
}

function categoryWindow(rows: AttemptRow[], slug: string) {
  return rows.filter(row => categorySlug(row) === slug);
}

export async function computeAnalyticsOverview(
  supabase: SupabaseClient<Database>,
  userId: string,
  asOf: Date = new Date()
): Promise<AnalyticsOverview> {
  const [attemptResult, practiceOverview] = await Promise.all([
    supabase
      .from('attempts')
      .select(
        'is_correct, time_taken_ms, created_at, questions(category_id, tags, categories(id, name, slug), subjects(name, slug))'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    computePracticeOverview(supabase),
  ]);

  if (attemptResult.error) {
    throw new Error(`Analytics attempts query failed: ${attemptResult.error.message}`);
  }

  const rows = (attemptResult.data ?? []) as unknown as AttemptRow[];
  const availableCategorySlugs = practiceOverview.subjects.flatMap(subject =>
    subject.categories
      .filter(category => category.questionCount.all > 0)
      .map(category => category.slug)
  );
  const end = asOf.getTime();
  const recent30Rows = rowsInWindow(rows, end, 30);
  const recent14Rows = rowsInWindow(rows, end, 14);
  const previous14Rows = rowsInWindow(rows, end, 28, 14);

  const total = rows.length;
  const correct = rows.filter(row => row.is_correct).length;
  const catMap = new Map<string, CategoryAccumulator>();
  const subjMap = new Map<
    string,
    { subject: string; subjectSlug: string; attempts: number; correct: number }
  >();

  for (const row of rows) {
    const question = row.questions;
    const category = question?.categories;
    const catName = category?.name ?? 'Uncategorized';
    const catSlug = category?.slug ?? 'uncategorized';
    const subjName = question?.subjects?.name ?? 'Unknown';
    const subjSlug = question?.subjects?.slug ?? 'unknown';
    const key = `${subjSlug}::${catSlug}`;

    let categoryStat = catMap.get(key);
    if (!categoryStat) {
      categoryStat = {
        id: category?.id ?? question?.category_id ?? null,
        slug: catSlug,
        category: catName,
        subject: subjName,
        subjectSlug: subjSlug,
        attempts: 0,
        correct: 0,
        timeSum: 0,
        timeCount: 0,
        wrongTags: new Map(),
      };
      catMap.set(key, categoryStat);
    }
    categoryStat.attempts += 1;
    if (row.is_correct) categoryStat.correct += 1;
    if (typeof row.time_taken_ms === 'number') {
      categoryStat.timeSum += row.time_taken_ms;
      categoryStat.timeCount += 1;
    }
    if (!row.is_correct && question?.tags) {
      for (const tag of question.tags) {
        categoryStat.wrongTags.set(tag, (categoryStat.wrongTags.get(tag) ?? 0) + 1);
      }
    }

    let subjectStat = subjMap.get(subjSlug);
    if (!subjectStat) {
      subjectStat = { subject: subjName, subjectSlug: subjSlug, attempts: 0, correct: 0 };
      subjMap.set(subjSlug, subjectStat);
    }
    subjectStat.attempts += 1;
    if (row.is_correct) subjectStat.correct += 1;
  }

  const byCategory: CategoryStat[] = [...catMap.values()]
    .map(category => {
      const recent = categoryWindow(recent30Rows, category.slug);
      const recent14 = categoryWindow(recent14Rows, category.slug);
      const previous14 = categoryWindow(previous14Rows, category.slug);
      const recentCorrect = recent.filter(row => row.is_correct).length;
      const recent14Accuracy = accuracyOf(recent14);
      const previous14Accuracy = accuracyOf(previous14);
      return {
        id: category.id,
        slug: category.slug,
        category: category.category,
        subject: category.subject,
        subjectSlug: category.subjectSlug,
        attempts: category.attempts,
        correct: category.correct,
        accuracy: category.attempts ? category.correct / category.attempts : 0,
        avgTimeMs: category.timeCount ? Math.round(category.timeSum / category.timeCount) : 0,
        topWrongTags: [...category.wrongTags.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([tag]) => tag),
        recentAttempts: recent.length,
        recentCorrect,
        recentAccuracy: recent.length ? recentCorrect / recent.length : 0,
        recent14Attempts: recent14.length,
        previous14Attempts: previous14.length,
        accuracyChange:
          recent14Accuracy === null || previous14Accuracy === null
            ? null
            : recent14Accuracy - previous14Accuracy,
      };
    })
    .sort((a, b) => b.recentAttempts - a.recentAttempts || b.attempts - a.attempts);

  const bySubject: SubjectStat[] = [...subjMap.values()]
    .map(subject => ({
      subject: subject.subject,
      subjectSlug: subject.subjectSlug,
      attempts: subject.attempts,
      correct: subject.correct,
      accuracy: subject.attempts ? subject.correct / subject.attempts : 0,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const last7 = rowsInWindow(rows, end, 7);
  const prev7 = rowsInWindow(rows, end, 14, 7);
  const last7Accuracy = accuracyOf(last7);
  const prev7Accuracy = accuracyOf(prev7);
  let direction: AnalyticsOverview['trend']['direction'] = 'insufficient';
  if (last7Accuracy !== null && prev7Accuracy !== null) {
    const delta = last7Accuracy - prev7Accuracy;
    direction = Math.abs(delta) < 0.03 ? 'flat' : delta > 0 ? 'improving' : 'declining';
  }

  const weekly: WeeklyPoint[] = [];
  for (let index = 7; index >= 0; index -= 1) {
    const start = end - (index + 1) * 7 * DAY_MS;
    const finish = end - index * 7 * DAY_MS;
    const bucket = rows.filter(row => {
      const timestamp = new Date(row.created_at).getTime();
      return timestamp > start && timestamp <= finish;
    });
    const bucketCorrect = bucket.filter(row => row.is_correct).length;
    weekly.push({
      weekStart: new Date(start).toISOString().slice(0, 10),
      attempts: bucket.length,
      correct: bucketCorrect,
      accuracy: bucket.length ? bucketCorrect / bucket.length : 0,
    });
  }

  const endOfToday = new Date(asOf);
  endOfToday.setUTCHours(23, 59, 59, 999);
  const daily: DailyPoint[] = [];
  for (let index = 29; index >= 0; index -= 1) {
    const dayEnd = endOfToday.getTime() - index * DAY_MS;
    const dayStart = dayEnd - DAY_MS + 1;
    const bucket = rows.filter(row => {
      const timestamp = new Date(row.created_at).getTime();
      return timestamp >= dayStart && timestamp <= dayEnd;
    });
    const bucketCorrect = bucket.filter(row => row.is_correct).length;
    daily.push({
      date: new Date(dayEnd).toISOString().slice(0, 10),
      attempts: bucket.length,
      correct: bucketCorrect,
      accuracy: bucket.length ? bucketCorrect / bucket.length : 0,
    });
  }

  const readinessAttempts: ReadinessAttempt[] = rows.map(row => ({
    isCorrect: row.is_correct,
    createdAt: row.created_at,
    categorySlug: categorySlug(row),
  }));
  const readinessAsOf = new Date(asOf);
  readinessAsOf.setUTCHours(23, 59, 59, 999);
  const currentReadiness = computeReadiness(
    readinessAttempts,
    availableCategorySlugs,
    readinessAsOf
  );
  const signals = deriveSignals(byCategory);

  return {
    total,
    correct,
    overallAccuracy: total ? correct / total : 0,
    bySubject,
    byCategory,
    trend: { last7Accuracy, prev7Accuracy, direction },
    weekly,
    daily,
    readiness: {
      current: currentReadiness,
      series: buildReadinessSeries(readinessAttempts, availableCategorySlugs, readinessAsOf),
      potentialGain: computeFocusedDrillGain(
        readinessAttempts,
        availableCategorySlugs,
        signals.priority?.slug ?? null,
        readinessAsOf
      ),
    },
    signals,
  };
}

function deriveSignals(byCategory: CategoryStat[]): AnalyticsOverview['signals'] {
  const reliable = byCategory.filter(category => category.recentAttempts >= 3);
  const power = [...reliable].sort(
    (a, b) => b.recentAccuracy - a.recentAccuracy || b.recentAttempts - a.recentAttempts
  )[0] ?? null;

  const priorityPool = reliable.filter(category => category.slug !== power?.slug);
  const priority = [...(priorityPool.length ? priorityPool : reliable)].sort((a, b) => {
    const bLeverage = (1 - b.recentAccuracy) * Math.sqrt(b.recentAttempts);
    const aLeverage = (1 - a.recentAccuracy) * Math.sqrt(a.recentAttempts);
    return bLeverage - aLeverage || a.recentAccuracy - b.recentAccuracy;
  })[0] ?? null;

  const rising = [...reliable]
    .filter(
      category =>
        category.slug !== power?.slug &&
        category.slug !== priority?.slug &&
        category.recent14Attempts >= 2 &&
        category.previous14Attempts >= 2 &&
        (category.accuracyChange ?? 0) > 0
    )
    .sort((a, b) => (b.accuracyChange ?? 0) - (a.accuracyChange ?? 0))[0] ?? null;

  return { power, rising, priority };
}
