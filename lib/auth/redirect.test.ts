import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuthCallbackUrl,
  DEFAULT_AUTH_REDIRECT,
  getSafeAuthRedirect,
} from './redirect';

test('accepts intended internal destinations without losing deep-link state', () => {
  const valid = [
    '/',
    '/dashboard',
    '/question-bank?mode=focus&count=12',
    '/settings#account',
    '/question-bank?progress=100%25',
    '/path/with%20space?topic=heart%20of%20algebra#question-2',
  ];

  for (const destination of valid) {
    assert.equal(getSafeAuthRedirect(destination), destination);
  }
});

test('rejects external, executable, malformed, and ambiguous destinations', () => {
  const invalid: unknown[] = [
    undefined,
    null,
    123,
    '',
    ' dashboard',
    'https://attacker.example',
    'javascript:alert(1)',
    '//attacker.example/path',
    '/\\attacker.example',
    '/%5cattacker.example',
    '/%255cattacker.example',
    '/%2f%2fattacker.example',
    '/%252f%252fattacker.example',
    '/bad%encoding',
    '/dashboard\nnext',
  ];

  for (const destination of invalid) {
    assert.equal(getSafeAuthRedirect(destination), DEFAULT_AUTH_REDIRECT);
  }
});

test('normalizes dot segments while preserving a local destination', () => {
  assert.equal(getSafeAuthRedirect('/question-bank/../dashboard?from=practice'), '/dashboard?from=practice');
});

test('builds callback URLs from sanitized destinations', () => {
  assert.equal(
    buildAuthCallbackUrl('https://taleemsat.com', {
      next: '/reset-password',
      flow: 'recovery',
    }),
    'https://taleemsat.com/auth/callback?next=%2Freset-password&flow=recovery'
  );

  assert.equal(
    buildAuthCallbackUrl('https://taleemsat.com', {
      next: '//attacker.example',
    }),
    'https://taleemsat.com/auth/callback?next=%2Fdashboard'
  );
});
