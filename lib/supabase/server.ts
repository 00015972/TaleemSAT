import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export type ClaimsUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
};

/**
 * Server-side Supabase client. Reads cookies via next/headers.
 * Use in Server Components, Route Handlers, and Server Actions.
 * Respects RLS — runs as the logged-in user.
 *
 * Wrapped in React `cache()` so every call within one request (a layout and
 * its page both call this) shares one client instead of re-reading cookies
 * and re-instantiating per call.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware refreshes the session.
          }
        },
      },
    }
  );
});

/**
 * The logged-in user, verified against the Supabase Auth server.
 *
 * `auth.getUser()` always makes a network round-trip (unlike `getSession()`,
 * it re-checks the token rather than trusting the local cookie) — expensive
 * to pay twice. This is cached per request so a layout and its page can both
 * call it and only one round-trip happens.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The authenticated identity derived from a cryptographically verified JWT.
 *
 * With asymmetric Supabase signing keys `getClaims()` verifies locally after
 * the JWKS is cached, avoiding the Auth-server round trip that `getUser()`
 * always makes. Use `getUser()` only when a caller needs a freshly fetched
 * Auth record rather than the stable identity carried by the access token.
 */
export const getClaimsUser = cache(async (): Promise<ClaimsUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) return null;

  const metadata = claims.user_metadata;
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    user_metadata:
      metadata && typeof metadata === 'object'
        ? (metadata as Record<string, unknown>)
        : {},
  };
});

/** Shared application profile for layouts and pages rendered in one request. */
export const getAppProfile = cache(async () => {
  const [supabase, user] = await Promise.all([createClient(), getClaimsUser()]);
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select(
      'full_name, role, tier, target_sat_score, exam_date, marketing_opt_in, current_period_end'
    )
    .eq('id', user.id)
    .single();

  return data;
});
