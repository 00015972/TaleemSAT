/**
 * Seed the 2 subjects and 8 categories that mirror the College Board Digital SAT structure.
 * Idempotent — uses `onConflictDoNothing` semantics via Supabase upsert with `ignoreDuplicates`.
 *
 * Run via: `pnpm db:seed`
 */
import { createAdminClient } from '@/lib/supabase/admin';

const SUBJECTS = [
  { slug: 'english', name: 'Reading & Writing', display_order: 1 },
  { slug: 'math', name: 'Math', display_order: 2 },
];

const CATEGORIES: Array<{
  slug: string;
  name: string;
  description: string;
  subjectSlug: 'english' | 'math';
  display_order: number;
}> = [
  // English
  {
    slug: 'information-and-ideas',
    name: 'Information & Ideas',
    description: 'Comprehend, analyze, and reason with information from texts.',
    subjectSlug: 'english',
    display_order: 1,
  },
  {
    slug: 'craft-and-structure',
    name: 'Craft & Structure',
    description: 'Vocabulary in context, rhetorical function, and text structure.',
    subjectSlug: 'english',
    display_order: 2,
  },
  {
    slug: 'expression-of-ideas',
    name: 'Expression of Ideas',
    description: 'Revise text to improve rhetorical effectiveness.',
    subjectSlug: 'english',
    display_order: 3,
  },
  {
    slug: 'standard-english-conventions',
    name: 'Standard English Conventions',
    description: 'Edit text to conform to grammar, usage, and mechanics.',
    subjectSlug: 'english',
    display_order: 4,
  },
  // Math
  {
    slug: 'algebra',
    name: 'Algebra',
    description: 'Linear equations, inequalities, and systems.',
    subjectSlug: 'math',
    display_order: 1,
  },
  {
    slug: 'advanced-math',
    name: 'Advanced Math',
    description: 'Quadratics, polynomials, exponentials, and nonlinear functions.',
    subjectSlug: 'math',
    display_order: 2,
  },
  {
    slug: 'problem-solving-data-analysis',
    name: 'Problem-Solving & Data Analysis',
    description: 'Rates, ratios, percentages, and statistical reasoning.',
    subjectSlug: 'math',
    display_order: 3,
  },
  {
    slug: 'geometry-trigonometry',
    name: 'Geometry & Trigonometry',
    description: 'Area, volume, lines, angles, and right triangles.',
    subjectSlug: 'math',
    display_order: 4,
  },
];

export async function seedSubjectsAndCategories() {
  const admin = createAdminClient();

  // 1. Upsert subjects
  const { error: subjectsError } = await admin
    .from('subjects')
    .upsert(SUBJECTS, { onConflict: 'slug', ignoreDuplicates: true });

  if (subjectsError) {
    throw new Error(`Failed to seed subjects: ${subjectsError.message}`);
  }

  // 2. Look up subject IDs
  const { data: subjectRows, error: lookupError } = await admin
    .from('subjects')
    .select('id, slug');

  if (lookupError || !subjectRows) {
    throw new Error(`Failed to fetch subject IDs: ${lookupError?.message}`);
  }

  const subjectIdBySlug = new Map(subjectRows.map((s: { id: string; slug: string }) => [s.slug, s.id]));

  // 3. Upsert categories
  const categoryRows = CATEGORIES.map((c) => {
    const subjectId = subjectIdBySlug.get(c.subjectSlug);
    if (!subjectId) {
      throw new Error(`Subject not found for slug: ${c.subjectSlug}`);
    }
    return {
      slug: c.slug,
      name: c.name,
      description: c.description,
      subject_id: subjectId,
      display_order: c.display_order,
    };
  });

  const { error: categoriesError } = await admin
    .from('categories')
    .upsert(categoryRows, { onConflict: 'slug', ignoreDuplicates: true });

  if (categoriesError) {
    throw new Error(`Failed to seed categories: ${categoriesError.message}`);
  }

  return {
    subjects: SUBJECTS.length,
    categories: CATEGORIES.length,
  };
}
