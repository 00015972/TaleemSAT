'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LockKeyhole, Mail } from 'lucide-react';
import { getSafeAuthRedirect } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/client';
import {
  AuthAlert,
  AuthInput,
  AuthPanelHeader,
  AuthPasswordInput,
  AuthStage,
  AuthSubmitButton,
} from '@/components/auth/auth-ui';
import { TURNSTILE_ENABLED, TurnstileWidget, type TurnstileWidgetHandle } from '@/components/auth/turnstile-widget';

export function LoginForm({
  next,
  initialError = '',
}: {
  next: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      });

      turnstileRef.current?.reset();
      setCaptchaToken(undefined);

      if (signInError) {
        setError(
          signInError.message.toLowerCase().includes('invalid')
            ? 'Incorrect email or password. Please try again.'
            : signInError.message
        );
        return;
      }

      router.push(getSafeAuthRedirect(next));
      router.refresh();
    } catch {
      setError('Unable to sign in right now. Please try again.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthStage art="login">
      <AuthPanelHeader
        eyebrow="Welcome back"
        title="Ready for your next win?"
        description="Sign in and continue building the score you are working toward."
      />

      <form onSubmit={handleSubmit} className="auth-form">
        {error && <AuthAlert id="login-error">{error}</AuthAlert>}

        <div className="auth-field">
          <label htmlFor="login-email">Email address</label>
          <div className="auth-field-control">
            <Mail size={17} aria-hidden="true" />
            <AuthInput id="login-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required autoComplete="email" aria-describedby={error ? 'login-error' : undefined} />
          </div>
        </div>

        <div className="auth-field">
          <div className="auth-field-label-row">
            <label htmlFor="login-password">Password</label>
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <div className="auth-field-control">
            <LockKeyhole size={17} aria-hidden="true" />
            <AuthPasswordInput id="login-password" value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" describedBy={error ? 'login-error' : undefined} />
          </div>
        </div>

        <TurnstileWidget ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(undefined)} />

        <AuthSubmitButton loading={loading} label="Continue learning" loadingLabel="Signing in…" />
      </form>

      <p className="auth-panel-footer">
        New to Taleem SAT? <Link href="/signup">Create a free account</Link>
      </p>
    </AuthStage>
  );
}
