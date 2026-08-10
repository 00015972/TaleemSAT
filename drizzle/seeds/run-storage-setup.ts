/**
 * Storage setup runner. Loads .env.local then creates required Storage buckets.
 *
 * Usage: pnpm storage:setup
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { setupStorageBuckets } from './02_storage_buckets';

config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('▶ Setting up Storage buckets…');
  const result = await setupStorageBuckets();
  if (result.created.length) console.log(`  ✓ created: ${result.created.join(', ')}`);
  if (result.skipped.length) console.log(`  · already existed: ${result.skipped.join(', ')}`);

  console.log('\n✓ Storage setup complete.');
}

main().catch((err) => {
  console.error('\n✗ Storage setup failed:', err);
  process.exit(1);
});
