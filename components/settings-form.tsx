'use client';

import { useState } from 'react';
import {
  BellRing,
  CalendarDays,
  Check,
  Crown,
  LockKeyhole,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { AppMenuButton } from '@/components/app-menu-button';
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
  requestDate: string;
  initial: Profile;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type ResetStatus = 'idle' | 'sending' | 'sent' | 'error';

function profileMatches(a: Profile, b: Profile) {
  return (
    a.fullName === b.fullName &&
    a.targetScore === b.targetScore &&
    a.examDate === b.examDate &&
    a.marketingOptIn === b.marketingOptIn
  );
}

function formatExamDate(value: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysBetween(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  const delta =
    Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay);
  return Math.ceil(delta / (24 * 60 * 60 * 1000));
}

function initialsFor(name: string, email: string) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return initials || email.slice(0, 1).toUpperCase() || 'S';
}

export function SettingsForm({
  userId,
  email,
  tier,
  requestDate,
  initial,
}: SettingsFormProps) {
  const [form, setForm] = useState<Profile>(initial);
  const [savedProfile, setSavedProfile] = useState<Profile>(initial);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [resetStatus, setResetStatus] = useState<ResetStatus>('idle');
  const [resetError, setResetError] = useState('');

  const isDirty = !profileMatches(form, savedProfile);
  const displayName = form.fullName.trim() || 'Student';
  const initials = initialsFor(form.fullName, email);
  const normalizedTier = tier === 'pro' || tier === 'elite' ? tier : 'free';
  const tierLabel = normalizedTier[0].toUpperCase() + normalizedTier.slice(1);
  const examDateLabel = formatExamDate(form.examDate);
  const daysToExam = form.examDate ? daysBetween(requestDate, form.examDate) : null;

  function set(field: keyof Profile, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (status !== 'saving') setStatus('idle');
    setErrorMsg('');
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
      setSavedProfile(form);
      setStatus('saved');
    }
  }

  async function sendPasswordReset() {
    setResetStatus('sending');
    setResetError('');
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setResetError('We could not send the reset email. Please try again.');
      setResetStatus('error');
      return;
    }

    setResetStatus('sent');
  }

  return (
    <form className="settings-command" onSubmit={handleSave}>
      <div className="settings-command-orb settings-command-orb-one" aria-hidden="true" />
      <div className="settings-command-orb settings-command-orb-two" aria-hidden="true" />

      <div className="settings-command-inner">
        <header className="settings-command-header settings-command-enter">
          <div className="settings-command-heading-row">
            <AppMenuButton className="settings-inline-menu" />
            <div>
              <p className="settings-command-eyebrow">Player headquarters</p>
              <h1>Make the plan yours.</h1>
              <p className="settings-command-subtitle">
                Your identity, score quest, plan, and account protection—all in one place.
              </p>
            </div>
          </div>
          <div className="settings-security-pill">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              <small>Account status</small>
              <strong>Protected</strong>
            </span>
          </div>
        </header>

        <IdentityHero
          displayName={displayName}
          initials={initials}
          tierLabel={tierLabel}
          targetScore={form.targetScore}
          examDateLabel={examDateLabel}
          daysToExam={daysToExam}
        />

        <div className="settings-command-grid">
          <section className="settings-profile-card settings-command-enter settings-command-enter-two">
            <div className="settings-card-heading">
              <div>
                <p className="settings-card-label">Identity & goal</p>
                <h2>Your study coordinates</h2>
                <p>Keep the details that shape your SAT plan accurate.</p>
              </div>
              <span className="settings-card-heading-icon" aria-hidden="true">
                <Target size={18} />
              </span>
            </div>

            <div className="settings-profile-fields">
              {status === 'error' && (
                <div className="settings-alert settings-alert-error" role="alert">
                  {errorMsg}
                </div>
              )}

              <div className="settings-field">
                <label htmlFor="settings-full-name">Full name</label>
                <input
                  id="settings-full-name"
                  type="text"
                  value={form.fullName}
                  onChange={event => set('fullName', event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>

              <div className="settings-field">
                <label htmlFor="settings-email">Email address</label>
                <div className="settings-field-with-icon">
                  <Mail size={16} aria-hidden="true" />
                  <input id="settings-email" type="email" value={email} disabled />
                  <span>Locked</span>
                </div>
                <p>Email is verified and cannot be changed here.</p>
              </div>

              <div className="settings-field-row">
                <div className="settings-field">
                  <label htmlFor="settings-target-score">Target score</label>
                  <div className="settings-select-wrap">
                    <select
                      id="settings-target-score"
                      value={form.targetScore}
                      onChange={event => set('targetScore', event.target.value)}
                    >
                      <option value="">Not set</option>
                      {TARGET_SCORES.map(score => (
                        <option key={score} value={score}>
                          {score}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="settings-field">
                  <label htmlFor="settings-exam-date">Exam date</label>
                  <div className="settings-date-wrap">
                    <CalendarDays size={16} aria-hidden="true" />
                    <input
                      id="settings-exam-date"
                      type="date"
                      value={form.examDate}
                      onChange={event => set('examDate', event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="settings-save-row">
                <button
                  type="submit"
                  className="settings-primary-button"
                  disabled={status === 'saving' || !isDirty}
                >
                  <Save size={15} aria-hidden="true" />
                  {status === 'saving' ? 'Saving changes…' : 'Save changes'}
                </button>
                <span className="settings-save-status" aria-live="polite">
                  {status === 'saved' ? (
                    <><Check size={14} aria-hidden="true" /> Changes saved</>
                  ) : isDirty ? (
                    'Unsaved changes'
                  ) : (
                    'Everything is up to date'
                  )}
                </span>
              </div>
            </div>
          </section>

          <aside className="settings-command-rail">
            <SubscriptionCard tier={normalizedTier} tierLabel={tierLabel} />
            <SecurityCard
              email={email}
              status={resetStatus}
              error={resetError}
              onReset={sendPasswordReset}
            />
            <PreferenceCard
              checked={form.marketingOptIn}
              onChange={checked => set('marketingOptIn', checked)}
            />
          </aside>
        </div>
      </div>
    </form>
  );
}

function IdentityHero({
  displayName,
  initials,
  tierLabel,
  targetScore,
  examDateLabel,
  daysToExam,
}: {
  displayName: string;
  initials: string;
  tierLabel: string;
  targetScore: string;
  examDateLabel: string | null;
  daysToExam: number | null;
}) {
  const countdown =
    daysToExam === null
      ? 'Choose your test date'
      : daysToExam > 0
        ? `${daysToExam} day${daysToExam === 1 ? '' : 's'} to go`
        : daysToExam === 0
          ? 'Test day is today'
          : 'Update test date';

  return (
    <section className="settings-identity-hero settings-command-enter settings-command-enter-one">
      <div className="settings-hero-ring settings-hero-ring-one" aria-hidden="true" />
      <div className="settings-hero-ring settings-hero-ring-two" aria-hidden="true" />
      <span className="settings-hero-spark settings-hero-spark-one" aria-hidden="true">✦</span>
      <span className="settings-hero-spark settings-hero-spark-two" aria-hidden="true">✦</span>

      <div className="settings-identity-copy">
        <div className="settings-avatar" aria-hidden="true">
          {initials}
          <span><Check size={12} /></span>
        </div>
        <div>
          <p>Student profile</p>
          <h2>{displayName}</h2>
          <span>{tierLabel} learner · ready for the next score climb</span>
        </div>
      </div>

      <div className="settings-score-ticket">
        <div className="settings-ticket-top">
          <span><Target size={13} aria-hidden="true" /> Score quest</span>
          <strong>{countdown}</strong>
        </div>
        <p>{targetScore || 'Set your score goal'}</p>
        <div className="settings-ticket-bubbles" aria-hidden="true">
          <i /><i className={targetScore ? 'filled' : ''} /><i /><i className={formValueIsHigh(targetScore) ? 'filled' : ''} /><i />
        </div>
        <div className="settings-ticket-foot">
          <span>{targetScore ? 'Goal locked' : 'Goal not set'}</span>
          <span>{examDateLabel || 'Choose your test date'}</span>
        </div>
      </div>
    </section>
  );
}

function formValueIsHigh(value: string) {
  return Number(value.replace('+', '')) >= 1450;
}

function SubscriptionCard({ tier, tierLabel }: { tier: 'free' | 'pro' | 'elite'; tierLabel: string }) {
  const active = tier !== 'free';

  return (
    <section className="settings-plan-card settings-command-enter settings-command-enter-two">
      <div className="settings-plan-star" aria-hidden="true">★</div>
      <div className="settings-plan-top">
        <span><Crown size={13} aria-hidden="true" /> {tierLabel} plan</span>
        <Sparkles size={18} aria-hidden="true" />
      </div>
      <h2>{active ? 'Every tool unlocked.' : 'Your next level is coming.'}</h2>
      <p>
        {active
          ? 'Your premium score-building toolkit is active and ready.'
          : 'Premium practice and deeper analytics will be available soon.'}
      </p>
      <ul>
        <li><Check size={13} aria-hidden="true" /> Focused SAT practice</li>
        <li><Check size={13} aria-hidden="true" /> Progress and score analytics</li>
        {active && <li><Check size={13} aria-hidden="true" /> Premium learning features</li>}
      </ul>
      {!active && <span className="settings-plan-coming">Upgrade coming soon</span>}
    </section>
  );
}

function SecurityCard({
  email,
  status,
  error,
  onReset,
}: {
  email: string;
  status: ResetStatus;
  error: string;
  onReset: () => void;
}) {
  return (
    <section className="settings-rail-card settings-security-card settings-command-enter settings-command-enter-three">
      <div className="settings-rail-heading">
        <span className="settings-rail-icon settings-rail-icon-coral" aria-hidden="true">
          <LockKeyhole size={17} />
        </span>
        <div>
          <h2>Password & security</h2>
          <p>Reset securely through your inbox.</p>
        </div>
      </div>

      {status === 'sent' ? (
        <div className="settings-reset-success" role="status">
          <Check size={15} aria-hidden="true" />
          <span>Reset link sent to <strong>{email}</strong>.</span>
        </div>
      ) : (
        <button
          type="button"
          className="settings-secondary-button"
          onClick={onReset}
          disabled={status === 'sending'}
        >
          <Mail size={14} aria-hidden="true" />
          {status === 'sending' ? 'Sending reset link…' : 'Send reset link'}
        </button>
      )}

      {status === 'error' && <p className="settings-reset-error" role="alert">{error}</p>}
    </section>
  );
}

function PreferenceCard({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <section className="settings-rail-card settings-preference-card settings-command-enter settings-command-enter-four">
      <span className="settings-rail-icon" aria-hidden="true"><BellRing size={17} /></span>
      <label htmlFor="settings-study-updates">
        <strong>Study updates</strong>
        <span>Useful tips, reminders, and new features</span>
      </label>
      <input
        id="settings-study-updates"
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="settings-toggle-input"
      />
    </section>
  );
}
