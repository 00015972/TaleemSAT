import { createClient, getClaimsUser } from '@/lib/supabase/server';
import { computePracticeOverview } from '@/lib/practice/overview';

export const dynamic = 'force-dynamic';

/**
 * The subject -> category -> topic tree the Practice browse screen renders,
 * with published-question counts and this user's attempted progress.
 */
export async function GET() {
  const supabase = await createClient();
  const user = await getClaimsUser();

  if (!user) {
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const overview = await computePracticeOverview(supabase);
    return Response.json(overview);
  } catch {
    return Response.json({ error: 'DB_ERROR' }, { status: 500 });
  }
}
