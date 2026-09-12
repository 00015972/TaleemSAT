import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import type { NextRequest } from 'next/server';
import type { ClaimsUser } from '@/lib/supabase/server';
import type { ProgressionOutcome, ProgressionSnapshot } from '@/lib/progression/types';

type DbError = { message: string; code?: string } | null;
type QueryResult<T> = { data: T; error: DbError };

const QUESTION_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const SUBMISSION_ID = '33333333-3333-4333-8333-333333333333';

const snapshot: ProgressionSnapshot = {
  timezone: 'Asia/Tashkent',
  today: {
    activityDate: '2026-09-12',
    newQuestions: 1,
    xpEarned: 10,
    streakEarned: false,
    goal: 5,
  },
  weekXp: 10,
  totalXp: 10,
  currentStreak: 0,
  longestStreak: 0,
  lastStreakDate: null,
};

const progression: ProgressionOutcome = {
  isFirstEver: true,
  baseXp: 5,
  bonusXp: 5,
  xpAwarded: 10,
  streakExtended: false,
  snapshot,
};

let user: ClaimsUser | null;
let adminClientCalls: number;
let sessionResult: QueryResult<{ id: string } | null>;
let submissionResults: Array<QueryResult<{ question_id: string; attempt_id: string | null } | null>>;
let questionResult: QueryResult<{
  correct_answer: string;
  accepted_answers: string[];
  explanation: string;
  status: 'published' | 'draft';
  question_type: 'mcq' | 'grid_in';
} | null>;
let rpcResult: QueryResult<unknown>;
let replayAttemptResult: QueryResult<{
  id: string;
  question_id: string;
  selected_answer: string | null;
  is_correct: boolean;
  time_taken_ms: number | null;
  submission_key: string | null;
} | null>;
let rpcArgs: Record<string, unknown> | null;
let filters: Record<string, Array<[string, unknown]>>;
let progressionError: Error | null;
let progressionCalls: string[][];

function recorded(overrides: Record<string, unknown> = {}) {
  return {
    attemptId: 'attempt-1',
    questionId: QUESTION_ID,
    selectedAnswer: 'B',
    isCorrect: true,
    timeTakenMs: 1250,
    isFirstAnswer: true,
    isReplay: false,
    isLearningRetry: false,
    ...overrides,
  };
}

function resetScenario() {
  user = { id: 'student-a', email: 'student-a@example.test', user_metadata: {} };
  adminClientCalls = 0;
  sessionResult = { data: { id: SESSION_ID }, error: null };
  submissionResults = [{ data: { question_id: QUESTION_ID, attempt_id: null }, error: null }];
  questionResult = {
    data: {
      correct_answer: 'B',
      accepted_answers: [],
      explanation: 'Choice B is correct.',
      status: 'published',
      question_type: 'mcq',
    },
    error: null,
  };
  rpcResult = { data: recorded(), error: null };
  replayAttemptResult = {
    data: {
      id: 'attempt-1',
      question_id: QUESTION_ID,
      selected_answer: 'B',
      is_correct: true,
      time_taken_ms: 1250,
      submission_key: SUBMISSION_ID,
    },
    error: null,
  };
  rpcArgs = null;
  filters = {};
  progressionError = null;
  progressionCalls = [];
}

function createQuery(table: string) {
  const tableFilters = filters[table] ?? [];
  filters[table] = tableFilters;
  const query = {
    select() { return query; },
    eq(column: string, value: unknown) {
      tableFilters.push([column, value]);
      return query;
    },
    async single() {
      if (table === 'questions') return questionResult;
      throw new Error(`Unexpected single query for ${table}`);
    },
    async maybeSingle() {
      if (table === 'assessment_sessions') return sessionResult;
      if (table === 'assessment_session_questions') {
        return submissionResults.shift() ?? { data: null, error: null };
      }
      if (table === 'attempts') return replayAttemptResult;
      throw new Error(`Unexpected maybeSingle query for ${table}`);
    },
  };
  return query;
}

function createFakeAdminClient() {
  adminClientCalls += 1;
  return {
    from: createQuery,
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, 'record_practice_session_answer');
      rpcArgs = args;
      return rpcResult;
    },
  };
}

mock.module('@/lib/supabase/server', {
  namedExports: {
    getClaimsUser: async () => user,
    createClient: () => { throw new Error('Student client must not grade answers'); },
  },
});

mock.module('@/lib/supabase/admin', {
  namedExports: { createAdminClient: createFakeAdminClient },
});

mock.module('@/lib/progression/server', {
  namedExports: {
    loadProgressionAfterAttempts: async (
      _client: unknown,
      _userId: string,
      attemptIds: string[]
    ) => {
      progressionCalls.push(attemptIds);
      if (progressionError) throw progressionError;
      return { awards: [], snapshot };
    },
    progressionOutcomeForAttempt: () => progression,
  },
});

