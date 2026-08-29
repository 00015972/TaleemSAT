import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';

/**
 * Builds the subject -> category -> topic tree rendered by Question Bank.
 * Postgres performs the published/distinct-attempt aggregation; this module
 * only converts the compact flat RPC rows into the existing UI contract.
 */

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type CountsByDifficulty = Record<Difficulty | 'all', number>;

export type TopicNode = {
  id: string;
  slug: string;
  name: string;
  questionCount: CountsByDifficulty;
  attemptedCount: CountsByDifficulty;
};

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  topics: TopicNode[];
  questionCount: CountsByDifficulty;
  attemptedCount: CountsByDifficulty;
};

export type SubjectNode = {
  id: string;
  slug: string;
  name: string;
  categories: CategoryNode[];
  questionCount: CountsByDifficulty;
  attemptedCount: CountsByDifficulty;
};

export type PracticeOverview = {
  subjects: SubjectNode[];
};

type OverviewRow =
  Database['public']['Functions']['get_practice_overview']['Returns'][number];

function emptyCounts(): CountsByDifficulty {
  return { all: 0, easy: 0, medium: 0, hard: 0 };
}

function parseCounts(value: Json): CountsByDifficulty {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return emptyCounts();
  }

  const numberAt = (key: keyof CountsByDifficulty) => {
    const raw = value[key];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
  };

  return {
    all: numberAt('all'),
    easy: numberAt('easy'),
    medium: numberAt('medium'),
    hard: numberAt('hard'),
  };
}

export async function computePracticeOverview(
  supabase: SupabaseClient<Database>
): Promise<PracticeOverview> {
  const { data, error } = await supabase.rpc('get_practice_overview');

  if (error) {
    throw new Error(`Practice overview query failed: ${error.message}`);
  }

  const rows = (data ?? []) as OverviewRow[];
  const subjects = new Map<string, SubjectNode>();
  const categories = new Map<string, CategoryNode>();
  const order = new Map<string, number>();

  for (const row of rows) {
    if (!subjects.has(row.subject_id)) {
      subjects.set(row.subject_id, {
        id: row.subject_id,
        slug: row.subject_slug,
        name: row.subject_name,
        categories: [],
        questionCount: parseCounts(row.subject_question_counts),
        attemptedCount: parseCounts(row.subject_attempted_counts),
      });
      order.set(row.subject_id, row.subject_display_order);
    }

    if (!categories.has(row.category_id)) {
      const category: CategoryNode = {
        id: row.category_id,
        slug: row.category_slug,
        name: row.category_name,
        topics: [],
        questionCount: parseCounts(row.category_question_counts),
        attemptedCount: parseCounts(row.category_attempted_counts),
      };
      categories.set(row.category_id, category);
      order.set(row.category_id, row.category_display_order);
      subjects.get(row.subject_id)!.categories.push(category);
    }

    categories.get(row.category_id)!.topics.push({
      id: row.topic_id,
      slug: row.topic_slug,
      name: row.topic_name,
      questionCount: parseCounts(row.topic_question_counts),
      attemptedCount: parseCounts(row.topic_attempted_counts),
    });
    order.set(row.topic_id, row.topic_display_order);
  }

  const byOrder = (a: { id: string }, b: { id: string }) =>
    (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);

  for (const subject of subjects.values()) {
    subject.categories.sort(byOrder);
    for (const category of subject.categories) category.topics.sort(byOrder);
  }

  return { subjects: [...subjects.values()].sort(byOrder) };
}
