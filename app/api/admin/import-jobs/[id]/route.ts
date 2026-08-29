import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';
import { liveJobCounts } from '@/lib/admin/import-job-counts';

export const dynamic = 'force-dynamic';

/**
 * One job with its staged items. The review screen polls this while the job
 * runs, so it returns the job's counts alongside the items themselves.
 *
 * `success_count`/`failed_count` on the row are frozen at extraction time —
 * they don't move when a reviewer later fixes, rejects, or approves an item —
 * so the counts returned here are recomputed live from the items' current
 * status instead of read verbatim off the job row.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: job, error: jobError } = await admin
    .from('import_jobs')
    .select(
      'id, type, status, source_filename, total_count, success_count, failed_count, error, created_at, completed_at'
    )
    .eq('id', id)
    .single();

  if (jobError || !job) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const ITEM_STATUSES = [
    'pending_review',
    'verification_failed',
    'approved',
    'rejected',
  ] as const;
  const statusParam = request.nextUrl.searchParams.get('status');
  const status = (ITEM_STATUSES as readonly string[]).includes(statusParam ?? '')
    ? (statusParam as (typeof ITEM_STATUSES)[number])
    : null;

  const { data: allItems, error: itemsError } = await admin
    .from('import_job_items')
    .select(
      'id, status, source_ref, question_type, question_text, passage, options, correct_answer, accepted_answers, explanation, difficulty, question_image_url, chart_svg, tables, verification_notes, validation_errors, question_id, subject_id, category_id, topic_id, topics(name), categories(name)'
    )
    .eq('job_id', id)
    .order('created_at', { ascending: true });

  if (itemsError) {
    return Response.json({ error: 'DB_ERROR', detail: itemsError.message }, { status: 500 });
  }

  const items = status ? (allItems ?? []).filter(i => i.status === status) : (allItems ?? []);
  const { successCount, failedCount } = liveJobCounts(allItems ?? []);

  return Response.json({
    job: { ...job, success_count: successCount, failed_count: failedCount },
    items,
  });
}

/**
 * Remove a stale import batch from the history list — e.g. an early-project
 * PDF-era job whose questions and storage file are already gone. Deleting the
 * row cascades to `import_job_items`; it never touches `questions` (that FK
 * only runs the other way, nulling `question_id` if a question is deleted).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: job } = await admin
    .from('import_jobs')
    .select('source_filename, source_html_path')
    .eq('id', id)
    .single();

  if (!job) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (job.source_html_path) {
    await admin.storage.from('source-html').remove([job.source_html_path]);
  }

  const { error } = await admin.from('import_jobs').delete().eq('id', id);
  if (error) {
    return Response.json({ error: 'DELETE_FAILED', detail: error.message }, { status: 500 });
  }

  await logAudit(admin, {
    actorUserId: user.id,
    action: 'import_job.delete',
    targetType: 'import_job',
    targetId: id,
    before: { source_filename: job.source_filename },
    note: `Deleted import batch: ${job.source_filename ?? id}`,
  });

  return Response.json({ id });
}
