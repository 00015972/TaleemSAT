'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ResendVerificationButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function resend() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resend({ type: 'signup', email });
    setSent(true);
    setLoading(false);
  }

  return (
    <button
      onClick={resend}
      disabled={sent || loading}
      className="text-sm font-semibold whitespace-nowrap disabled:opacity-60"
      style={{ color: 'var(--green)' }}
    >
      {sent ? 'Email sent!' : loading ? 'Sending…' : 'Resend email'}
    </button>
  );
}
