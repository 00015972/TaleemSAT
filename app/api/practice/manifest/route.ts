import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Returns the ordered, lightweight id list for a scope + difficulty — what the
 * Practice runner pages through. Deliberately just `id` + `difficulty` (a few
 * dozen KB even at 1,500 rows); full question content is fetched per id as the
 * student reaches it, via GET /api/practice/question?id=.
 *
 * This replaces the old pattern of re-fetching the *entire* scope's full
 * content (passages included) on every "next question" — the actual cause of
 * the slowdown, worse the further into a session you got.
 */

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const categorySlug = searchParams.get('categorySlug');
  const topicSlug = searchParams.get('topicSlug');
  const subjectSlug = searchParams.get('subjectSlug');
  const difficulty = searchParams.get('difficulty');

  if (!categorySlug && !topicSlug && !subjectSlug) {
    return Response.json({ error: 'MISSING_SCOPE' }, { status: 400 });
  }

  let query = supabase
    .from('questions')
    .select('id, difficulty')
    .eq('status', 'published');

  // Narrowest scope wins: topic > category > subject.
  if (topicSlug) {
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('slug', topicSlug)
      .single();

    if (!topic) {
      return Response.json({ error: 'TOPIC_NOT_FOUND' }, { status: 404 });
    }
    query = query.eq('topic_id', topic.id);
  } else if (categorySlug) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', categorySlug)
      .single();

    if (!category) {
      return Response.json({ error: 'CATEGORY_NOT_FOUND' }, { status: 404 });
    }
    query = query.eq('category_id', category.id);
  } else if (subjectSlug) {
    const { data: subject } = await supabase
      .from('subjects')
      .select('id')
      .eq('slug', subjectSlug)
      .single();

    if (!subject) {
      return Response.json({ error: 'SUBJECT_NOT_FOUND' }, { status: 404 });
    }
    query = query.eq('subject_id', subject.id);
  }

  if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
    query = query.eq('difficulty', difficulty);
  }

  // Stable, deterministic order — "sequential", not a fresh shuffle per load.
  const { data: ids, error } = await query.order('created_at').order('id');

  if (error) {
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }

  if (!ids || ids.length === 0) {
    return Response.json(
      { error: 'NO_QUESTIONS', message: 'No questions found for this selection.' },
      { status: 404 }
    );
  }

  return Response.json({ ids });
}
