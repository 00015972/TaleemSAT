import Link from 'next/link';
import {
  FiAlertCircle,
  FiArrowUpRight,
  FiCheckCircle,
  FiFileText,
  FiInbox,
  FiLayers,
  FiUploadCloud,
} from 'react-icons/fi';
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

function extractionProgress(successCount: number, totalCount: number) {
  if (totalCount <= 0) return 0;
  return Math.min(100, Math.max(0, (successCount / totalCount) * 100));
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
  const totalQuestions = rows.reduce((sum, job) => sum + Math.max(0, job.total_count), 0);
  const totalExtracted = rows.reduce((sum, job) => sum + Math.max(0, job.success_count), 0);
  const totalNeedsReview = rows.reduce((sum, job) => sum + Math.max(0, job.failed_count), 0);
  const readiness = totalQuestions > 0
    ? Math.min(100, Math.round((totalExtracted / totalQuestions) * 1000) / 10)
    : 100;
  const readinessLabel = Number.isInteger(readiness) ? readiness.toFixed(0) : readiness.toFixed(1);

  return (
    <section className="imports-studio">
      <div className="imports-studio-glow" aria-hidden="true" />

      <header className="imports-studio-header">
        <div>
          <div className="imports-studio-eyebrow">
            <span />
            Content workspace
          </div>
          <h1>Imports</h1>
          <p>Manage extracted question banks and review exceptions before publishing.</p>
        </div>
        <Link href="/admin/import-jobs/new" className="imports-studio-import-btn">
          <span className="imports-studio-import-icon" aria-hidden="true">
            <FiUploadCloud />
          </span>
          Import HTML
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="imports-studio-empty">
          <span className="imports-studio-empty-icon" aria-hidden="true">
            <FiInbox />
          </span>
          <span className="imports-studio-empty-kicker">Your workspace is ready</span>
          <h2>No imports yet</h2>
          <p>Upload a question-bank HTML file and its questions will land here for review.</p>
          <Link href="/admin/import-jobs/new" className="imports-studio-import-btn">
            <span className="imports-studio-import-icon" aria-hidden="true">
              <FiUploadCloud />
            </span>
            Import HTML
          </Link>
        </div>
      ) : (
        <>
          <div className="imports-studio-overview" aria-label="Import overview">
            <article className="imports-studio-readiness">
              <div className="imports-studio-card-label">
                <FiCheckCircle aria-hidden="true" />
                Library readiness
              </div>
              <strong>{readinessLabel}%</strong>
              <p>
                {totalExtracted.toLocaleString()} of {totalQuestions.toLocaleString()} extracted
                questions are ready to review.
              </p>
              <div className="imports-studio-readiness-track" aria-hidden="true">
                <span style={{ width: `${readiness}%` }} />
              </div>
            </article>

            <article className="imports-studio-summary-card">
              <div className="imports-studio-card-label">
                <FiLayers aria-hidden="true" />
                Source files
              </div>
              <strong>{rows.length.toLocaleString()}</strong>
              <p>HTML imports on record</p>
            </article>

            <article className="imports-studio-summary-card gold">
              <div className="imports-studio-card-label">
                <FiAlertCircle aria-hidden="true" />
                Needs review
              </div>
              <strong>{totalNeedsReview.toLocaleString()}</strong>
              <p>Across recent imports</p>
            </article>
          </div>

          <div className="imports-studio-section-head">
            <div>
              <h2>Import history</h2>
              <p>Newest source files appear first.</p>
            </div>
            <span>{rows.length} {rows.length === 1 ? 'file' : 'files'}</span>
          </div>

          <div className="imports-studio-table-wrap">
            <table className="imports-studio-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Status</th>
                  <th>Extracted</th>
                  <th>Needs review</th>
                  <th>Started</th>
                  <th><span className="sr-only">Review</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(job => {
                  const filename = job.source_filename ?? 'Untitled';
                  const progress = extractionProgress(job.success_count, job.total_count);

                  return (
                    <tr key={job.id}>
                      <td className="imports-studio-file-cell" data-label="File">
                        <div className="imports-studio-file">
                          <span className="imports-studio-file-icon" aria-hidden="true">
                            <FiFileText />
                            <small>{job.type?.toUpperCase() ?? 'HTML'}</small>
                          </span>
                          <div>
                            <Link
                              href={`/admin/import-jobs/${job.id}`}
                              className="imports-studio-filename"
                              title={filename}
                            >
                              {filename}
                            </Link>
                            <span className="imports-studio-file-type">Question bank source</span>
                            {job.error && (
                              <span className="imports-studio-error">
                                <FiAlertCircle aria-hidden="true" />
                                {job.error}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="imports-studio-status" data-label="Status">
                        <StatusPill status={job.status} />
                      </td>
                      <td className="imports-studio-extracted" data-label="Extracted">
                        <strong>
                          {job.success_count}
                          {job.total_count > 0 && <span> / {job.total_count}</span>}
                        </strong>
                        <div className="imports-studio-progress" aria-hidden="true">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </td>
                      <td className="imports-studio-review-count" data-label="Needs review">
                        {job.failed_count > 0 ? (
                          <span className="has-review">
                            <FiAlertCircle aria-hidden="true" />
                            {job.failed_count} {job.failed_count === 1 ? 'question' : 'questions'}
                          </span>
                        ) : (
                          <span className="no-review">—</span>
                        )}
                      </td>
                      <td className="imports-studio-date" data-label="Started">
                        <time dateTime={job.created_at}>{formatWhen(job.created_at)}</time>
                      </td>
                      <td className="imports-studio-action">
                        <Link
                          href={`/admin/import-jobs/${job.id}`}
                          aria-label={`Review ${filename}`}
                          title={`Review ${filename}`}
                        >
                          <FiArrowUpRight aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="imports-studio-footnote">
            <span aria-hidden="true" />
            All imports are synchronized with the review workspace.
          </p>
        </>
      )}
    </section>
  );
}
