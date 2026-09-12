import { getClaimsUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Mocks are unavailable to every account until the launch restriction is lifted.
// Keep this endpoint free of question reads, grading, and attempt writes.
export async function GET() {
  const user = await getClaimsUser();
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  return Response.json(
    { error: 'MOCK_IN_DEVELOPMENT', message: 'Mock tests are in development' },
    { status: 403 }
  );
}
