import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ImportReview,
  type ImportItem,
  type ImportJob,
} from '@/components/admin/import-review';

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
      'id, status, source_ref, question_type, question_text, passage, options, correct_answer, accepted_answers, explanation, difficulty, page_image_url, question_image_url, chart_svg, verification_notes, validation_errors, question_id, topics(name), categories(name)'
    )
    .eq('job_id', id)
    .order('created_at', { ascending: true });

  return (
    <>
      <div className="adm-crumbs">
        <Link href="/admin/import-jobs">Imports</Link>
        <span>/</span>
        <span>{job.source_filename ?? 'Review'}</span>
      </div>

      <ImportReview
        initialJob={job as ImportJob}
        initialItems={(items ?? []) as unknown as ImportItem[]}
      />
    </>
  );
}
