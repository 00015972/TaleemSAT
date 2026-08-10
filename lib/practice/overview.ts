import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Builds the subject -> category -> topic tree the Practice browse screen
 * renders, with published-question counts and the user's attempted progress.
 *
 * Two DB reads, aggregated in JS — same shape as lib/analytics/overview.ts.
 * Counts are broken down by difficulty so the filter chips can recompute
 * totals client-side without a refetch.
 */

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

export async function computePracticeOverview(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PracticeOverview> {
  const [taxonomyRes, questionsRes, attemptsRes] = await Promise.all([
    supabase
      .from('topics')
      .select(
        'id, slug, name, display_order, categories(id, slug, name, display_order, subjects(id, slug, name, display_order))'
      )
      .order('display_order'),
    // RLS already restricts students to published questions, but be explicit
    // so this is correct when called with a service-role client too.
    //
    // Scale note: one row per published question. At a few thousand questions
    // this is well under 100KB. Past ~10k, swap for a Postgres RPC that returns
    // pre-grouped counts.
    supabase
      .from('questions')
      .select('topic_id, category_id, subject_id, difficulty')
      .eq('status', 'published'),
    supabase
      .from('attempts')
      .select('question_id, questions(topic_id, category_id, subject_id, difficulty)')
      .eq('user_id', userId),
  ]);

  const topicRows = (taxonomyRes.data ?? []) as unknown as TaxonomyRow[];
  const questionRows = (questionsRes.data ?? []) as unknown as QuestionRow[];
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
