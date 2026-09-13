/**
 * Create the Supabase Storage buckets used by the question-import pipeline.
 * Idempotent — skips a bucket if it already exists.
 *
 * Run via: `pnpm storage:setup`
 */
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKETS: Array<{
  id: string;
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
}> = [
  {
    id: 'question-images',
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  },
  {
    id: 'source-html',
    public: false,
    fileSizeLimit: 20 * 1024 * 1024, // 20MB — HTML itself is small, but embedded base64 figures inflate it
    allowedMimeTypes: ['text/html'],
  },
];

export async function setupStorageBuckets() {
  const admin = createAdminClient();
  const { data: existing, error: listError } = await admin.storage.listBuckets();

  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`);
  }

  const existingIds = new Set((existing ?? []).map(b => b.id));
  const created: string[] = [];
  const skipped: string[] = [];

  for (const bucket of BUCKETS) {
    if (existingIds.has(bucket.id)) {
      skipped.push(bucket.id);
      continue;
    }

    const { error } = await admin.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.allowedMimeTypes,
    });

    if (error) {
      throw new Error(`Failed to create bucket "${bucket.id}": ${error.message}`);
    }
    created.push(bucket.id);
  }

  return { created, skipped };
}
