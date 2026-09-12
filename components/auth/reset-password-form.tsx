'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import {
  AuthAlert,
  AuthPanelHeader,
  AuthPasswordInput,
  AuthStage,
  AuthSubmitButton,
} from '@/components/auth/auth-ui';

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;

    setError('');
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? 'Unable to update your password. Please request a new link.');
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Unable to update your password right now. Please try again.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthStage art="reset">
      <AuthPanelHeader
        eyebrow="Secure restart"
        title="Choose a new password."
        description="Make it memorable to you and difficult for anyone else to guess."
      />

      <form onSubmit={handleSubmit} className="auth-form">
        {error && <AuthAlert id="reset-password-error">{error}</AuthAlert>}

        <div className="auth-field">
          <label htmlFor="new-password">New password</label>
          <div className="auth-field-control">
            <LockKeyhole size={17} aria-hidden="true" />
            <AuthPasswordInput
              id="new-password"
              value={password}
              onChange={setPassword}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              describedBy={error ? 'reset-password-error' : 'password-hint'}
            />
          </div>
          <small id="password-hint" className="auth-field-hint">Use 8–128 characters.</small>
        </div>

        <div className="auth-field">
          <label htmlFor="confirm-password">Confirm password</label>
          <div className="auth-field-control">
            <ShieldCheck size={17} aria-hidden="true" />
            <AuthPasswordInput
              id="confirm-password"
              value={confirm}
              onChange={setConfirm}
              placeholder="Repeat your new password"
              autoComplete="new-password"
              describedBy={error ? 'reset-password-error' : undefined}
            />
          </div>
        </div>

        <AuthSubmitButton loading={loading} label="Save new password" loadingLabel="Updating…" />
      </form>

      <div className="auth-security-line"><ShieldCheck size={14} aria-hidden="true" /> Your recovery session is protected.</div>
    </AuthStage>
  );
}
