import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { StatusPill } from '@/components/admin/import-status-pill';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Imports — Taleem SAT Admin' };

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function ImportJobsPage() {
  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from('import_jobs')
    .select(
      'id, type, status, source_filename, total_count, success_count, failed_count, error, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = jobs ?? [];

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Imports</h1>
          <p>Pull questions out of an HTML question bank and review them before they go live.</p>
        </div>
        <Link href="/admin/import-jobs/new" className="adm-btn">
          Import HTML
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="adm-empty">
          <p>No imports yet.</p>
          <p className="text-sm text-muted mt-1">
            Upload a question-bank HTML file and its questions land here for review.
          </p>
          <Link href="/admin/import-jobs/new" className="adm-btn mt-3">
            Import HTML
          </Link>
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th>Extracted</th>
                <th>Needs review</th>
                <th>Started</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(job => (
                <tr key={job.id}>
                  <td>
                    <Link href={`/admin/import-jobs/${job.id}`} className="font-medium">
                      {job.source_filename ?? 'Untitled'}
                    </Link>
                    {job.error && (
                      <div className="text-xs mt-1" style={{ color: 'var(--err)' }}>
                        {job.error}
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusPill status={job.status} />
                  </td>
                  <td className="tabular">
                    {job.success_count}
                    {job.total_count > 0 && (
                      <span className="text-muted"> / {job.total_count}</span>
                    )}
                  </td>
                  <td className="tabular">
                    {job.failed_count > 0 ? (
                      <span style={{ color: 'var(--err)' }}>{job.failed_count}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-muted text-sm">{formatWhen(job.created_at)}</td>
                  <td>
                    <Link href={`/admin/import-jobs/${job.id}`} className="adm-btn secondary sm">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
