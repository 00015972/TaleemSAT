'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { buildAuthCallbackUrl } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/client';
import { AuthAlert, AuthInput, AuthPanelHeader, AuthStage, AuthSubmitButton } from '@/components/auth/auth-ui';
import { TURNSTILE_ENABLED, TurnstileWidget, type TurnstileWidgetHandle } from '@/components/auth/turnstile-widget';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string>();
  const submittingRef = useRef(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;

    if (TURNSTILE_ENABLED && !captchaToken) {
      setError('Please complete the CAPTCHA challenge.');
      return;
    }

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
        captchaToken,
      });

      turnstileRef.current?.reset();
      setCaptchaToken(undefined);

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
      <AuthStage art="mail-sent">
        <div className="auth-success-icon"><Mail size={22} aria-hidden="true" /></div>
        <AuthPanelHeader eyebrow="Check your inbox" title="Your reset link is on its way." description="Use the secure link in the email to choose a new password." />
        <p role="status" className="auth-delivery-note">
          Sent to <strong>{email}</strong>
        </p>
        <Link href="/login" className="auth-secondary-button">
          <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
        </Link>
      </AuthStage>
    );
  }

  return (
    <AuthStage art="mail">
      <AuthPanelHeader eyebrow="Password recovery" title="Let’s find your way back." description="Enter the email on your account and we’ll send you a secure reset link." />

      <form onSubmit={handleSubmit} className="auth-form">
        {error && <AuthAlert id="forgot-password-error">{error}</AuthAlert>}
        <div className="auth-field">
          <label htmlFor="forgot-password-email">Email address</label>
          <div className="auth-field-control">
            <Mail size={17} aria-hidden="true" />
            <AuthInput id="forgot-password-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required autoComplete="email" aria-describedby={error ? 'forgot-password-error' : undefined} />
          </div>
        </div>
        <TurnstileWidget ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(undefined)} />
        <AuthSubmitButton loading={loading} label="Send secure link" loadingLabel="Sending link…" />
      </form>

      <p className="auth-panel-footer auth-panel-footer-back">
        <Link href="/login"><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</Link>
      </p>
    </AuthStage>
  );
}
