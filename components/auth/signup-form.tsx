'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  LockKeyhole,
  Mail,
  Target,
  UserRound,
} from 'lucide-react';
import { getSignupOutcome } from '@/lib/auth/flow';
import { buildAuthCallbackUrl } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/client';
import { ResendVerificationButton } from '@/components/resend-verification-button';
import {
  AuthAlert,
  AuthInput,
  AuthPanelHeader,
  AuthPasswordInput,
  AuthStage,
  AuthSubmitButton,
} from '@/components/auth/auth-ui';
import { TURNSTILE_ENABLED, TurnstileWidget, type TurnstileWidgetHandle } from '@/components/auth/turnstile-widget';

const TARGET_SCORES = ['1200', '1300', '1350', '1400', '1450', '1500', '1550+'];

export function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    targetScore: '',
    examDate: '',
    marketingOptIn: true,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string>();
  const submittingRef = useRef(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  function set(field: string, value: string | boolean) {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  function handleNext(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!form.fullName.trim()) {
      setError('Enter your name to continue.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('Enter a valid email address to continue.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setStep(2);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;

    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      setStep(1);
      return;
    }
    if (TURNSTILE_ENABLED && !captchaToken) {
      setError('Please complete the CAPTCHA challenge.');
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
          captchaToken,
        },
      });

      turnstileRef.current?.reset();
      setCaptchaToken(undefined);

      if (signUpError) {
        const message = signUpError.message.toLowerCase();
        if (message.includes('already registered') || message.includes('already been registered')) {
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
      <AuthStage art="mail-sent">
        <div className="auth-success-icon"><Mail size={22} aria-hidden="true" /></div>
        <AuthPanelHeader eyebrow="One last step" title="Confirm your email." description="Open the link we sent to finish creating your Taleem SAT account." />
        <p role="status" className="auth-delivery-note">
          Sent to <strong>{pendingEmail}</strong>
        </p>
        <div className="auth-success-actions">
          <ResendVerificationButton email={pendingEmail} />
          <Link href="/login" className="auth-secondary-button">
            <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
          </Link>
        </div>
      </AuthStage>
    );
  }

  return (
    <AuthStage art="signup" signupStep={step} size="wide">
      <div className="auth-progress" aria-label={`Step ${step} of 2`}>
        <div className="auth-progress-copy"><span>Account setup</span><strong>Step {step} of 2</strong></div>
        <div className="auth-progress-track"><i className={step === 2 ? 'is-complete' : ''} /></div>
        <div className="auth-progress-labels"><span className="is-active">Your login</span><span className={step === 2 ? 'is-active' : ''}>Your direction</span></div>
      </div>

      <AuthPanelHeader
        eyebrow={step === 1 ? 'Create your login' : 'Set your direction'}
        title={step === 1 ? 'Start your score story.' : 'Give your practice a target.'}
        description={step === 1 ? 'Build your free account. No payment details required.' : 'These details are optional, but they make your progress feel more concrete.'}
      />

      <form onSubmit={step === 1 ? handleNext : handleSubmit} className="auth-form">
        {error && (
          <AuthAlert id="signup-error">
            {error}{' '}
            {error.includes('already in use') && <Link href="/login">Log in</Link>}
          </AuthAlert>
        )}

        {step === 1 ? (
          <div className="auth-step-panel" key="signup-step-one">
            <div className="auth-field">
              <label htmlFor="signup-full-name">Full name</label>
              <div className="auth-field-control">
                <UserRound size={17} aria-hidden="true" />
                <AuthInput id="signup-full-name" type="text" value={form.fullName} onChange={event => set('fullName', event.target.value)} placeholder="Amir Karimov" required autoComplete="name" aria-describedby={error ? 'signup-error' : undefined} />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="signup-email">Email address</label>
              <div className="auth-field-control">
                <Mail size={17} aria-hidden="true" />
                <AuthInput id="signup-email" type="email" value={form.email} onChange={event => set('email', event.target.value)} placeholder="you@example.com" required autoComplete="email" aria-describedby={error ? 'signup-error' : undefined} />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="signup-password">Password</label>
              <div className="auth-field-control">
                <LockKeyhole size={17} aria-hidden="true" />
                <AuthPasswordInput id="signup-password" value={form.password} onChange={value => set('password', value)} placeholder="At least 8 characters" autoComplete="new-password" describedBy={error ? 'signup-error' : 'signup-password-hint'} />
              </div>
              <small id="signup-password-hint" className="auth-field-hint">Use 8 or more characters.</small>
            </div>

            <button type="submit" className="auth-primary-button">
              <span>Continue to your goal</span><Target size={17} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="auth-step-panel" key="signup-step-two">
            <div className="auth-field">
              <div className="auth-field-label-row"><label htmlFor="signup-target-score">Target score</label><small>Optional</small></div>
              <div className="auth-field-control">
                <Target size={17} aria-hidden="true" />
                <select id="signup-target-score" value={form.targetScore} onChange={event => set('targetScore', event.target.value)} className="auth-input auth-select">
                  <option value="">Choose a score</option>
                  {TARGET_SCORES.map(score => <option key={score} value={score}>{score}</option>)}
                </select>
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-field-label-row"><label htmlFor="signup-exam-date">Exam date</label><small>Optional</small></div>
              <div className="auth-field-control">
                <CalendarDays size={17} aria-hidden="true" />
                <AuthInput id="signup-exam-date" type="date" value={form.examDate} onChange={event => set('examDate', event.target.value)} />
              </div>
            </div>

            <label htmlFor="signup-marketing" className="auth-check-row">
              <input id="signup-marketing" type="checkbox" checked={form.marketingOptIn} onChange={event => set('marketingOptIn', event.target.checked)} />
              <span className="auth-check-mark" aria-hidden="true">✓</span>
              <span><strong>Keep me on track</strong><small>Send study tips, reminders, and platform updates. Unsubscribe anytime.</small></span>
            </label>

            <TurnstileWidget ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(undefined)} />

            <div className="auth-step-actions">
              <button type="button" className="auth-back-button" onClick={() => { setError(''); setStep(1); }} disabled={loading}>
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
              <AuthSubmitButton loading={loading} label="Create free account" loadingLabel="Creating account…" />
            </div>
          </div>
        )}
      </form>

      <p className="auth-panel-footer">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </AuthStage>
  );
}
