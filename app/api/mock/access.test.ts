import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import type { ClaimsUser } from '@/lib/supabase/server';

let user: ClaimsUser | null = null;
let databaseCalls = 0;

function unexpectedDatabaseAccess() {
  databaseCalls += 1;
  throw new Error('Mock endpoints must not access questions or attempts');
}

mock.module('@/lib/supabase/server', {
  namedExports: {
    getClaimsUser: async () => user,
    createClient: unexpectedDatabaseAccess,
  },
});
mock.module('@/lib/supabase/admin', {
  namedExports: { createAdminClient: unexpectedDatabaseAccess },
});

test('mock APIs enforce the development restriction before processing requests', async t => {
  const { GET } = await import('./start/route');
  const { POST } = await import('./submit/route');
  const endpoints: { method: string; path: string; handler: (request: Request) => Promise<Response> }[] = [
    { method: 'GET', path: 'start', handler: GET },
    { method: 'POST', path: 'submit', handler: POST },
  ];
  const identities = [
    { label: 'signed out', metadata: null },
    ...['free', 'pro', 'elite'].map(tier => ({
      label: `${tier} student`, metadata: { role: 'student', tier },
    })),
    { label: 'admin metadata cannot enable a preview', metadata: { role: 'admin', tier: 'elite' } },
  ];

  for (const { method, path, handler } of endpoints) {
    for (const { label, metadata } of identities) {
      for (const body of method === 'POST' ? ['{"answers":[{"questionId":"example","selectedAnswer":"A"}]}', '{invalid', 'null'] : [undefined]) {
        await t.test(`${method} ${path}: ${label}, body ${body ?? 'none'}`, async () => {
          user = metadata ? { id: 'test-user', email: null, user_metadata: metadata } : null;
          databaseCalls = 0;
          const request = new Request(`http://localhost/api/mock/${path}?preview=true&role=admin&subject=math&count=40`, {
            method,
            ...(body === undefined ? {} : { body, headers: { 'Content-Type': 'application/json' } }),
          });
          const response = await handler(request);

          assert.equal(response.status, user ? 403 : 401);
          assert.deepEqual(await response.json(), user
            ? { error: 'MOCK_IN_DEVELOPMENT', message: 'Mock tests are in development' }
            : { error: 'AUTH_REQUIRED' });
          assert.equal(request.bodyUsed, false, 'denial must precede body parsing');
          assert.equal(databaseCalls, 0, 'denial must precede all database access');
        });
      }
    }
  }
});
