'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { buildAuthCallbackUrl } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/client';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: buildAuthCallbackUrl(window.location.origin, {
          next: '/reset-password',
          flow: 'recovery',
        }),
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);
    } catch {
      setError('Unable to send a reset link right now. Please try again.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div
        className="rounded-l p-8 text-center"
        style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
      >
        <div className="text-3xl mb-4" aria-hidden="true">
          ✉️
        </div>
        <h1 className="font-serif text-2xl font-bold mb-2" style={{ color: 'var(--txt)' }}>
          Check your email
        </h1>
        <p
          role="status"
          className="text-sm mb-6 leading-relaxed"
          style={{ color: 'var(--txt-soft)' }}
        >
          We sent a password reset link to{' '}
          <strong style={{ color: 'var(--txt)' }}>{email}</strong>. Follow that link to choose a
          new password.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--green)' }}
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div
      className="rounded-l p-8"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--txt)' }}>
        Reset your password
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--txt-soft)' }}>
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p
            id="forgot-password-error"
            role="alert"
            className="rounded p-3 text-sm"
            style={{
              background: 'color-mix(in srgb, var(--err) 10%, transparent)',
              color: 'var(--err)',
            }}
          >
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="forgot-password-email"
            className="text-sm font-medium"
            style={{ color: 'var(--txt)' }}
          >
            Email
          </label>
          <input
            id="forgot-password-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            aria-describedby={error ? 'forgot-password-error' : undefined}
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
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--txt-soft)' }}>
        Remembered it?{' '}
        <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--green)' }}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
