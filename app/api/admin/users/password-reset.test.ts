import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { NextRequest } from 'next/server';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';
let authorized = true;
let clientCalls = 0;
let resetError: { message: string } | null = null;
let resetEmail = '';
let resetRedirect = '';
let auditEntry: Record<string, unknown> | null = null;

function resetScenario() {
  authorized = true;
  clientCalls = 0;
  resetError = null;
  resetEmail = '';
  resetRedirect = '';
  auditEntry = null;
}

function fakeAdmin() {
  clientCalls += 1;
  const query = {
    select() { return query; },
    eq() { return query; },
    async maybeSingle() {
      return { data: { email: 'learner@example.test' }, error: null };
    },
  };
  return {
    from(table: string) {
      assert.equal(table, 'users');
      return query;
    },
    auth: {
      async resetPasswordForEmail(email: string, options: { redirectTo: string }) {
        resetEmail = email;
        resetRedirect = options.redirectTo;
        return { error: resetError };
      },
    },
  };
}

mock.module('@/lib/admin/require-admin', {
  namedExports: {
    requireAdmin: async () => authorized
      ? { ok: true, user: { id: ADMIN_ID, email: 'admin@example.test' } }
      : { ok: false, response: Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 }) },
  },
});

mock.module('@/lib/supabase/admin', {
  namedExports: { createAdminClient: () => fakeAdmin() },
});

mock.module('@/lib/admin/audit', {
  namedExports: {
    logAudit: async (_client: unknown, entry: Record<string, unknown>) => {
      auditEntry = entry;
    },
  },
});

function request() {
  return new NextRequest(`http://localhost/api/admin/users/${TARGET_ID}/password-reset`, {
    method: 'POST',
  });
}

test('admin password-reset requests preserve authorization and recovery privacy', async t => {
  const { POST } = await import('./[id]/password-reset/route');

  await t.test('rejects unauthenticated callers before creating an admin client', async () => {
    resetScenario();
    authorized = false;
    const response = await POST(request(), { params: Promise.resolve({ id: TARGET_ID }) });
    assert.equal(response.status, 401);
    assert.equal(clientCalls, 0);
  });

  await t.test('rejects malformed target IDs before database access', async () => {
    resetScenario();
    const response = await POST(request(), { params: Promise.resolve({ id: 'not-a-uuid' }) });
    assert.equal(response.status, 400);
    assert.equal(clientCalls, 0);
  });

  await t.test('requests the fixed recovery callback and returns no sensitive link', async () => {
    resetScenario();
    const response = await POST(request(), { params: Promise.resolve({ id: TARGET_ID }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(resetEmail, 'learner@example.test');
    assert.equal(
      resetRedirect,
      'http://localhost/auth/callback?next=%2Freset-password&flow=recovery'
    );
    assert.deepEqual(auditEntry, {
      actorUserId: ADMIN_ID,
      action: 'user.password_reset.request',
      targetType: 'user',
      targetId: TARGET_ID,
      note: 'Password recovery email requested by an administrator',
    });
  });

  await t.test('does not audit a provider failure', async () => {
    resetScenario();
    resetError = { message: 'provider unavailable' };
    const response = await POST(request(), { params: Promise.resolve({ id: TARGET_ID }) });
    assert.equal(response.status, 502);
    assert.equal(auditEntry, null);
    assert.deepEqual(await response.json(), { error: 'RESET_FAILED' });
  });
});
