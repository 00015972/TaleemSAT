'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  if (!ready) {
    return (
      <div
        className="rounded-l p-8 text-center"
        style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm mb-4" style={{ color: 'var(--txt-soft)' }}>
          Verifying your reset link…
        </p>
        <Link
          href="/forgot-password"
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--green)' }}
        >
          Request a new link
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
        Choose a new password
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--txt-soft)' }}>
        Pick something strong that you haven&apos;t used before.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p
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
          <label className="text-sm font-medium" style={{ color: 'var(--txt)' }}>
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded px-3 py-2 text-sm w-full outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--txt)',
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--txt)' }}>
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
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
