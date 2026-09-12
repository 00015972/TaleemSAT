import { getClaimsUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';
import { gridInAnswerMatches } from '@/lib/grading/grid-in';
import {
  loadProgressionAfterAttempts,
  progressionOutcomeForAttempt,
} from '@/lib/progression/server';
import type { ProgressionOutcome } from '@/lib/progression/types';
import type { Database } from '@/lib/supabase/types';
import { parseJsonRequest } from '@/lib/validation/request';
import { practiceAnswerSchema } from '@/lib/validation/schemas';
import type { SupabaseClient } from '@supabase/supabase-js';

type AdminClient = SupabaseClient<Database>;

type SessionSubmission = {
  questionId: string;
  attemptId: string | null;
};

type RecordedPracticeAnswer = {
  attemptId: string;
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  timeTakenMs: number | null;
  isFirstAnswer: boolean;
  isReplay: boolean;
  isLearningRetry: boolean;
};

function parseRecordedAnswer(value: unknown): RecordedPracticeAnswer | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const row = value as Partial<RecordedPracticeAnswer>;
  return typeof row.attemptId === 'string'
    && typeof row.questionId === 'string'
    && typeof row.selectedAnswer === 'string'
    && typeof row.isCorrect === 'boolean'
    && (typeof row.timeTakenMs === 'number' || row.timeTakenMs === null)
    && typeof row.isFirstAnswer === 'boolean'
    && typeof row.isReplay === 'boolean'
    && typeof row.isLearningRetry === 'boolean'
    ? row as RecordedPracticeAnswer
    : null;
}

async function resolveSessionSubmission(
  admin: AdminClient,
  userId: string,
  sessionId: string,
  submissionId: string
): Promise<SessionSubmission | null> {
  const { data: session, error: sessionError } = await admin
    .from('assessment_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .eq('context', 'practice')
    .eq('status', 'active')
    .maybeSingle();

  if (sessionError || !session) return null;

  const { data: submission, error: submissionError } = await admin
    .from('assessment_session_questions')
    .select('question_id, attempt_id')
    .eq('session_id', sessionId)
    .eq('submission_id', submissionId)
    .maybeSingle();

  return submissionError || !submission
    ? null
    : { questionId: submission.question_id, attemptId: submission.attempt_id };
}

async function reconcileCommittedAnswer(
  admin: AdminClient,
  submission: SessionSubmission,
  userId: string,
  sessionId: string,
  submissionId: string,
  selectedAnswer: string,
  timeTakenMs: number | null
): Promise<RecordedPracticeAnswer | null> {
  const refreshed = await resolveSessionSubmission(admin, userId, sessionId, submissionId);
  if (!refreshed?.attemptId || refreshed.questionId !== submission.questionId) return null;

  const { data: attempt, error } = await admin
    .from('attempts')
    .select('id, question_id, selected_answer, is_correct, time_taken_ms, submission_key')
    .eq('id', refreshed.attemptId)
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error || !attempt || attempt.selected_answer === null) return null;
  const exact = attempt.selected_answer === selectedAnswer
    && attempt.time_taken_ms === timeTakenMs
    && attempt.submission_key === submissionId;

  return {
    attemptId: attempt.id,
    questionId: attempt.question_id,
    selectedAnswer: attempt.selected_answer,
    isCorrect: attempt.is_correct,
    timeTakenMs: attempt.time_taken_ms,
    isFirstAnswer: false,
    isReplay: exact,
    isLearningRetry: !exact,
  };
}

export async function POST(request: NextRequest) {
  const user = await getClaimsUser();
  if (!user) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, practiceAnswerSchema);
  if (!parsed.ok) return parsed.response;
  const { sessionId, submissionId, selectedAnswer } = parsed.data;
  const timeTakenMs = parsed.data.timeTakenMs ?? null;

  const admin = createAdminClient();
  const submission = await resolveSessionSubmission(
    admin,
    user.id,
    sessionId,
    submissionId
  );
  if (!submission) {
    return Response.json({ error: 'SESSION_SUBMISSION_NOT_FOUND' }, { status: 404 });
  }

  const { data: question, error: questionError } = await admin
    .from('questions')
    .select('correct_answer, accepted_answers, explanation, status, question_type')
    .eq('id', submission.questionId)
    .single();

  if (questionError || !question || question.status !== 'published') {
    return Response.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
  }

  const currentIsCorrect = question.question_type === 'grid_in'
    ? gridInAnswerMatches(selectedAnswer, question.accepted_answers ?? [])
    : selectedAnswer === question.correct_answer;

  const { data: recordedData, error: recordError } = await admin.rpc(
    'record_practice_session_answer',
    {
      p_user_id: user.id,
      p_session_id: sessionId,
      p_submission_id: submissionId,
      p_selected_answer: selectedAnswer,
      p_is_correct: currentIsCorrect,
      p_time_taken_ms: timeTakenMs,
    }
  );

  let recorded = parseRecordedAnswer(recordedData);
  if (recordError || !recorded) {
    recorded = await reconcileCommittedAnswer(
      admin,
      submission,
      user.id,
      sessionId,
      submissionId,
      selectedAnswer,
      timeTakenMs
    );
  }

  if (!recorded || recorded.questionId !== submission.questionId) {
    console.error('[practice/answer] authoritative attempt persistence failed', {
      recordCode: recordError?.code ?? (recordedData ? 'INVALID_RESULT' : 'EMPTY_RESULT'),
    });
    return Response.json({ error: 'ATTEMPT_SAVE_FAILED' }, { status: 500 });
  }

  let progression: ProgressionOutcome | null = null;
  let progressionWarning: 'PROGRESSION_UNAVAILABLE' | undefined;
  if (!recorded.isLearningRetry) {
    try {
      const progress = await loadProgressionAfterAttempts(admin, user.id, [recorded.attemptId]);
      progression = progressionOutcomeForAttempt(
        recorded.attemptId,
        progress.awards,
        progress.snapshot
      );
    } catch {
      progressionWarning = 'PROGRESSION_UNAVAILABLE';
    }
  }

  const response = {
    isCorrect: currentIsCorrect,
    firstResult: recorded.isCorrect,
    recorded: recorded.isFirstAnswer,
    replayed: recorded.isReplay,
    learningRetry: recorded.isLearningRetry,
    progression,
    ...(progressionWarning ? { warning: progressionWarning } : {}),
  };

  if (!currentIsCorrect) return Response.json(response);

  return Response.json({
    ...response,
    correctAnswer: question.correct_answer,
    explanation: question.explanation,
  });
}
