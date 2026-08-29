import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

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
