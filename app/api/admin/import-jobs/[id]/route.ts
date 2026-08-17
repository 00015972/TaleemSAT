import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';

export const dynamic = 'force-dynamic';

/**
 * One job with its staged items. The review screen polls this while the job
 * runs, so it returns the job's counts alongside the items themselves.
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

  let query = admin
    .from('import_job_items')
    .select(
      'id, status, source_ref, question_type, question_text, passage, options, correct_answer, accepted_answers, explanation, difficulty, page_image_url, question_image_url, chart_svg, tables, verification_notes, validation_errors, question_id, subject_id, category_id, topic_id, topics(name), categories(name)'
    )
    .eq('job_id', id)
    .order('created_at', { ascending: true });

  if (status) query = query.eq('status', status);

  const { data: items, error: itemsError } = await query;

  if (itemsError) {
    return Response.json({ error: 'DB_ERROR', detail: itemsError.message }, { status: 500 });
  }

  return Response.json({ job, items: items ?? [] });
}
