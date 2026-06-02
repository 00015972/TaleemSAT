'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message.toLowerCase().includes('invalid')
          ? 'Incorrect email or password. Please try again.'
          : error.message
      );
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div
      className="rounded-l p-8"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--txt)' }}>
        Welcome back
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--txt-soft)' }}>
        Sign in to continue your SAT journey.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p
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
          <label className="text-sm font-medium" style={{ color: 'var(--txt)' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="rounded px-3 py-2 text-sm w-full outline-none transition-colors focus:ring-1"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--txt)',
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" style={{ color: 'var(--txt)' }}>
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs hover:underline"
              style={{ color: 'var(--green)' }}
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="rounded px-3 py-2 text-sm w-full outline-none pr-14"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--txt)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
              style={{ color: 'var(--txt-soft)' }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60 mt-1"
          style={{ background: 'var(--green)', color: '#fff' }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--txt-soft)' }}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium hover:underline" style={{ color: 'var(--green)' }}>
          Sign up free
        </Link>
      </p>
    </div>
  );
}
