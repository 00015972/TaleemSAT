import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Fetches one published question by id (correct_answer excluded from the
 * response). A single indexed lookup — fast at any scope size, unlike the old
 * "pull every question in scope, pick one at random" query this replaced.
 * The manifest (GET /api/practice/manifest) supplies the ids to walk through.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return Response.json({ error: 'MISSING_ID' }, { status: 400 });
  }

  const { data: question, error } = await supabase
    .from('questions')
    .select('id, passage, question_text, question_image_url, chart_svg, tables, question_type, options, difficulty, tags')
    .eq('id', id)
    .eq('status', 'published')
    .single();

  if (error || !question) {
    return Response.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
  }

  return Response.json({ question });
}
