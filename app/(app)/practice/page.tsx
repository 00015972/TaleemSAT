import { createClient } from '@/lib/supabase/server';
import { PracticeShell, type Category } from '@/components/practice/practice-shell';

export const metadata = { title: 'Practice — Taleem SAT' };

export default async function PracticePage() {
  const supabase = await createClient();

  // Fetch categories with their subject info via a join
  const { data: rows } = await supabase
    .from('categories')
    .select('id, slug, name, display_order, subjects!inner(slug, name)')
    .order('display_order');

  const categories: Category[] = (rows ?? []).map(row => {
    const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      subject_slug: (subject as { slug: string; name: string }).slug,
      subject_name: (subject as { slug: string; name: string }).name,
    };
  });

  return (
    <div className="wrap py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-txt">Practice</h1>
        <p className="text-sm text-muted mt-1">
          Pick a category and answer questions at your own pace.
        </p>
      </div>
      <PracticeShell categories={categories} />
    </div>
  );
}
