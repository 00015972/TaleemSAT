import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { NextRequest } from 'next/server';
import type { ClaimsUser } from '@/lib/supabase/server';
import { RECOVERY_COOKIE_NAME } from '@/lib/auth/flow';

let hasRecoveryCookie = true;
let user: ClaimsUser | null = {
  id: 'student-a',
  email: 'student-a@example.test',
  emailVerified: true, user_metadata: {},
};
let updateError: { message: string } | null = null;
let updatedPassword: string | null = null;

mock.module('next/headers', {
  namedExports: {
    cookies: async () => ({
      get: (name: string) =>
        name === RECOVERY_COOKIE_NAME && hasRecoveryCookie
          ? { name, value: '1' }
          : undefined,
    }),
  },
});

mock.module('@/lib/supabase/server', {
  namedExports: {
    getUser: async () => user,
    createClient: async () => ({
      auth: {
        updateUser: async ({ password }: { password: string }) => {
          updatedPassword = password;
          return { error: updateError };
        },
      },
    }),
  },
});

function request(body: string) {
  return new NextRequest('http://localhost/api/auth/recovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

test('recovery update requires the server-issued recovery cookie before reading the body', async () => {
  const { POST } = await import('./route');
  hasRecoveryCookie = false;
  updatedPassword = null;
  const input = request('{not-json');

  const response = await POST(input);

  assert.equal(response.status, 403);
  assert.equal(input.bodyUsed, false);
  assert.equal(updatedPassword, null);
});

test('recovery update requires an authenticated Supabase user', async () => {
  const { POST } = await import('./route');
  hasRecoveryCookie = true;
  user = null;
  updatedPassword = null;

  const response = await POST(request(JSON.stringify({ password: 'new-password' })));

  assert.equal(response.status, 401);
  assert.equal(updatedPassword, null);
});

test('recovery update validates JSON and password bounds', async t => {
  const { POST } = await import('./route');
  hasRecoveryCookie = true;
  user = { id: 'student-a', email: null, emailVerified: true, user_metadata: {} };

  for (const [label, body] of [
    ['invalid JSON', '{not-json'],
    ['missing password', '{}'],
    ['short password', JSON.stringify({ password: 'short' })],
    ['long password', JSON.stringify({ password: 'x'.repeat(129) })],
  ]) {
    await t.test(label, async () => {
      updatedPassword = null;
      const response = await POST(request(body));
      assert.equal(response.status, 400);
      assert.equal(updatedPassword, null);
    });
  }
});

test('recovery update changes the password and consumes recovery state', async () => {
  const { POST } = await import('./route');
  hasRecoveryCookie = true;
  user = { id: 'student-a', email: null, emailVerified: true, user_metadata: {} };
  updateError = null;
  updatedPassword = null;

  const response = await POST(request(JSON.stringify({ password: 'new-password' })));

  assert.equal(response.status, 200);
  assert.equal(updatedPassword, 'new-password');
  assert.match(response.headers.get('set-cookie') ?? '', /taleemsat-recovery=;/);
  assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=0/i);
});

test('provider failures keep recovery state available for a retry', async () => {
  const { POST } = await import('./route');
  hasRecoveryCookie = true;
  user = { id: 'student-a', email: null, emailVerified: true, user_metadata: {} };
  updateError = { message: 'New password should be different from the old password.' };

  const response = await POST(request(JSON.stringify({ password: 'same-password' })));

  assert.equal(response.status, 400);
  assert.equal(response.headers.get('set-cookie'), null);
});
