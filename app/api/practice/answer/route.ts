import { getClaimsUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';
import { gridInAnswerMatches } from '@/lib/grading/grid-in';
import {
  loadProgressionAfterAttempts,
  progressionOutcomeForAttempt,
} from '@/lib/progression/server';
import type { ProgressionOutcome } from '@/lib/progression/types';
import { parseJsonRequest } from '@/lib/validation/request';
import { practiceAnswerSchema } from '@/lib/validation/schemas';

const SUBMISSION_KEY_INDEX = 'attempts_user_submission_key_unique';
const ATTEMPT_REPLAY_COLUMNS =
  'id, question_id, selected_answer, is_correct, time_taken_ms, context, submission_key';

type AttemptReplay = {
  id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  time_taken_ms: number | null;
  context: string;
  submission_key: string | null;
};

function isSubmissionKeyConflict(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  return error.code === '23505'
    && `${error.message ?? ''} ${error.details ?? ''}`.includes(SUBMISSION_KEY_INDEX);
}

function isExactReplay(
  attempt: AttemptReplay,
  incoming: {
    questionId: string;
    selectedAnswer: string;
    timeTakenMs: number | undefined;
    submissionKey: string;
  }
): boolean {
  return attempt.question_id === incoming.questionId
    && attempt.selected_answer === incoming.selectedAnswer
    && attempt.time_taken_ms === (incoming.timeTakenMs ?? null)
    && attempt.context === 'practice'
    && attempt.submission_key === incoming.submissionKey;
}

export async function POST(request: NextRequest) {
  const user = await getClaimsUser();

  if (!user) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, practiceAnswerSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const { questionId, selectedAnswer, timeTakenMs, recordAttempt, submissionKey } = body;

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
  let responseIsCorrect = isCorrect;
  if (recordAttempt === true) {
    // Enforced by practiceAnswerSchema's cross-field validation.
    const recordedSubmissionKey = submissionKey!;
    const { data: insertedAttempt, error: attemptError } = await admin
      .from('attempts')
      .insert({
        user_id: user.id,
        question_id: questionId,
        selected_answer: selectedAnswer,
        is_correct: isCorrect,
        time_taken_ms: timeTakenMs ?? null,
        context: 'practice',
        submission_key: recordedSubmissionKey,
      })
      .select(ATTEMPT_REPLAY_COLUMNS)
      .single();

    let attempt = insertedAttempt as AttemptReplay | null;
    if (attemptError) {
      if (!isSubmissionKeyConflict(attemptError)) {
        return Response.json({ error: 'ATTEMPT_SAVE_FAILED' }, { status: 500 });
      }

      const { data: existingAttempt, error: replayError } = await admin
        .from('attempts')
        .select(ATTEMPT_REPLAY_COLUMNS)
        .eq('user_id', user.id)
        .eq('submission_key', recordedSubmissionKey)
        .maybeSingle();

      if (replayError || !existingAttempt) {
        return Response.json({ error: 'ATTEMPT_SAVE_FAILED' }, { status: 500 });
      }

      attempt = existingAttempt as AttemptReplay;
      if (!isExactReplay(attempt, {
        questionId,
        selectedAnswer,
        timeTakenMs,
        submissionKey: recordedSubmissionKey,
      })) {
        return Response.json({ error: 'SUBMISSION_KEY_REUSED' }, { status: 409 });
      }
    } else if (!attempt) {
      return Response.json({ error: 'ATTEMPT_SAVE_FAILED' }, { status: 500 });
    }

    responseIsCorrect = attempt.is_correct;
    try {
      const progress = await loadProgressionAfterAttempts(admin, user.id, [attempt.id]);
      progression = progressionOutcomeForAttempt(attempt.id, progress.awards, progress.snapshot);
    } catch {
      return Response.json({ error: 'PROGRESSION_READ_FAILED' }, { status: 500 });
    }
  }

  // Never hand over the key on a wrong guess — the student has to find it.
  if (!responseIsCorrect) {
    return Response.json({ isCorrect: responseIsCorrect, progression });
  }

  return Response.json({
    isCorrect: responseIsCorrect,
    correctAnswer: question.correct_answer,
    explanation: question.explanation,
    progression,
  });
}
