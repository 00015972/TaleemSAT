import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import type { NextRequest } from 'next/server';
import type { ClaimsUser } from '@/lib/supabase/server';
import type { ProgressionOutcome, ProgressionSnapshot } from '@/lib/progression/types';

type QuestionRow = {
  correct_answer: string;
  accepted_answers: string[];
  explanation: string;
  status: 'draft' | 'published' | 'archived';
  question_type: 'mcq' | 'grid_in';
};

type QueryResult<T> = { data: T; error: { message: string } | null };

let user: ClaimsUser | null = null;
let adminClientCalls = 0;
let questionResult: QueryResult<QuestionRow | null>;
let attemptResult: QueryResult<{ id: string } | null>;
let attemptInsert: Record<string, unknown> | null = null;
let questionSelect: string | null = null;
let questionFilters: Array<[string, unknown]> = [];
let progressionError: Error | null = null;
let progressionArgs: { userId: string; attemptIds: string[] } | null = null;

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

function resetScenario() {
  user = { id: 'student-a', email: 'student-a@example.test', user_metadata: {} };
  adminClientCalls = 0;
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
  attemptResult = { data: { id: 'attempt-1' }, error: null };
  attemptInsert = null;
  questionSelect = null;
  questionFilters = [];
  progressionError = null;
  progressionArgs = null;
}

function unexpectedUserScopedClient() {
  throw new Error('The practice answer route must not use the student-scoped database client');
}

function createFakeAdminClient() {
  adminClientCalls += 1;
  return {
    from(table: string) {
      if (table === 'questions') {
        const query = {
          select(columns: string) {
            questionSelect = columns;
            return query;
          },
          eq(column: string, value: unknown) {
            questionFilters.push([column, value]);
            return query;
          },
          async single() {
            return questionResult;
          },
        };
        return query;
      }

      if (table === 'attempts') {
        const query = {
          insert(values: Record<string, unknown>) {
            attemptInsert = values;
            return query;
          },
          select() {
            return query;
          },
          async single() {
            return attemptResult;
          },
        };
        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

mock.module('@/lib/supabase/server', {
  namedExports: {
    getClaimsUser: async () => user,
    createClient: unexpectedUserScopedClient,
  },
});

mock.module('@/lib/supabase/admin', {
  namedExports: { createAdminClient: createFakeAdminClient },
});

mock.module('@/lib/progression/server', {
  namedExports: {
    loadProgressionAfterAttempts: async (
      _client: unknown,
      userId: string,
      attemptIds: string[]
    ) => {
      progressionArgs = { userId, attemptIds };
      if (progressionError) throw progressionError;
      return { awards: [], snapshot };
    },
    progressionOutcomeForAttempt: () => progression,
  },
});

function request(body: string): NextRequest {
  return new Request('http://localhost/api/practice/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }) as NextRequest;
}

test('practice grading keeps answer keys behind the server-only client', async t => {
  const { POST } = await import('./answer/route');

  await t.test('rejects signed-out callers before parsing or privileged access', async () => {
    resetScenario();
    user = null;
    const incoming = request('{"questionId":"question-1","selectedAnswer":"B"}');

    const response = await POST(incoming);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'AUTH_REQUIRED' });
    assert.equal(incoming.bodyUsed, false);
    assert.equal(adminClientCalls, 0);
  });

  await t.test('rejects malformed and incomplete bodies before privileged access', async () => {
    for (const body of ['{invalid', 'null', '{}', '{"questionId":"question-1"}']) {
      resetScenario();
      const response = await POST(request(body));
      assert.equal(response.status, 400);
      assert.equal(adminClientCalls, 0);
    }
  });

  await t.test('withholds the key and skips persistence for an incorrect retry', async () => {
    resetScenario();

    const response = await POST(request(JSON.stringify({
      questionId: 'question-1',
      selectedAnswer: 'A',
      recordAttempt: false,
    })));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { isCorrect: false, progression: null });
    assert.equal(adminClientCalls, 1);
    assert.equal(attemptInsert, null);
  });

  await t.test('grades and records a correct MCQ through one privileged client', async () => {
    resetScenario();

    const response = await POST(request(JSON.stringify({
      questionId: 'question-1',
      selectedAnswer: 'B',
      timeTakenMs: 1250,
      recordAttempt: true,
    })));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      isCorrect: true,
      correctAnswer: 'B',
      explanation: 'Choice B is correct.',
      progression,
    });
    assert.equal(adminClientCalls, 1);
    assert.equal(
      questionSelect,
      'correct_answer, accepted_answers, explanation, status, question_type'
    );
    assert.deepEqual(questionFilters, [['id', 'question-1']]);
    assert.deepEqual(attemptInsert, {
      user_id: 'student-a',
      question_id: 'question-1',
      selected_answer: 'B',
      is_correct: true,
      time_taken_ms: 1250,
      context: 'practice',
    });
    assert.deepEqual(progressionArgs, {
      userId: 'student-a',
      attemptIds: ['attempt-1'],
    });
  });

  await t.test('grades grid-in answers without exposing the accepted-answer list', async () => {
    resetScenario();
    questionResult.data = {
      correct_answer: '3/2',
      accepted_answers: ['3/2', '1.5'],
      explanation: 'The value is three halves.',
      status: 'published',
      question_type: 'grid_in',
    };

    const response = await POST(request(JSON.stringify({
      questionId: 'question-2',
      selectedAnswer: '6/4',
      recordAttempt: false,
    })));

    assert.deepEqual(await response.json(), {
      isCorrect: true,
      correctAnswer: '3/2',
      explanation: 'The value is three halves.',
      progression: null,
    });
  });

  await t.test('does not record missing or unpublished questions', async () => {
    for (const data of [
      null,
      { ...questionResult.data!, status: 'draft' as const },
      { ...questionResult.data!, status: 'archived' as const },
    ]) {
      resetScenario();
      questionResult.data = data;
      const response = await POST(request(JSON.stringify({
        questionId: 'question-1',
        selectedAnswer: 'B',
        recordAttempt: true,
      })));

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'QUESTION_NOT_FOUND' });
      assert.equal(attemptInsert, null);
    }
  });

  await t.test('returns a stable error when the trusted attempt write fails', async () => {
    resetScenario();
    attemptResult = { data: null, error: { message: 'insert failed' } };

    const response = await POST(request(JSON.stringify({
      questionId: 'question-1',
      selectedAnswer: 'B',
      recordAttempt: true,
    })));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'ATTEMPT_SAVE_FAILED' });
  });

  await t.test('reports progression read failure after a saved attempt', async () => {
    resetScenario();
    progressionError = new Error('progression unavailable');

    const response = await POST(request(JSON.stringify({
      questionId: 'question-1',
      selectedAnswer: 'B',
      recordAttempt: true,
    })));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'PROGRESSION_READ_FAILED' });
  });
});
