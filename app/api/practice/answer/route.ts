import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  let body: { questionId?: string; selectedAnswer?: string; timeTakenMs?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { questionId, selectedAnswer, timeTakenMs } = body;

  if (!questionId || !selectedAnswer) {
    return Response.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  // Fetch question server-side — correct_answer never leaves the server
  const { data: question } = await supabase
    .from('questions')
    .select('correct_answer, explanation, status')
    .eq('id', questionId)
    .single();

  if (!question || question.status !== 'published') {
    return Response.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
  }

  const isCorrect = selectedAnswer === question.correct_answer;

  // Record attempt via admin client (bypasses RLS for reliability)
  const admin = createAdminClient();
  await admin.from('attempts').insert({
    user_id: user.id,
    question_id: questionId,
    selected_answer: selectedAnswer,
    is_correct: isCorrect,
    time_taken_ms: timeTakenMs ?? null,
    context: 'practice',
  });

  return Response.json({
    isCorrect,
    correctAnswer: question.correct_answer,
    explanation: question.explanation,
  });
}
