import { LoginForm } from '@/components/auth/login-form';
import { getSafeAuthRedirect } from '@/lib/auth/redirect';

export const metadata = { title: 'Sign in — Taleem SAT' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <LoginForm
      next={getSafeAuthRedirect(params.next)}
      initialError={
        errorCode === 'auth_callback_failed'
          ? 'That sign-in link is invalid or has expired. Please sign in again.'
          : ''
      }
    />
  );
}
