import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import 'server-only';
import type { Database } from './types';

/**
 * Service-role Supabase client — bypasses RLS.
 * SERVER ONLY. Never import in a Client Component or any file that ends up in the client bundle.
 * Use for: webhook handlers, server-side triggers, seed scripts, admin operations.
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
