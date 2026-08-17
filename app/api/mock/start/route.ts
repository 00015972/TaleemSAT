import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Starts a mock test: returns N random published questions for the chosen
 * subject. Correct answers and explanations are deliberately NOT included —
 * they're revealed only on submit, so the client can't score (or cheat) early.
 */

type Row = {
  id: string;
  passage: string | null;
  question_text: string;
  chart_svg: string | null;
  tables: string[] | null;
  options: unknown;
  difficulty: string;
  tags: string[] | null;
  categories: { name: string } | null;
  subjects: { slug: string; name: string } | null;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const subject = searchParams.get('subject') ?? 'mixed'; // english | math | mixed
  const count = Math.min(40, Math.max(5, Number(searchParams.get('count')) || 10));

  let query = supabase
    .from('questions')
    .select(
      'id, passage, question_text, chart_svg, tables, options, difficulty, tags, categories(name), subjects(slug, name)'
    )
    .eq('status', 'published');

  if (subject === 'english' || subject === 'math') {
    const { data: subj } = await supabase
      .from('subjects')
      .select('id')
      .eq('slug', subject)
      .single();
    if (subj) query = query.eq('subject_id', subj.id);
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: 'DB_ERROR' }, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];

  // Fisher–Yates shuffle, then take the first `count`.
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  const picked = rows.slice(0, count);

  if (picked.length === 0) {
    return Response.json(
      { error: 'NO_QUESTIONS', message: 'No published questions found.' },
      { status: 404 }
    );
  }

  const questions = picked.map(r => ({
    id: r.id,
    passage: r.passage,
    question_text: r.question_text,
    chart_svg: r.chart_svg,
    tables: r.tables,
    options: r.options,
    difficulty: r.difficulty,
    tags: r.tags ?? [],
    category: r.categories?.name ?? 'Uncategorized',
    subjectSlug: r.subjects?.slug ?? 'unknown',
    subject: r.subjects?.name ?? 'Unknown',
  }));

  return Response.json({ questions });
}
