import { getSafeAuthRedirect } from './redirect';

export const RECOVERY_COOKIE_NAME = 'taleemsat-recovery';
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 15 * 60;

export type SignupOutcome = 'authenticated' | 'confirmation-required';

export function getSignupOutcome(session: unknown): SignupOutcome {
  return session ? 'authenticated' : 'confirmation-required';
}

export function isRecoveryCallback(next: unknown, flow: unknown) {
  return (
    getSafeAuthRedirect(next) === '/reset-password' &&
    next === '/reset-password' &&
    flow === 'recovery'
  );
}

export function getCallbackFailurePath(isRecovery: boolean) {
  return isRecovery
    ? '/reset-password?error=invalid_or_expired'
    : '/login?error=auth_callback_failed';
}
