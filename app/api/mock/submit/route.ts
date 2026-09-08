import { createClient, getClaimsUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';
import { gridInAnswerMatches } from '@/lib/grading/grid-in';
import { loadProgressionAfterAttempts } from '@/lib/progression/server';
import type { MockProgressionSummary } from '@/lib/progression/types';

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
  const user = await getClaimsUser();
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
  const { data: qs, error: questionError } = await supabase
    .from('questions')
    .select('id, correct_answer, accepted_answers, explanation, status, question_type')
    .in('id', ids)
    .eq('status', 'published');

  if (questionError) {
    return Response.json({ error: 'QUESTION_LOAD_FAILED' }, { status: 500 });
  }

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

  const admin = createAdminClient();
  let attemptIds: string[] = [];
  if (inserts.length > 0) {
    const { data: inserted, error: insertError } = await admin
      .from('attempts')
      .insert(inserts)
      .select('id');
    if (insertError) {
      return Response.json({ error: 'ATTEMPT_SAVE_FAILED' }, { status: 500 });
    }
    attemptIds = (inserted ?? []).map(row => row.id);
  }

  let progress: Awaited<ReturnType<typeof loadProgressionAfterAttempts>>;
  try {
    progress = await loadProgressionAfterAttempts(admin, user.id, attemptIds);
  } catch {
    return Response.json({ error: 'PROGRESSION_READ_FAILED' }, { status: 500 });
  }
  const awardsByQuestion = new Map(progress.awards.map(award => [award.questionId, award]));
  const rewardedQuestions = new Set<string>();
  const rewardedResults = results.map(result => {
    const award = awardsByQuestion.get(result.questionId);
    const isFirstEver = Boolean(award) && !rewardedQuestions.has(result.questionId);
    if (isFirstEver) rewardedQuestions.add(result.questionId);
    return {
      ...result,
      isFirstEver,
      xpAwarded: isFirstEver ? (award?.xpAwarded ?? 0) : 0,
    };
  });
  const progression: MockProgressionSummary = {
    newQuestions: progress.awards.length,
    xpAwarded: progress.awards.reduce((sum, award) => sum + award.xpAwarded, 0),
    streakExtended: progress.awards.some(award => award.streakExtended),
    snapshot: progress.snapshot,
  };

  const total = results.length;
  const correct = results.filter(r => r.isCorrect).length;

  return Response.json({ results: rewardedResults, summary: { total, correct }, progression });
}
