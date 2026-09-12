import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import {
  getCallbackFailurePath,
  isRecoveryCallback,
  RECOVERY_COOKIE_MAX_AGE_SECONDS,
  RECOVERY_COOKIE_NAME,
} from '@/lib/auth/flow';
import { getSafeAuthRedirect } from '@/lib/auth/redirect';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next');
  const next = getSafeAuthRedirect(requestedNext);
  const recovery = isRecoveryCallback(requestedNext, searchParams.get('flow'));
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            pendingCookies.push(...cookiesToSet);
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(next, origin));
      pendingCookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );

      if (recovery) {
        response.cookies.set(RECOVERY_COOKIE_NAME, '1', {
          httpOnly: true,
          maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      } else {
        response.cookies.delete(RECOVERY_COOKIE_NAME);
      }

      return response;
    }
  }

  const response = NextResponse.redirect(
    new URL(getCallbackFailurePath(recovery), origin)
  );
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  response.cookies.delete(RECOVERY_COOKIE_NAME);
  return response;
}
