import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { NextRequest } from 'next/server';
import type { ClaimsUser } from '@/lib/supabase/server';
import type { ProgressionSnapshot } from '@/lib/progression/types';

const SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const QUESTION_IDS = Array.from(
  { length: 5 },
  (_, index) => `${index + 1}1111111-1111-4111-8111-111111111111`
);
const SUBMISSION_IDS = Array.from(
  { length: 5 },
  (_, index) => `${index + 1}2222222-2222-4222-8222-222222222222`
);

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

let user: ClaimsUser | null;
let activeQuestionIds: string[];
let roster: Array<{ question_id: string; submission_id: string; position: number }>;
let rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
let progressionFails: boolean;
let finalizedAttempts: Array<Record<string, unknown>> | null;

type FakeUserResult = { data: ReturnType<typeof questionRows>; error: null };

type FakeUserQuery = {
  select: () => FakeUserQuery;
  eq: () => FakeUserQuery;
  then: (resolve: (value: FakeUserResult) => unknown) => Promise<unknown>;
};

type FakeAdminQuery = {
  select: () => FakeAdminQuery;
  eq: () => FakeAdminQuery;
  maybeSingle: () => Promise<{ data: { id: string; status: string }; error: null }>;
  order: () => Promise<{ data: typeof roster; error: null }>;
  in: () => Promise<{ data: ReturnType<typeof gradingRows>; error: null }>;
};

function questionRows() {
  return QUESTION_IDS.map((id, index) => ({
    id,
    passage: null,
    question_text: `Question ${index + 1}`,
    chart_svg: null,
    tables: [],
    question_type: 'mcq' as const,
    options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],
    difficulty: 'medium',
    tags: [],
    categories: { name: 'Algebra' },
    subjects: { slug: 'math', name: 'Math' },
  }));
}

function gradingRows() {
  return QUESTION_IDS.map(id => ({
    id,
    correct_answer: 'B',
    accepted_answers: [],
    explanation: 'B is correct.',
    question_type: 'mcq' as const,
  }));
}

function resetScenario() {
  user = { id: 'student-a', email: null, user_metadata: {} };
  activeQuestionIds = [];
  roster = [];
  rpcCalls = [];
  progressionFails = false;
  finalizedAttempts = null;
}

