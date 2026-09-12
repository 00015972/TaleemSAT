import { getClaimsUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';
import { gridInAnswerMatches } from '@/lib/grading/grid-in';
import { loadProgressionAfterAttempts } from '@/lib/progression/server';
import type { MockProgressionSummary } from '@/lib/progression/types';
import { parseJsonRequest } from '@/lib/validation/request';
import { mockSubmissionSchema } from '@/lib/validation/schemas';
import { mocksEnabled } from '@/lib/mock/availability';

export const dynamic = 'force-dynamic';

type RosterRow = {
  question_id: string;
  submission_id: string;
  position: number;
};

type QuestionRow = {
  id: string;
  correct_answer: string;
  accepted_answers: string[];
  explanation: string;
  question_type: 'mcq' | 'grid_in';
};

type SavedAttempt = {
  attemptId: string;
  questionId: string;
  submissionId: string;
  selectedAnswer: string | null;
  isCorrect: boolean;
  timeTakenMs: number | null;
};

function parseSavedAttempts(value: unknown): SavedAttempt[] | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const attempts = (value as { attempts?: unknown }).attempts;
  if (!Array.isArray(attempts)) return null;
  const parsed = attempts.flatMap(item => {
    if (!item || Array.isArray(item) || typeof item !== 'object') return [];
    const row = item as Partial<SavedAttempt>;
    return typeof row.attemptId === 'string'
      && typeof row.questionId === 'string'
      && typeof row.submissionId === 'string'
      && (typeof row.selectedAnswer === 'string' || row.selectedAnswer === null)
      && typeof row.isCorrect === 'boolean'
      && (typeof row.timeTakenMs === 'number' || row.timeTakenMs === null)
      ? [row as SavedAttempt]
      : [];
  });
  return parsed.length === attempts.length ? parsed : null;
}

async function reconcileMockAttempts(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  sessionId: string,
  expectedCount: number
): Promise<SavedAttempt[] | null> {
  const { data, error } = await admin
    .from('attempts')
    .select('id, question_id, selected_answer, is_correct, time_taken_ms, submission_key')
    .eq('user_id', userId)
    .eq('session_id', sessionId);
  if (error || !data || data.length !== expectedCount) return null;
  return data.flatMap(attempt => attempt.submission_key ? [{
    attemptId: attempt.id,
    questionId: attempt.question_id,
    submissionId: attempt.submission_key,
    selectedAnswer: attempt.selected_answer,
    isCorrect: attempt.is_correct,
    timeTakenMs: attempt.time_taken_ms,
  }] : []);
}

