'use client';

import { useRef, useState } from 'react';
import { buildAuthCallbackUrl } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/client';

export function ResendVerificationButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  async function resend() {
    if (submittingRef.current || sent) return;

    submittingRef.current = true;
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: buildAuthCallbackUrl(window.location.origin),
        },
      });

      if (resendError) {
        setError(resendError.message);
        return;
      }

      setSent(true);
    } catch {
      setError('Unable to resend the email right now. Please try again.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={resend}
        disabled={sent || loading}
        aria-describedby={error ? 'resend-verification-error' : undefined}
        className="text-sm font-semibold whitespace-nowrap disabled:opacity-60"
        style={{ color: 'var(--green)' }}
      >
        {sent ? 'Email sent!' : loading ? 'Sending…' : 'Resend email'}
      </button>
      <span aria-live="polite" className="sr-only">
        {sent ? 'Verification email sent.' : ''}
      </span>
      {error && (
        <span
          id="resend-verification-error"
          role="alert"
          className="max-w-xs text-xs font-normal whitespace-normal"
          style={{ color: 'var(--err)' }}
        >
          {error}
        </span>
      )}
    </span>
  );
}
