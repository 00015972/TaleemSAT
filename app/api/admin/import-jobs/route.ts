import { NextRequest } from 'next/server';
import { tasks } from '@trigger.dev/sdk/v3';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';

export const dynamic = 'force-dynamic';

const MAX_PDF_BYTES = 50 * 1024 * 1024;

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

/**
 * Upload a source PDF and queue an extraction run.
 *
 * The upload and the job row are created here; the long work happens in the
 * `extract-pdf` Trigger.dev task, which this hands off to.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'INVALID_FORM' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'NO_FILE' }, { status: 400 });
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return Response.json({ error: 'NOT_A_PDF' }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return Response.json({ error: 'TOO_LARGE', maxBytes: MAX_PDF_BYTES }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create the job first so the storage path can be keyed by its id.
  const { data: job, error: jobError } = await admin
    .from('import_jobs')
    .insert({
      type: 'extract',
      status: 'queued',
      source_filename: file.name,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (jobError || !job) {
    return Response.json(
      { error: 'DB_ERROR', detail: jobError?.message },
      { status: 500 }
    );
  }

  const path = `${job.id}/${file.name}`;
  const { error: uploadError } = await admin.storage
    .from('source-pdfs')
    .upload(path, file, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    await admin
      .from('import_jobs')
      .update({ status: 'failed', error: `Upload failed: ${uploadError.message}` })
      .eq('id', job.id);
    return Response.json(
      { error: 'UPLOAD_FAILED', detail: uploadError.message },
      { status: 500 }
    );
  }

  await admin.from('import_jobs').update({ source_pdf_path: path }).eq('id', job.id);

  // Hand off to the background task. If this fails the job is still on record,
  // marked failed, rather than sitting queued forever with no explanation.
  try {
    const handle = await tasks.trigger('extract-pdf', { jobId: job.id });
    await admin.from('import_jobs').update({ trigger_run_id: handle.id }).eq('id', job.id);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Could not queue the task';
    await admin
      .from('import_jobs')
      .update({ status: 'failed', error: `Could not queue extraction: ${detail}` })
      .eq('id', job.id);
    return Response.json({ error: 'TRIGGER_FAILED', detail }, { status: 502 });
  }

  await logAudit(admin, {
    actorUserId: user.id,
    action: 'import.start',
    targetType: 'question',
    targetId: job.id,
    after: { filename: file.name, bytes: file.size },
    note: `Queued PDF extraction: ${file.name}`,
  });

  return Response.json({ jobId: job.id }, { status: 201 });
}
