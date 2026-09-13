/**
 * `import_jobs.success_count`/`failed_count` are frozen at extraction time —
 * they never move when a reviewer later fixes, rejects, or approves a staged
 * item — so every place that displays extraction progress recomputes these
 * live from the items' current status instead of trusting the stored columns.
 */
export function liveJobCounts(items: { status: string }[]): {
  successCount: number;
  failedCount: number;
} {
  let successCount = 0;
  let failedCount = 0;
  for (const item of items) {
    if (item.status === 'pending_review' || item.status === 'approved') successCount++;
    else if (item.status === 'verification_failed') failedCount++;
  }
  return { successCount, failedCount };
}
