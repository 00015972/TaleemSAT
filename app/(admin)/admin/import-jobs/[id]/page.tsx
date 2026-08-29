import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { liveJobCounts } from '@/lib/admin/import-job-counts';
import {
  ImportReview,
  type ImportItem,
  type ImportJob,
} from '@/components/admin/import-review';
import { DeleteImportJobButton } from '@/components/admin/delete-import-job-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review import — Taleem SAT Admin' };

export default async function ImportJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: job } = await admin
    .from('import_jobs')
    .select(
      'id, status, source_filename, total_count, success_count, failed_count, error'
    )
    .eq('id', id)
    .single();

  if (!job) notFound();

  const { data: items } = await admin
    .from('import_job_items')
    .select(
      'id, status, source_ref, question_type, question_text, passage, options, correct_answer, accepted_answers, explanation, difficulty, question_image_url, chart_svg, tables, verification_notes, validation_errors, question_id, topics(name), categories(name)'
    )
    .eq('job_id', id)
    .order('created_at', { ascending: true });

  const { successCount, failedCount } = liveJobCounts(items ?? []);
  const jobWithLiveCounts: ImportJob = {
    ...(job as ImportJob),
    success_count: successCount,
    failed_count: failedCount,
  };

  return (
    <>
      <div className="adm-crumbs" style={{ justifyContent: 'space-between', display: 'flex' }}>
        <div>
          <Link href="/admin/import-jobs">Imports</Link>
          <span> / </span>
          <span>{job.source_filename ?? 'Review'}</span>
        </div>
        <DeleteImportJobButton
          jobId={job.id}
          filename={job.source_filename}
          redirectTo="/admin/import-jobs"
        />
      </div>

      <ImportReview
        initialJob={jobWithLiveCounts}
        initialItems={(items ?? []) as unknown as ImportItem[]}
      />
    </>
  );
}
