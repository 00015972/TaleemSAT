import { createClient, getClaimsUser } from '@/lib/supabase/server';
import { PracticeShell } from '@/components/practice/practice-shell';
import type { PracticeScope } from '@/components/practice/practice-browse';
import { computePracticeOverview, type PracticeOverview } from '@/lib/practice/overview';

export const metadata = { title: 'Question Bank — Taleem SAT' };

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[]; mode?: string | string[] }>;
}) {
  const supabase = await createClient();
  const user = await getClaimsUser();
  const params = await searchParams;

  let overview: PracticeOverview = { subjects: [] };

  if (user) {
    // Falls back to an empty tree on a DB hiccup rather than crashing the
    // page — there's no error.tsx in this app to catch an unhandled throw.
    overview = await computePracticeOverview(supabase).catch(() => ({ subjects: [] }) as PracticeOverview);
  }

  const requestedCategory = typeof params.category === 'string' ? params.category : null;
  const focusMode = params.mode === 'focus';
  const categoryEntry = focusMode && requestedCategory
    ? overview.subjects.flatMap(subject =>
        subject.categories.map(category => ({ subject, category }))
      ).find(entry => entry.category.slug === requestedCategory)
    : null;
  const initialScope: PracticeScope | null = categoryEntry
    ? {
        kind: 'category',
        slug: categoryEntry.category.slug,
        label: categoryEntry.category.name,
        subjectSlug: categoryEntry.subject.slug,
        difficulty: 'all',
      }
    : null;

  return (
    <PracticeShell
      key={initialScope?.slug ?? 'practice-browse'}
      overview={overview}
      initialScope={initialScope}
    />
  );
}
