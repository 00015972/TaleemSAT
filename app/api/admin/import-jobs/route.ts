import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';

export const dynamic = 'force-dynamic';

/** List import jobs, newest first. */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('import_jobs')
    .select(
      'id, type, status, source_filename, total_count, success_count, failed_count, error, created_at, completed_at'
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: 'DB_ERROR', detail: error.message }, { status: 500 });
  }
  return Response.json({ jobs: data ?? [] });
}