function createUserClient() {
  return {
    from(table: string) {
      assert.equal(table, 'questions');
      const query: FakeUserQuery = {
        select() { return query; },
        eq() { return query; },
        then(resolve: (value: FakeUserResult) => unknown) {
          return Promise.resolve({ data: questionRows(), error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}

function createAdminClient() {
  return {
    from(table: string) {
      const query: FakeAdminQuery = {
        select() { return query; },
        eq() { return query; },
        async maybeSingle() {
          if (table === 'assessment_sessions') {
            return { data: { id: SESSION_ID, status: 'active' }, error: null };
          }
          throw new Error(`Unexpected maybeSingle for ${table}`);
        },
        async order() {
          if (table === 'assessment_session_questions') {
            return { data: roster, error: null };
          }
          throw new Error(`Unexpected order for ${table}`);
        },
        async in() {
          if (table === 'questions') return { data: gradingRows(), error: null };
          throw new Error(`Unexpected in for ${table}`);
        },
      };
      return query;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (name === 'create_assessment_session') {
        activeQuestionIds = args.p_question_ids as string[];
        roster = activeQuestionIds.map((questionId, position) => ({
          question_id: questionId,
          submission_id: SUBMISSION_IDS[position],
          position,
        }));
        return {
          data: {
            sessionId: SESSION_ID,
            questions: roster.map(row => ({
              questionId: row.question_id,
              submissionId: row.submission_id,
              position: row.position,
            })),
          },
          error: null,
        };
      }
      if (name === 'finalize_mock_session') {
        const supplied = args.p_results as Array<{
          submission_id: string;
          selected_answer: string | null;
          is_correct: boolean;
          time_taken_ms: number | null;
        }>;
        const replayed = finalizedAttempts !== null;
        if (!finalizedAttempts) {
          finalizedAttempts = roster.map((row, index) => {
            const result = supplied.find(item => item.submission_id === row.submission_id)!;
            return {
              attemptId: `attempt-${index + 1}`,
              questionId: row.question_id,
              submissionId: row.submission_id,
              selectedAnswer: result.selected_answer,
              isCorrect: result.is_correct,
              timeTakenMs: result.time_taken_ms,
            };
          });
        }
        return {
          data: {
            sessionId: SESSION_ID,
            replayed,
            attempts: finalizedAttempts,
          },
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
}

mock.module('@/lib/mock/availability', {
  namedExports: { mocksEnabled: () => true },
});
mock.module('@/lib/supabase/server', {
  namedExports: {
    getClaimsUser: async () => user,
    createClient: async () => createUserClient(),
  },
});
mock.module('@/lib/supabase/admin', {
  namedExports: { createAdminClient },
});
mock.module('@/lib/progression/server', {
  namedExports: {
    loadProgressionAfterAttempts: async () => {
      if (progressionFails) throw new Error('snapshot unavailable');
      return {
        awards: [{
          attemptId: 'attempt-1',
          questionId: activeQuestionIds[0],
          baseXp: 5,
          bonusXp: 5,
          xpAwarded: 10,
          streakExtended: false,
        }],
        snapshot,
      };
    },
  },
});

test('enabled mock implementation uses an authoritative roster and retry-safe finalization', async t => {
  const { GET } = await import('./start/route');
  const { POST } = await import('./submit/route');

  await t.test('issues a server-owned session and submission IDs', async () => {
    resetScenario();
    const response = await GET(new NextRequest('http://localhost/api/mock/start?subject=mixed&count=5'));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sessionId, SESSION_ID);
    assert.equal(body.questions.length, 5);
    assert.equal(typeof body.questions[0].submissionId, 'string');
    assert.equal(rpcCalls[0].name, 'create_assessment_session');
  });

  await t.test('records omitted roster questions as unanswered and owns the total', async () => {
    resetScenario();
    roster = QUESTION_IDS.map((questionId, position) => ({
      question_id: questionId,
      submission_id: SUBMISSION_IDS[position],
      position,
    }));
    activeQuestionIds = [...QUESTION_IDS];
    const response = await POST(new NextRequest('http://localhost/api/mock/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        answers: [{
          submissionId: SUBMISSION_IDS[0],
          selectedAnswer: 'B',
          timeTakenMs: 500,
        }],
      }),
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.summary, { total: 5, correct: 1 });
    assert.equal(body.results.length, 5);
    const finalize = rpcCalls.find(call => call.name === 'finalize_mock_session')!;
    const finalResults = finalize.args.p_results as Array<{ selected_answer: string | null }>;
    assert.equal(finalResults.length, 5);
    assert.equal(finalResults.filter(result => result.selected_answer === null).length, 4);
  });

  await t.test('keeps a committed score successful when progression is unavailable', async () => {
    resetScenario();
    roster = QUESTION_IDS.map((questionId, position) => ({
      question_id: questionId,
      submission_id: SUBMISSION_IDS[position],
      position,
    }));
    activeQuestionIds = [...QUESTION_IDS];
    progressionFails = true;
    const response = await POST(new NextRequest('http://localhost/api/mock/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: SESSION_ID, answers: [] }),
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.summary, { total: 5, correct: 0 });
    assert.equal(body.progression, null);
    assert.equal(body.warning, 'PROGRESSION_UNAVAILABLE');
  });

  await t.test('replays the original finalized score when a retry changes answers', async () => {
    resetScenario();
    roster = QUESTION_IDS.map((questionId, position) => ({
      question_id: questionId,
      submission_id: SUBMISSION_IDS[position],
      position,
    }));
    activeQuestionIds = [...QUESTION_IDS];
    const submit = (selectedAnswer: string) => POST(new NextRequest(
      'http://localhost/api/mock/submit',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: SESSION_ID,
          answers: roster.map(row => ({
            submissionId: row.submission_id,
            selectedAnswer,
          })),
        }),
      }
    ));

    const first = await submit('B');
    const retry = await submit('A');
    assert.deepEqual((await first.json()).summary, { total: 5, correct: 5 });
    const retriedBody = await retry.json();
    assert.deepEqual(retriedBody.summary, { total: 5, correct: 5 });
    assert.equal(retriedBody.results[0].selectedAnswer, 'B');
    assert.equal(rpcCalls.filter(call => call.name === 'finalize_mock_session').length, 2);
  });

  await t.test('rejects a submission identifier outside the session', async () => {
    resetScenario();
    roster = QUESTION_IDS.map((questionId, position) => ({
      question_id: questionId,
      submission_id: SUBMISSION_IDS[position],
      position,
    }));
    const response = await POST(new NextRequest('http://localhost/api/mock/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        answers: [{
          submissionId: '99999999-9999-4999-8999-999999999999',
          selectedAnswer: 'A',
        }],
      }),
    }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'SUBMISSION_NOT_IN_SESSION' });
    assert.equal(rpcCalls.length, 0);
  });
});
