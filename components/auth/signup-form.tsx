'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSignupOutcome } from '@/lib/auth/flow';
import { buildAuthCallbackUrl } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/client';
import { ResendVerificationButton } from '@/components/resend-verification-button';

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
  const [pendingEmail, setPendingEmail] = useState('');
  const submittingRef = useRef(false);

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;

    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
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
          emailRedirectTo: buildAuthCallbackUrl(window.location.origin),
        },
      });

      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          setError('That email is already in use. Want to log in instead?');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (getSignupOutcome(data.session) === 'confirmation-required') {
        setPendingEmail(form.email);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Unable to create your account right now. Please try again.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  if (pendingEmail) {
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
          We sent a confirmation link to{' '}
          <strong style={{ color: 'var(--txt)' }}>{pendingEmail}</strong>. Confirm your address to
          finish creating your account.
        </p>
        <div className="flex flex-col items-center gap-4">
          <ResendVerificationButton email={pendingEmail} />
          <Link
            href="/login"
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--green)' }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
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
            id="signup-error"
            role="alert"
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
          <label
            htmlFor="signup-full-name"
            className="text-sm font-medium"
            style={{ color: 'var(--txt)' }}
          >
            Full name
          </label>
          <input
            id="signup-full-name"
            type="text"
            value={form.fullName}
            onChange={e => set('fullName', e.target.value)}
            placeholder="Amir Karimov"
            required
            autoComplete="name"
            aria-describedby={error ? 'signup-error' : undefined}
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
            htmlFor="signup-email"
            className="text-sm font-medium"
            style={{ color: 'var(--txt)' }}
          >
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            aria-describedby={error ? 'signup-error' : undefined}
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
            htmlFor="signup-password"
            className="text-sm font-medium"
            style={{ color: 'var(--txt)' }}
          >
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              aria-describedby={error ? 'signup-error' : undefined}
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
            <label
              htmlFor="signup-target-score"
              className="text-sm font-medium"
              style={{ color: 'var(--txt)' }}
            >
              Target score{' '}
              <span className="font-normal" style={{ color: 'var(--txt-soft)' }}>
                (optional)
              </span>
            </label>
            <select
              id="signup-target-score"
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
            <label
              htmlFor="signup-exam-date"
              className="text-sm font-medium"
              style={{ color: 'var(--txt)' }}
            >
              Exam date{' '}
              <span className="font-normal" style={{ color: 'var(--txt-soft)' }}>
                (optional)
              </span>
            </label>
            <input
              id="signup-exam-date"
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

        <label htmlFor="signup-marketing" className="flex items-start gap-2.5 cursor-pointer">
          <input
            id="signup-marketing"
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
