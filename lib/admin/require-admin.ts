import 'server-only';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

type RequireAdminResult =
  | { ok: true; user: User }
  | { ok: false; response: Response };

/**
 * Gate for admin API route handlers.
 *
 * Admin writes run through the service-role client (which bypasses RLS), so the
 * route itself MUST verify the caller is an admin — the layout gate does not
 * protect API routes. Call this first in every /api/admin/* handler:
 *
 *   const gate = await requireAdmin();
 *   if (!gate.ok) return gate.response;
 *   const { user } = gate;
 *
 * Returns 401 if not signed in, 404 (not 403) if signed in but not an admin —
 * we don't acknowledge the route exists to non-admins.
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return {
      ok: false,
      response: Response.json({ error: 'NOT_FOUND' }, { status: 404 }),
    };
  }

  return { ok: true, user };
}
