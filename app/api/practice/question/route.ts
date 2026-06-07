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
  const excludeParam = searchParams.get('exclude') ?? '';
  const excludeIds = excludeParam ? excludeParam.split(',').filter(Boolean) : [];

  if (!categorySlug) {
    return Response.json({ error: 'MISSING_CATEGORY' }, { status: 400 });
  }

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  if (!category) {
    return Response.json({ error: 'CATEGORY_NOT_FOUND' }, { status: 404 });
  }

  // Fetch all published questions in the category (correct_answer excluded from response)
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, passage, question_text, options, difficulty, tags')
    .eq('category_id', category.id)
    .eq('status', 'published');

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
      { error: 'NO_QUESTIONS', message: 'No questions found in this category.' },
      { status: 404 }
    );
  }

  const question = available[Math.floor(Math.random() * available.length)];
  return Response.json({ question });
}
