import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

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
  const excludeParam = searchParams.get('exclude') ?? '';
  const excludeIds = excludeParam ? excludeParam.split(',').filter(Boolean) : [];

  if (!categorySlug && !topicSlug && !subjectSlug) {
    return Response.json({ error: 'MISSING_SCOPE' }, { status: 400 });
  }

  // Fetch published questions in scope (correct_answer excluded from response)
  let query = supabase
    .from('questions')
    .select('id, passage, question_text, question_image_url, chart_svg, question_type, options, difficulty, tags')
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

  const { data: questions, error } = await query;

  if (error) {
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }

  // Filter out recently seen questions; fall back to full pool if all excluded
  const pool =
    questions?.filter(q => !excludeIds.includes(q.id)) ??
    [];
  const available = pool.length > 0 ? pool : (questions ?? []);

  if (available.length === 0) {
    return Response.json(
      { error: 'NO_QUESTIONS', message: 'No questions found for this selection.' },
      { status: 404 }
    );
  }

  const question = available[Math.floor(Math.random() * available.length)];
  return Response.json({ question });
}
