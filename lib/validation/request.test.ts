import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { invalidPathParameter, parseJsonRequest } from './request';

const schema = z.strictObject({ value: z.string().max(5) });

function request(body: string) {
  return new Request('http://localhost/example', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

test('distinguishes malformed JSON from an invalid body', async () => {
  const malformed = await parseJsonRequest(request('{invalid'), schema);
  assert.equal(malformed.ok, false);
  if (!malformed.ok) {
    assert.equal(malformed.response.status, 400);
    assert.deepEqual(await malformed.response.json(), { error: 'INVALID_JSON' });
  }

  const invalid = await parseJsonRequest(request('{"value":"too long"}'), schema);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.response.status, 400);
    const body = await invalid.response.json();
    assert.equal(body.error, 'INVALID_BODY');
    assert.deepEqual(body.issues.map((issue: { path: string }) => issue.path), ['value']);
  }
});

test('returns parsed data without unknown keys', async () => {
  const result = await parseJsonRequest(request('{"value":"okay"}'), schema);
  assert.deepEqual(result, { ok: true, data: { value: 'okay' } });

  const extra = await parseJsonRequest(request('{"value":"okay","extra":true}'), schema);
  assert.equal(extra.ok, false);
});

test('uses a stable invalid path-parameter response', async () => {
  const response = invalidPathParameter('itemId');
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'INVALID_PATH_PARAMETER',
    issues: [{ path: 'itemId', message: 'Expected a UUID.' }],
  });
});
