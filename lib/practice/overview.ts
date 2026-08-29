import 'server-only';
import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Builds the subject -> category -> topic tree the Practice browse screen
 * renders, with published-question counts and the user's attempted progress.
 *
 * Aggregated in JS — same shape as lib/analytics/overview.ts. Counts are
 * broken down by difficulty so the filter chips can recompute totals
 * client-side without a refetch.
 *
 * The taxonomy + published-question-counts half is identical for every
 * user and only changes when an admin publishes/edits a question, so it's
 * cached (see `getCatalog` below) instead of re-scanning the whole question
 * table on every visit. Only the per-user attempted-count half runs fresh
 * each time.
 */

export const PRACTICE_CATALOG_CACHE_TAG = 'practice-catalog';

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Question counts split by difficulty; `all` is the sum. */
export type CountsByDifficulty = Record<Difficulty | 'all', number>;

export type TopicNode = {
  id: string;
  slug: string;
  name: string;
  /** Published questions available, per difficulty. */
  questionCount: CountsByDifficulty;
  /** Distinct questions this user has attempted, per difficulty. */
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

function emptyCounts(): CountsByDifficulty {
  return { all: 0, easy: 0, medium: 0, hard: 0 };
}

function bump(counts: CountsByDifficulty, difficulty: string | null) {
  counts.all += 1;
  if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
    counts[difficulty] += 1;
  }
}

type TaxonomyRow = {
  id: string;
  slug: string;
  name: string;
  display_order: number;
  categories: {
    id: string;
    slug: string;
    name: string;
    display_order: number;
    subjects: {
      id: string;
      slug: string;
      name: string;
      display_order: number;
    } | null;
  } | null;
};

type QuestionRow = {
  topic_id: string | null;
  category_id: string | null;
  subject_id: string | null;
  difficulty: string | null;
};

type AttemptRow = {
  question_id: string;
  questions: {
    topic_id: string | null;
    category_id: string | null;
    subject_id: string | null;
    difficulty: string | null;
  } | null;
};

/**
 * Taxonomy + published-question counts, shared across every user. Runs on
 * the admin (service-role) client so it doesn't depend on the caller's
 * cookies — required for `unstable_cache` to actually share one cached
 * result across requests instead of keying per-session.
 *
 * Revalidates every 5 minutes as a safety net; admin question writes also
 * call `revalidateTag(PRACTICE_CATALOG_CACHE_TAG)` to bust it immediately.
 */
const getCatalog = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const [taxonomyRes, questionsRes] = await Promise.all([
      admin
        .from('topics')
        .select(
          'id, slug, name, display_order, categories(id, slug, name, display_order, subjects(id, slug, name, display_order))'
        )
        .order('display_order'),
      // Scale note: one row per published question. At a few thousand
      // questions this is well under 100KB. Past ~10k, swap for a Postgres
      // RPC that returns pre-grouped counts.
      admin.from('questions').select('topic_id, category_id, subject_id, difficulty').eq('status', 'published'),
    ]);

    return {
      topicRows: (taxonomyRes.data ?? []) as unknown as TaxonomyRow[],
      questionRows: (questionsRes.data ?? []) as unknown as QuestionRow[],
    };
  },
  ['practice-catalog'],
  { revalidate: 300, tags: [PRACTICE_CATALOG_CACHE_TAG] }
);

export async function computePracticeOverview(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PracticeOverview> {
  const [{ topicRows, questionRows }, attemptsRes] = await Promise.all([
    getCatalog(),
    supabase
      .from('attempts')
      .select('question_id, questions(topic_id, category_id, subject_id, difficulty)')
      .eq('user_id', userId),
  ]);

  const attemptRows = (attemptsRes.data ?? []) as unknown as AttemptRow[];

  // Count at every level independently rather than rolling topics up: questions
  // predating the topics tier have no topic_id, but a category/subject Start
  // still serves them, so the headers must include them or the count would lie.
  const tally = (
    map: Map<string, CountsByDifficulty>,
    key: string | null | undefined,
    difficulty: string | null
  ) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, emptyCounts());
    bump(map.get(key)!, difficulty);
  };

  const topicQuestionCounts = new Map<string, CountsByDifficulty>();
  const categoryQuestionCounts = new Map<string, CountsByDifficulty>();
  const subjectQuestionCounts = new Map<string, CountsByDifficulty>();
  for (const q of questionRows) {
    tally(topicQuestionCounts, q.topic_id, q.difficulty);
    tally(categoryQuestionCounts, q.category_id, q.difficulty);
    tally(subjectQuestionCounts, q.subject_id, q.difficulty);
  }

  // Distinct attempted questions — re-answering must not double count.
  const seenQuestionIds = new Set<string>();
  const topicAttemptedCounts = new Map<string, CountsByDifficulty>();
  const categoryAttemptedCounts = new Map<string, CountsByDifficulty>();
  const subjectAttemptedCounts = new Map<string, CountsByDifficulty>();
  for (const a of attemptRows) {
    const q = a.questions;
    if (!q || seenQuestionIds.has(a.question_id)) continue;
    seenQuestionIds.add(a.question_id);
    tally(topicAttemptedCounts, q.topic_id, q.difficulty);
    tally(categoryAttemptedCounts, q.category_id, q.difficulty);
    tally(subjectAttemptedCounts, q.subject_id, q.difficulty);
  }

  // Build the tree, preserving the seeded display_order at every level.
  const subjects = new Map<string, SubjectNode>();
  const categories = new Map<string, CategoryNode>();
  const order = new Map<string, number>();

  for (const t of topicRows) {
    const cat = t.categories;
    const subj = cat?.subjects;
    if (!cat || !subj) continue;

    if (!subjects.has(subj.id)) {
      subjects.set(subj.id, {
        id: subj.id,
        slug: subj.slug,
        name: subj.name,
        categories: [],
        questionCount: subjectQuestionCounts.get(subj.id) ?? emptyCounts(),
        attemptedCount: subjectAttemptedCounts.get(subj.id) ?? emptyCounts(),
      });
      order.set(subj.id, subj.display_order);
    }
    if (!categories.has(cat.id)) {
      const node: CategoryNode = {
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        topics: [],
        questionCount: categoryQuestionCounts.get(cat.id) ?? emptyCounts(),
        attemptedCount: categoryAttemptedCounts.get(cat.id) ?? emptyCounts(),
      };
      categories.set(cat.id, node);
      order.set(cat.id, cat.display_order);
      subjects.get(subj.id)!.categories.push(node);
    }

    categories.get(cat.id)!.topics.push({
      id: t.id,
      slug: t.slug,
      name: t.name,
      questionCount: topicQuestionCounts.get(t.id) ?? emptyCounts(),
      attemptedCount: topicAttemptedCounts.get(t.id) ?? emptyCounts(),
    });
  }

  const byOrder = (a: { id: string }, b: { id: string }) =>
    (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);

  for (const subject of subjects.values()) {
    subject.categories.sort(byOrder);
  }

  return { subjects: [...subjects.values()].sort(byOrder) };
}