function request(value: unknown): NextRequest {
  return new Request('http://localhost/api/practice/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  }) as NextRequest;
}

function validBody(selectedAnswer = 'B') {
  return {
    sessionId: SESSION_ID,
    submissionId: SUBMISSION_ID,
    selectedAnswer,
    timeTakenMs: 1250,
  };
}

test('practice answers are server-authoritative and retry-safe', async t => {
  const { POST } = await import('./answer/route');

  await t.test('rejects signed-out callers before parsing or privileged access', async () => {
    resetScenario();
    user = null;
    const incoming = request('{invalid');
    const response = await POST(incoming);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'AUTH_REQUIRED' });
    assert.equal(incoming.bodyUsed, false);
    assert.equal(adminClientCalls, 0);
  });

  await t.test('rejects legacy recording controls before privileged access', async () => {
    for (const body of [
      '{invalid',
      null,
      { ...validBody(), recordAttempt: false },
      { ...validBody(), questionId: QUESTION_ID },
      { ...validBody(), submissionKey: SUBMISSION_ID },
      { sessionId: SESSION_ID, selectedAnswer: 'B' },
    ]) {
      resetScenario();
      const response = await POST(request(body));
      assert.equal(response.status, 400);
      assert.equal(adminClientCalls, 0);
    }
  });

  await t.test('derives the question from the owned session submission', async () => {
    resetScenario();
    const response = await POST(request(validBody()));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      isCorrect: true,
      firstResult: true,
      recorded: true,
      replayed: false,
      learningRetry: false,
      progression,
      correctAnswer: 'B',
      explanation: 'Choice B is correct.',
    });
    assert.deepEqual(filters.assessment_sessions, [
      ['id', SESSION_ID],
      ['user_id', 'student-a'],
      ['context', 'practice'],
      ['status', 'active'],
    ]);
    assert.deepEqual(filters.assessment_session_questions, [
      ['session_id', SESSION_ID],
      ['submission_id', SUBMISSION_ID],
    ]);
    assert.deepEqual(filters.questions, [['id', QUESTION_ID]]);
    assert.deepEqual(rpcArgs, {
      p_user_id: 'student-a',
      p_session_id: SESSION_ID,
      p_submission_id: SUBMISSION_ID,
      p_selected_answer: 'B',
      p_is_correct: true,
      p_time_taken_ms: 1250,
    });
  });

  await t.test('withholds the answer key for an incorrect first response', async () => {
    resetScenario();
    rpcResult.data = recorded({ selectedAnswer: 'A', isCorrect: false });
    const response = await POST(request(validBody('A')));
    assert.deepEqual(await response.json(), {
      isCorrect: false,
      firstResult: false,
      recorded: true,
      replayed: false,
      learningRetry: false,
      progression,
    });
  });

  await t.test('grades a later guess without changing the stored first result', async () => {
    resetScenario();
    rpcResult.data = recorded({
      selectedAnswer: 'A',
      isCorrect: false,
      isFirstAnswer: false,
      isLearningRetry: true,
    });
    const response = await POST(request(validBody('B')));
    assert.deepEqual(await response.json(), {
      isCorrect: true,
      firstResult: false,
      recorded: false,
      replayed: false,
      learningRetry: true,
      progression: null,
      correctAnswer: 'B',
      explanation: 'Choice B is correct.',
    });
    assert.deepEqual(progressionCalls, []);
  });

  await t.test('returns a saved answer when progression display loading fails', async () => {
    resetScenario();
    progressionError = new Error('snapshot unavailable');
    const response = await POST(request(validBody()));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      isCorrect: true,
      firstResult: true,
      recorded: true,
      replayed: false,
      learningRetry: false,
      progression: null,
      warning: 'PROGRESSION_UNAVAILABLE',
      correctAnswer: 'B',
      explanation: 'Choice B is correct.',
    });
  });

  await t.test('reconciles a committed answer after an ambiguous RPC error', async () => {
    resetScenario();
    rpcResult = { data: null, error: { message: 'fetch failed' } };
    submissionResults = [
      { data: { question_id: QUESTION_ID, attempt_id: null }, error: null },
      { data: { question_id: QUESTION_ID, attempt_id: 'attempt-1' }, error: null },
    ];
    const response = await POST(request(validBody()));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.firstResult, true);
    assert.equal(body.replayed, true);
    assert.equal(body.recorded, false);
    assert.deepEqual(filters.attempts, [
      ['id', 'attempt-1'],
      ['user_id', 'student-a'],
      ['session_id', SESSION_ID],
    ]);
  });

  await t.test('returns a save failure only when no committed attempt exists', async () => {
    resetScenario();
    rpcResult = { data: null, error: { message: 'insert failed', code: 'XX000' } };
    submissionResults = [
      { data: { question_id: QUESTION_ID, attempt_id: null }, error: null },
      { data: { question_id: QUESTION_ID, attempt_id: null }, error: null },
    ];
    const response = await POST(request(validBody()));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'ATTEMPT_SAVE_FAILED' });
  });

  await t.test('rejects sessions or submissions not owned by the caller', async () => {
    resetScenario();
    sessionResult = { data: null, error: null };
    const response = await POST(request(validBody()));
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'SESSION_SUBMISSION_NOT_FOUND' });
    assert.equal(rpcArgs, null);
  });

  await t.test('grades grid-in answers without exposing accepted answers', async () => {
    resetScenario();
    questionResult.data = {
      correct_answer: '3/2',
      accepted_answers: ['3/2', '1.5'],
      explanation: 'Three halves.',
      status: 'published',
      question_type: 'grid_in',
    };
    rpcResult.data = recorded({ selectedAnswer: '6/4' });
    const response = await POST(request(validBody('6/4')));
    const body = await response.json();
    assert.equal(body.isCorrect, true);
    assert.equal(body.correctAnswer, '3/2');
    assert.equal('acceptedAnswers' in body, false);
  });
});
