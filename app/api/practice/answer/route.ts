import { getClaimsUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';
import { gridInAnswerMatches } from '@/lib/grading/grid-in';
import {
  loadProgressionAfterAttempts,
  progressionOutcomeForAttempt,
} from '@/lib/progression/server';
import type { ProgressionOutcome } from '@/lib/progression/types';

export async function POST(request: NextRequest) {
  const user = await getClaimsUser();

  if (!user) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  if (!rawBody || Array.isArray(rawBody) || typeof rawBody !== 'object') {
    return Response.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const body = rawBody as {
    questionId?: string;
    selectedAnswer?: string;
    timeTakenMs?: number;
    recordAttempt?: boolean;
  };

  const { questionId, selectedAnswer, timeTakenMs, recordAttempt } = body;

  if (!questionId || !selectedAnswer) {
    return Response.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }
  if (recordAttempt !== undefined && typeof recordAttempt !== 'boolean') {
    return Response.json({ error: 'INVALID_RECORD_ATTEMPT' }, { status: 400 });
  }

  // Grading keys are not readable by the authenticated browser role. Create
  // the server-only client only after authentication and request validation.
  const admin = createAdminClient();
  const { data: question } = await admin
    .from('questions')
    .select('correct_answer, accepted_answers, explanation, status, question_type')
    .eq('id', questionId)
    .single();

  if (!question || question.status !== 'published') {
    return Response.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
  }

  const isCorrect =
    question.question_type === 'grid_in'
      ? gridInAnswerMatches(selectedAnswer, question.accepted_answers ?? [])
      : selectedAnswer === question.correct_answer;

  // The student gets unlimited tries and finds the key themselves — only the
  // *first* check of a question is a scored attempt (recordAttempt is false
  // for every guess after that). One row per question, same as a single-shot
  // answer always was; the extra guesses are just the student self-correcting.
  let progression: ProgressionOutcome | null = null;
  if (recordAttempt === true) {
    const { data: attempt, error: attemptError } = await admin
      .from('attempts')
      .insert({
        user_id: user.id,
        question_id: questionId,
        selected_answer: selectedAnswer,
        is_correct: isCorrect,
        time_taken_ms: timeTakenMs ?? null,
        context: 'practice',
      })
      .select('id')
      .single();

    if (attemptError || !attempt) {
      return Response.json({ error: 'ATTEMPT_SAVE_FAILED' }, { status: 500 });
    }

    try {
      const progress = await loadProgressionAfterAttempts(admin, user.id, [attempt.id]);
      progression = progressionOutcomeForAttempt(attempt.id, progress.awards, progress.snapshot);
    } catch {
      return Response.json({ error: 'PROGRESSION_READ_FAILED' }, { status: 500 });
    }
  }

  // Never hand over the key on a wrong guess — the student has to find it.
  if (!isCorrect) {
    return Response.json({ isCorrect, progression });
  }

  return Response.json({
    isCorrect,
    correctAnswer: question.correct_answer,
    explanation: question.explanation,
    progression,
  });
}
