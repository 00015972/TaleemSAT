import { NextRequest } from 'next/server';
import { createClient, getClaimsUser } from '@/lib/supabase/server';
import type {
  PracticeBootstrap,
  PracticeManifestEntry,
  PracticeQuestion,
} from '@/components/practice/types';

export const dynamic = 'force-dynamic';

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

/**
 * Returns the complete lightweight manifest plus the first student-safe
 * question in one RPC. Later questions continue through /api/practice/question.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getClaimsUser();

  if (!user) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const topicSlug = searchParams.get('topicSlug');
  const categorySlug = searchParams.get('categorySlug');
  const subjectSlug = searchParams.get('subjectSlug');
  const difficulty = searchParams.get('difficulty');

  const scope = topicSlug
    ? { kind: 'topic', slug: topicSlug }
    : categorySlug
      ? { kind: 'category', slug: categorySlug }
      : subjectSlug
        ? { kind: 'subject', slug: subjectSlug }
        : null;

  if (!scope) {
    return Response.json({ error: 'MISSING_SCOPE' }, { status: 400 });
  }
  if (difficulty && !DIFFICULTIES.has(difficulty)) {
    return Response.json({ error: 'INVALID_DIFFICULTY' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('get_practice_run', {
    p_scope_kind: scope.kind,
    p_scope_slug: scope.slug,
    p_difficulty: (difficulty as 'easy' | 'medium' | 'hard' | null) ?? null,
  });

  if (error) {
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }

  const bootstrap = parseBootstrap(data);
  if (!bootstrap) {
    return Response.json(
      { error: 'NO_QUESTIONS', message: 'No questions found for this selection.' },
      { status: 404 }
    );
  }

  return Response.json(bootstrap);
}

function parseBootstrap(value: unknown): PracticeBootstrap | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;

  const raw = value as { ids?: unknown; question?: unknown };
  if (!Array.isArray(raw.ids) || !isQuestion(raw.question)) return null;

  const ids = raw.ids.filter(isManifestEntry);
  if (ids.length !== raw.ids.length || ids.length === 0) return null;
  if (ids[0].id !== raw.question.id) return null;

  return { ids, question: raw.question };
}

function isManifestEntry(value: unknown): value is PracticeManifestEntry {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  const entry = value as { id?: unknown; difficulty?: unknown };
  return (
    typeof entry.id === 'string' &&
    typeof entry.difficulty === 'string' &&
    DIFFICULTIES.has(entry.difficulty)
  );
}

function isQuestion(value: unknown): value is PracticeQuestion {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  const question = value as Partial<PracticeQuestion>;
  return (
    typeof question.id === 'string' &&
    typeof question.question_text === 'string' &&
    (question.question_type === 'mcq' || question.question_type === 'grid_in') &&
    typeof question.difficulty === 'string' &&
    DIFFICULTIES.has(question.difficulty) &&
    Array.isArray(question.options) &&
    Array.isArray(question.tags)
  );
}
