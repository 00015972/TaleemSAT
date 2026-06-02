'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const TARGET_SCORES = ['1200', '1300', '1350', '1400', '1450', '1500', '1550+'];

type Profile = {
  fullName: string;
  targetScore: string;
  examDate: string;
  marketingOptIn: boolean;
};

type SettingsFormProps = {
  userId: string;
  email: string;
  tier: string;
  initial: Profile;
};

export function SettingsForm({ userId, email, tier, initial }: SettingsFormProps) {
  const [form, setForm] = useState<Profile>(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [resetSent, setResetSent] = useState(false);

  function set(field: keyof Profile, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (status === 'saved') setStatus('idle');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setErrorMsg('');

    const supabase = createClient();
    const scoreRaw = form.targetScore.replace('+', '');
    const { error } = await supabase
      .from('users')
      .update({
        full_name: form.fullName.trim() || null,
        target_sat_score: scoreRaw ? parseInt(scoreRaw) : null,
        exam_date: form.examDate || null,
        marketing_opt_in: form.marketingOptIn,
      })
      .eq('id', userId);

    if (error) {
      setErrorMsg('Failed to save changes. Please try again.');
      setStatus('error');
    } else {
      setStatus('saved');
    }
  }

  async function sendPasswordReset() {
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setResetSent(true);
  }

  return (
    <div className="flex flex-col gap-8 max-w-xl">
      {/* Profile */}
      <section>
        <h2 className="text-base font-semibold mb-4 text-txt">Profile</h2>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {status === 'error' && (
            <p
              className="rounded p-3 text-sm"
              style={{
                background: 'color-mix(in srgb, var(--err) 10%, transparent)',
                color: 'var(--err)',
              }}
            >
              {errorMsg}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-txt">Full name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={e => set('fullName', e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="rounded px-3 py-2 text-sm w-full outline-none bg-bg border border-border text-txt"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-txt">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="rounded px-3 py-2 text-sm w-full outline-none bg-bg border border-border opacity-60"
              style={{ color: 'var(--txt-soft)', cursor: 'not-allowed' }}
            />
            <p className="text-xs text-muted">Email cannot be changed here.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-txt">
                Target score
              </label>
              <select
                value={form.targetScore}
                onChange={e => set('targetScore', e.target.value)}
                className="rounded px-3 py-2 text-sm w-full outline-none bg-bg border border-border text-txt"
              >
                <option value="">Not set</option>
                {TARGET_SCORES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-txt">Exam date</label>
              <input
                type="date"
                value={form.examDate}
                onChange={e => set('examDate', e.target.value)}
                className="rounded px-3 py-2 text-sm w-full outline-none bg-bg border border-border text-txt"
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
            <span className="text-sm leading-snug text-muted">
              Receive tips, study reminders, and platform updates.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={status === 'saving'}
              className="rounded px-4 py-2 text-sm font-semibold bg-green text-white disabled:opacity-60 transition-opacity"
            >
              {status === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
            {status === 'saved' && (
              <span className="text-sm" style={{ color: 'var(--ok)' }}>
                Saved!
              </span>
            )}
          </div>
        </form>
      </section>

      <hr style={{ borderColor: 'var(--border)' }} />

      {/* Security */}
      <section>
        <h2 className="text-base font-semibold mb-1 text-txt">Security</h2>
        <p className="text-sm text-muted mb-4">
          Change your password via email link.
        </p>
        {resetSent ? (
          <p className="text-sm" style={{ color: 'var(--ok)' }}>
            Reset link sent to {email}. Check your inbox.
          </p>
        ) : (
          <button
            type="button"
            onClick={sendPasswordReset}
            className="rounded px-4 py-2 text-sm font-medium border border-border text-txt hover:bg-surf2 transition-colors"
          >
            Send password reset email
          </button>
        )}
      </section>

      <hr style={{ borderColor: 'var(--border)' }} />

      {/* Subscription */}
      <section>
        <h2 className="text-base font-semibold mb-1 text-txt">Subscription</h2>
        <p className="text-sm text-muted mb-4">
          You are on the{' '}
          <span
            className="font-semibold capitalize"
            style={{ color: tier === 'free' ? 'var(--txt)' : 'var(--gold)' }}
          >
            {tier}
          </span>{' '}
          plan.
        </p>
        {tier === 'free' && (
          <button
            type="button"
            disabled
            className="rounded px-4 py-2 text-sm font-semibold opacity-50 cursor-not-allowed"
            style={{ background: 'var(--gold)', color: '#fff' }}
            title="Payments coming soon"
          >
            Upgrade to Pro — coming soon
          </button>
        )}
      </section>
    </div>
  );
}
