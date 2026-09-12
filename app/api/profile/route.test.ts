import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import type { NextRequest } from 'next/server';
import type { ClaimsUser } from '@/lib/supabase/server';

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let user: ClaimsUser | null = null;
let clientCalls = 0;
let updatePayload: Record<string, unknown> | null = null;
let userFilter: [string, unknown] | null = null;
let updateResult: { data: { id: string } | null; error: { message: string } | null };

function resetScenario() {
  user = { id: USER_ID, email: 'student@example.test', user_metadata: {} };
  clientCalls = 0;
  updatePayload = null;
  userFilter = null;
  updateResult = { data: { id: USER_ID }, error: null };
}

function createFakeClient() {
  clientCalls += 1;
  return {
    from(table: string) {
      assert.equal(table, 'users');
      const query = {
        update(payload: Record<string, unknown>) {
          updatePayload = payload;
          return query;
        },
        eq(column: string, value: unknown) {
          userFilter = [column, value];
          return query;
        },
        select() {
          return query;
        },
        async maybeSingle() {
          return updateResult;
        },
      };
      return query;
    },
  };
}

mock.module('@/lib/supabase/server', {
  namedExports: {
    getClaimsUser: async () => user,
    createClient: async () => createFakeClient(),
  },
});

function request(body: string): NextRequest {
  return new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  }) as NextRequest;
}

const validBody = {
  fullName: '  Student Name  ',
  targetSatScore: 1450,
  examDate: '2026-12-05',
  marketingOptIn: false,
};

test('profile updates validate before using the authenticated user-scoped client', async t => {
  const { PATCH } = await import('./route');

  await t.test('rejects signed-out callers before reading the body', async () => {
    resetScenario();
    user = null;
    const incoming = request(JSON.stringify(validBody));
    const response = await PATCH(incoming);

    assert.equal(response.status, 401);
    assert.equal(incoming.bodyUsed, false);
    assert.equal(clientCalls, 0);
  });

  await t.test('rejects malformed or unbounded bodies before database access', async () => {
    for (const body of [
      '{invalid',
      'null',
      '{}',
      JSON.stringify({ ...validBody, targetSatScore: 399 }),
      JSON.stringify({ ...validBody, examDate: '2026-02-30' }),
      JSON.stringify({ ...validBody, fullName: 'x'.repeat(101) }),
      JSON.stringify({ ...validBody, userId: 'attacker-selected-user' }),
    ]) {
      resetScenario();
      const response = await PATCH(request(body));
      assert.equal(response.status, 400);
      assert.equal(clientCalls, 0);
    }
  });

  await t.test('normalizes values and derives ownership from authentication', async () => {
    resetScenario();
    const response = await PATCH(request(JSON.stringify(validBody)));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(clientCalls, 1);
    assert.deepEqual(userFilter, ['id', USER_ID]);
    assert.deepEqual(updatePayload, {
      full_name: 'Student Name',
      target_sat_score: 1450,
      exam_date: '2026-12-05',
      marketing_opt_in: false,
      updated_at: updatePayload?.updated_at,
    });
    assert.equal(typeof updatePayload?.updated_at, 'string');
  });

  await t.test('distinguishes a missing profile from a database failure', async () => {
    resetScenario();
    updateResult = { data: null, error: null };
    assert.equal((await PATCH(request(JSON.stringify(validBody)))).status, 404);

    resetScenario();
    updateResult = { data: null, error: { message: 'write failed' } };
    assert.equal((await PATCH(request(JSON.stringify(validBody)))).status, 500);
  });
});
