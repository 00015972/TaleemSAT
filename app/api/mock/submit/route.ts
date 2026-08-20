import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';
import { gridInAnswerMatches } from '@/lib/grading/grid-in';

/**
 * Scores a finished mock test. The client sends its answers; the server is the
 * only place that knows the correct answers. We score, record one `mock` attempt
 * per answered question (via the service-role client), and return the per-question
 * verdicts + explanations so the client can render the review screen.
 */

type AnswerInput = {
  questionId: string;
  selectedAnswer: string | null;
  timeTakenMs?: number | null;
};

type AttemptInsert = {
  user_id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  time_taken_ms: number | null;
  context: 'mock';
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  let body: { answers?: AnswerInput[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const answers = body.answers ?? [];
  if (!Array.isArray(answers) || answers.length === 0) {
    return Response.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  const ids = [...new Set(answers.map(a => a.questionId).filter(Boolean))];
  const { data: qs } = await supabase
    .from('questions')
    .select('id, correct_answer, accepted_answers, explanation, status, question_type')
    .in('id', ids);

  const map = new Map((qs ?? []).map(q => [q.id, q]));

  const inserts: AttemptInsert[] = [];
  const results = answers.map(a => {
    const q = map.get(a.questionId);
    const correctAnswer = q?.correct_answer ?? null;
    const answered = a.selectedAnswer ?? null;
    const isCorrect =
      answered !== null &&
      q !== undefined &&
      (q.question_type === 'grid_in'
        ? gridInAnswerMatches(answered, q.accepted_answers ?? [])
        : answered === correctAnswer);

    if (q && q.status === 'published' && answered) {
      inserts.push({
        user_id: user.id,
        question_id: a.questionId,
        selected_answer: answered,
        is_correct: isCorrect,
        time_taken_ms: a.timeTakenMs ?? null,
        context: 'mock',
      });
    }

    return {
      questionId: a.questionId,
      correctAnswer,
      isCorrect,
      explanation: q?.explanation ?? null,
    };
  });

  if (inserts.length > 0) {
    const admin = createAdminClient();
    await admin.from('attempts').insert(inserts);
  }

  const total = results.length;
  const correct = results.filter(r => r.isCorrect).length;

  return Response.json({ results, summary: { total, correct } });
}
