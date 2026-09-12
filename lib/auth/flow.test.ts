import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCallbackFailurePath,
  getSignupOutcome,
  isRecoveryCallback,
} from './flow';

test('signup result distinguishes active sessions from confirmation-required accounts', () => {
  assert.equal(getSignupOutcome({ access_token: 'present' }), 'authenticated');
  assert.equal(getSignupOutcome(null), 'confirmation-required');
  assert.equal(getSignupOutcome(undefined), 'confirmation-required');
});

test('recovery callbacks require the exact fixed destination and flow', () => {
  assert.equal(isRecoveryCallback('/reset-password', 'recovery'), true);
  assert.equal(isRecoveryCallback('/reset-password?next=anything', 'recovery'), false);
  assert.equal(isRecoveryCallback('//attacker.example', 'recovery'), false);
  assert.equal(isRecoveryCallback('/reset-password', 'signup'), false);
});

test('callback failures lead to an actionable flow-specific page', () => {
  assert.equal(
    getCallbackFailurePath(true),
    '/reset-password?error=invalid_or_expired'
  );
  assert.equal(
    getCallbackFailurePath(false),
    '/login?error=auth_callback_failed'
  );
});
