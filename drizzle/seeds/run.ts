/**
 * Seed runner. Loads .env.local then runs all seed scripts in order.
 *
 * Usage: pnpm db:seed
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { seedSubjectsAndCategories } from './01_subjects_categories';
import { seedTopics } from './03_topics';

config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('▶ Seeding subjects and categories…');
  const result = await seedSubjectsAndCategories();
  console.log(`  ✓ ${result.subjects} subjects, ${result.categories} categories`);

  console.log('▶ Seeding topics…');
  const topicResult = await seedTopics();
  console.log(`  ✓ ${topicResult.topics} topics`);

  console.log('\n✓ Seed complete.');
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err);
  process.exit(1);
});
