import Link from 'next/link';
import { cookies } from 'next/headers';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { RECOVERY_COOKIE_NAME } from '@/lib/auth/flow';
import { getUser } from '@/lib/supabase/server';

export const metadata = { title: 'Choose a new password — Taleem SAT' };

function InvalidRecoveryLink() {
  return (
    <div
      className="rounded-l p-8 text-center"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <h1 className="font-serif text-2xl font-bold mb-2" style={{ color: 'var(--txt)' }}>
        Reset link unavailable
      </h1>
      <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--txt-soft)' }}>
        This password reset link is invalid, expired, or has already been used.
      </p>
      <Link
        href="/forgot-password"
        className="text-sm font-medium hover:underline"
        style={{ color: 'var(--green)' }}
      >
        Request a new link
      </Link>
    </div>
  );
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const [params, cookieStore, user] = await Promise.all([
    searchParams,
    cookies(),
    getUser(),
  ]);
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const hasRecoveryState = cookieStore.get(RECOVERY_COOKIE_NAME)?.value === '1';

  if (error === 'invalid_or_expired' || !user || !hasRecoveryState) {
    return <InvalidRecoveryLink />;
  }

  return <ResetPasswordForm />;
}
