'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const TARGET_SCORES = ['1200', '1300', '1350', '1400', '1450', '1500', '1550+'];

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    targetScore: '',
    examDate: '',
    marketingOptIn: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName.trim(),
          target_sat_score: form.targetScore
            ? parseInt(form.targetScore.replace('+', ''))
            : null,
          exam_date: form.examDate || null,
          marketing_opt_in: form.marketingOptIn,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('That email is already in use. Want to log in instead?');
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div
      className="rounded-l p-8"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--txt)' }}>
        Create your account
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--txt-soft)' }}>
        Free to start. No credit card required.
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
            {error}{' '}
            {error.includes('already in use') && (
              <Link href="/login" className="font-medium underline">
                Log in
              </Link>
            )}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--txt)' }}>
            Full name
          </label>
          <input
            type="text"
            value={form.fullName}
            onChange={e => set('fullName', e.target.value)}
            placeholder="Amir Karimov"
            required
            autoComplete="name"
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
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
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
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
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

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--txt)' }}>
              Target score{' '}
              <span className="font-normal" style={{ color: 'var(--txt-soft)' }}>
                (optional)
              </span>
            </label>
            <select
              value={form.targetScore}
              onChange={e => set('targetScore', e.target.value)}
              className="rounded px-3 py-2 text-sm w-full outline-none"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: form.targetScore ? 'var(--txt)' : 'var(--muted)',
              }}
            >
              <option value="">Select…</option>
              {TARGET_SCORES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--txt)' }}>
              Exam date{' '}
              <span className="font-normal" style={{ color: 'var(--txt-soft)' }}>
                (optional)
              </span>
            </label>
            <input
              type="date"
              value={form.examDate}
              onChange={e => set('examDate', e.target.value)}
              className="rounded px-3 py-2 text-sm w-full outline-none"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--txt)',
              }}
            />
          </div>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.marketingOptIn}
            onChange={e => set('marketingOptIn', e.target.checked)}
            className="mt-0.5"
            style={{ accentColor: 'var(--green)' }}
          />
          <span className="text-sm leading-snug" style={{ color: 'var(--txt-soft)' }}>
            Send me tips, study reminders, and platform updates. Unsubscribe anytime.
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60 mt-1"
          style={{ background: 'var(--green)', color: '#fff' }}
        >
          {loading ? 'Creating account…' : 'Get started free'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--txt-soft)' }}>
        Already have an account?{' '}
        <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--green)' }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