async function submitEnabledMockSession(request: NextRequest, userId: string) {
  const parsed = await parseJsonRequest(request, mockSubmissionSchema);
  if (!parsed.ok) return parsed.response;
  const { sessionId, answers } = parsed.data;

  const admin = createAdminClient();
  const { data: session, error: sessionError } = await admin
    .from('assessment_sessions')
    .select('id, status')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .eq('context', 'mock')
    .maybeSingle();
  if (sessionError || !session) {
    return Response.json({ error: 'MOCK_SESSION_NOT_FOUND' }, { status: 404 });
  }

  const { data: rosterData, error: rosterError } = await admin
    .from('assessment_session_questions')
    .select('question_id, submission_id, position')
    .eq('session_id', sessionId)
    .order('position');
  const roster = (rosterData ?? []) as RosterRow[];
  if (rosterError || roster.length === 0) {
    return Response.json({ error: 'MOCK_SESSION_NOT_FOUND' }, { status: 404 });
  }

  const rosterBySubmission = new Map(roster.map(row => [row.submission_id, row]));
  if (answers.some(answer => !rosterBySubmission.has(answer.submissionId))) {
    return Response.json({ error: 'SUBMISSION_NOT_IN_SESSION' }, { status: 400 });
  }

  const { data: questionData, error: questionError } = await admin
    .from('questions')
    .select('id, correct_answer, accepted_answers, explanation, question_type')
    .in('id', roster.map(row => row.question_id));
  const questions = (questionData ?? []) as QuestionRow[];
  if (questionError || questions.length !== roster.length) {
    return Response.json({ error: 'QUESTION_LOAD_FAILED' }, { status: 500 });
  }

  const questionsById = new Map(questions.map(question => [question.id, question]));
  const supplied = new Map(answers.map(answer => [answer.submissionId, answer]));
  const finalResults = roster.map(row => {
    const question = questionsById.get(row.question_id)!;
    const answer = supplied.get(row.submission_id);
    const selectedAnswer = answer?.selectedAnswer ?? null;
    const isCorrect = selectedAnswer !== null && (
      question.question_type === 'grid_in'
        ? gridInAnswerMatches(selectedAnswer, question.accepted_answers ?? [])
        : selectedAnswer === question.correct_answer
    );
    return {
      submission_id: row.submission_id,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      time_taken_ms: answer?.timeTakenMs ?? null,
    };
  });

  const { data: finalizeData, error: finalizeError } = await admin.rpc(
    'finalize_mock_session',
    {
      p_user_id: userId,
      p_session_id: sessionId,
      p_results: finalResults,
    }
  );

  let savedAttempts = parseSavedAttempts(finalizeData);
  if (finalizeError || !savedAttempts || savedAttempts.length !== roster.length) {
    savedAttempts = await reconcileMockAttempts(admin, userId, sessionId, roster.length);
  }
  if (!savedAttempts || savedAttempts.length !== roster.length) {
    console.error('[mock/submit] authoritative finalization failed', {
      finalizeCode: finalizeError?.code ?? (finalizeData ? 'INVALID_RESULT' : 'EMPTY_RESULT'),
    });
    return Response.json({ error: 'ATTEMPT_SAVE_FAILED' }, { status: 500 });
  }

  let progress: Awaited<ReturnType<typeof loadProgressionAfterAttempts>> | null = null;
  let warning: 'PROGRESSION_UNAVAILABLE' | undefined;
  try {
    progress = await loadProgressionAfterAttempts(
      admin,
      userId,
      savedAttempts.map(attempt => attempt.attemptId)
    );
  } catch {
    warning = 'PROGRESSION_UNAVAILABLE';
  }

  const awardsByQuestion = new Map(
    (progress?.awards ?? []).map(award => [award.questionId, award])
  );
  const attemptsByQuestion = new Map(savedAttempts.map(attempt => [attempt.questionId, attempt]));
  const rewardedQuestions = new Set<string>();
  const results = roster.map(row => {
    const question = questionsById.get(row.question_id)!;
    const attempt = attemptsByQuestion.get(row.question_id)!;
    const award = awardsByQuestion.get(row.question_id);
    const isFirstEver = Boolean(award) && !rewardedQuestions.has(row.question_id);
    if (isFirstEver) rewardedQuestions.add(row.question_id);
    return {
      questionId: row.question_id,
      selectedAnswer: attempt.selectedAnswer,
      correctAnswer: question.correct_answer,
      isCorrect: attempt.isCorrect,
      explanation: question.explanation,
      isFirstEver,
      xpAwarded: isFirstEver ? (award?.xpAwarded ?? 0) : 0,
    };
  });

  const progression: MockProgressionSummary | null = progress ? {
    newQuestions: progress.awards.length,
    xpAwarded: progress.awards.reduce((sum, award) => sum + award.xpAwarded, 0),
    streakExtended: progress.awards.some(award => award.streakExtended),
    snapshot: progress.snapshot,
  } : null;

  return Response.json({
    results,
    summary: {
      total: roster.length,
      correct: savedAttempts.filter(attempt => attempt.isCorrect).length,
    },
    progression,
    ...(warning ? { warning } : {}),
  });
}

export async function POST(request: NextRequest) {
  const user = await getClaimsUser();
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  if (!mocksEnabled()) {
    return Response.json(
      { error: 'MOCK_IN_DEVELOPMENT', message: 'Mock tests are in development' },
      { status: 403 }
    );
  }

  return submitEnabledMockSession(request, user.id);
}
