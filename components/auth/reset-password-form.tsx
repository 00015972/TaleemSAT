'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <div
      className="rounded-l p-8"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--txt)' }}>
        Choose a new password
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--txt-soft)' }}>
        Pick something strong that you haven&apos;t used before.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p
            id="reset-password-error"
            role="alert"
            className="rounded p-3 text-sm"
            style={{
              background: 'color-mix(in srgb, var(--err) 10%, transparent)',
              color: 'var(--err)',
              border: '1px solid color-mix(in srgb, var(--err) 25%, transparent)',
            }}
          >
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="new-password"
            className="text-sm font-medium"
            style={{ color: 'var(--txt)' }}
          >
            New password
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            aria-describedby={error ? 'reset-password-error' : undefined}
            className="rounded px-3 py-2 text-sm w-full outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--txt)',
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirm-password"
            className="text-sm font-medium"
            style={{ color: 'var(--txt)' }}
          >
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={event => setConfirm(event.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            aria-describedby={error ? 'reset-password-error' : undefined}
            className="rounded px-3 py-2 text-sm w-full outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--txt)',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded py-2.5 text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--green)', color: '#fff' }}
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
