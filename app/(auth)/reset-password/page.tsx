import Link from 'next/link';
import { cookies } from 'next/headers';
import { ArrowRight, Link2Off } from 'lucide-react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { AuthPanelHeader, AuthStage } from '@/components/auth/auth-ui';
import { RECOVERY_COOKIE_NAME } from '@/lib/auth/flow';
import { getUser } from '@/lib/supabase/server';

export const metadata = { title: 'Choose a new password — Taleem SAT' };

function InvalidRecoveryLink() {
  return (
    <AuthStage art="invalid">
      <div className="auth-success-icon auth-invalid-icon"><Link2Off size={22} aria-hidden="true" /></div>
      <AuthPanelHeader
        eyebrow="Recovery link unavailable"
        title="This link has reached its limit."
        description="It may be invalid, expired, or already used. Request a fresh link to keep going."
      />
      <Link href="/forgot-password" className="auth-primary-link">
        <span>Request a new link</span><ArrowRight size={17} aria-hidden="true" />
      </Link>
      <p className="auth-panel-footer">Your account and progress remain safe.</p>
    </AuthStage>
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
