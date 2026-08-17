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

  let body: {
    questionId?: string;
    selectedAnswer?: string;
    timeTakenMs?: number;
    recordAttempt?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { questionId, selectedAnswer, timeTakenMs, recordAttempt } = body;

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

  // The student gets unlimited tries and finds the key themselves — only the
  // *first* check of a question is a scored attempt (recordAttempt is false
  // for every guess after that). One row per question, same as a single-shot
  // answer always was; the extra guesses are just the student self-correcting.
  if (recordAttempt) {
    const admin = createAdminClient();
    await admin.from('attempts').insert({
      user_id: user.id,
      question_id: questionId,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      time_taken_ms: timeTakenMs ?? null,
      context: 'practice',
    });
  }

  // Never hand over the key on a wrong guess — the student has to find it.
  if (!isCorrect) {
    return Response.json({ isCorrect });
  }

  return Response.json({
    isCorrect,
    correctAnswer: question.correct_answer,
    explanation: question.explanation,
  });
}
