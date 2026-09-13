/**
 * Seed the topics tier (subject -> category -> topic).
 *
 * The taxonomy itself lives in lib/import/taxonomy.ts, shared with the HTML
 * import pipeline so seeding and importing can never drift apart.
 *
 * Idempotent — upserts on `slug`. Run via: `pnpm db:seed`
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { TOPICS } from '@/lib/import/taxonomy';

export { TOPICS, topicSlugForSkill, type TopicSeed } from '@/lib/import/taxonomy';

export async function seedTopics() {
  const admin = createAdminClient();

  const { data: categoryRows, error: catError } = await admin
    .from('categories')
    .select('id, slug');

  if (catError || !categoryRows) {
    throw new Error(`Failed to fetch categories: ${catError?.message}`);
  }

  const categoryIdBySlug = new Map(categoryRows.map(c => [c.slug, c.id]));

  const rows = TOPICS.map((t, i) => {
    const categoryId = categoryIdBySlug.get(t.categorySlug);
    if (!categoryId) {
      throw new Error(
        `Category not found for slug "${t.categorySlug}" (topic "${t.slug}"). Run the subjects/categories seed first.`
      );
    }
    return {
      slug: t.slug,
      name: t.name,
      category_id: categoryId,
      display_order: i + 1,
    };
  });

  const { error } = await admin
    .from('topics')
    .upsert(rows, { onConflict: 'slug', ignoreDuplicates: false });

  if (error) {
    throw new Error(`Failed to seed topics: ${error.message}`);
  }

  return { topics: rows.length };
}
