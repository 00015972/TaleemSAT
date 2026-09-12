import { createClient, getClaimsUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mocksEnabled } from '@/lib/mock/availability';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Keep this as the first post-authentication branch until the launch
// restriction is deliberately lifted. The complete secure flow below is
// intentionally dormant but tested through its exported implementation.
type Row = {
  id: string;
  passage: string | null;
  question_text: string;
  chart_svg: string | null;
  tables: string[] | null;
  question_type: 'mcq' | 'grid_in';
  options: unknown;
  difficulty: string;
  tags: string[] | null;
  categories: { name: string } | null;
  subjects: { slug: string; name: string } | null;
};

type IssuedSession = {
  sessionId: string;
  questions: Array<{ questionId: string; submissionId: string }>;
};

function parseIssuedSession(value: unknown): IssuedSession | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const raw = value as { sessionId?: unknown; questions?: unknown };
  if (typeof raw.sessionId !== 'string' || !Array.isArray(raw.questions)) return null;
  const questions = raw.questions.flatMap(question => {
    if (!question || Array.isArray(question) || typeof question !== 'object') return [];
    const row = question as { questionId?: unknown; submissionId?: unknown };
    return typeof row.questionId === 'string' && typeof row.submissionId === 'string'
      ? [{ questionId: row.questionId, submissionId: row.submissionId }]
      : [];
  });
  return questions.length === raw.questions.length
    ? { sessionId: raw.sessionId, questions }
    : null;
}

async function startEnabledMockSession(request: NextRequest, userId: string) {
  const subject = request.nextUrl.searchParams.get('subject') ?? 'mixed';
  const rawCount = request.nextUrl.searchParams.get('count') ?? '10';
  if (!['mixed', 'english', 'math'].includes(subject) || !/^\d+$/.test(rawCount)) {
    return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  }
  const count = Number(rawCount);
  if (!Number.isSafeInteger(count) || count < 5 || count > 40) {
    return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  }

  const supabase = await createClient();
  let query = supabase
    .from('questions')
    .select(
      'id, passage, question_text, chart_svg, tables, question_type, options, difficulty, tags, categories(name), subjects(slug, name)'
    )
    .eq('status', 'published');

  if (subject === 'english' || subject === 'math') {
    const { data: selectedSubject, error: subjectError } = await supabase
      .from('subjects')
      .select('id')
      .eq('slug', subject)
      .single();
    if (subjectError || !selectedSubject) {
      return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    }
    query = query.eq('subject_id', selectedSubject.id);
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: 'DB_ERROR' }, { status: 500 });

  const rows = [...((data ?? []) as unknown as Row[])];
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [rows[index], rows[swapIndex]] = [rows[swapIndex], rows[index]];
  }
  const picked = rows.slice(0, count);
  if (picked.length === 0) {
    return Response.json(
      { error: 'NO_QUESTIONS', message: 'No published questions found.' },
      { status: 404 }
    );
  }

  const admin = createAdminClient();
  const { data: sessionData, error: sessionError } = await admin.rpc(
    'create_assessment_session',
    {
      p_user_id: userId,
      p_context: 'mock',
      p_question_ids: picked.map(question => question.id),
      p_config: { subject, requestedCount: count },
    }
  );
  const session = parseIssuedSession(sessionData);
  if (sessionError || !session || session.questions.length !== picked.length) {
    return Response.json({ error: 'SESSION_CREATE_FAILED' }, { status: 500 });
  }

  const submissions = new Map(
    session.questions.map(question => [question.questionId, question.submissionId])
  );
  const questions = picked.map(row => ({
    id: row.id,
    submissionId: submissions.get(row.id),
    passage: row.passage,
    question_text: row.question_text,
    chart_svg: row.chart_svg,
    tables: row.tables,
    question_type: row.question_type,
    options: row.options,
    difficulty: row.difficulty,
    tags: row.tags ?? [],
    category: row.categories?.name ?? 'Uncategorized',
    subjectSlug: row.subjects?.slug ?? 'unknown',
    subject: row.subjects?.name ?? 'Unknown',
  }));

  if (questions.some(question => !question.submissionId)) {
    return Response.json({ error: 'SESSION_CREATE_FAILED' }, { status: 500 });
  }
  return Response.json({ sessionId: session.sessionId, questions });
}

export async function GET(request: NextRequest) {
  const user = await getClaimsUser();
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  if (!mocksEnabled()) {
    return Response.json(
      { error: 'MOCK_IN_DEVELOPMENT', message: 'Mock tests are in development' },
      { status: 403 }
    );
  }

  return startEnabledMockSession(request, user.id);
}
