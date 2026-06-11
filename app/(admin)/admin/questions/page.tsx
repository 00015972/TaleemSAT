import { createAdminClient } from '@/lib/supabase/admin';
import {
  QuestionsTable,
  type QuestionRow,
  type FilterOption,
} from '@/components/admin/questions-table';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Questions — Taleem SAT Admin' };

const PAGE_SIZE = 50;

type SearchParams = {
  subject?: string;
  category?: string;
  difficulty?: string;
  status?: string;
  q?: string;
  page?: string;
};

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const admin = createAdminClient();

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Filter option sources
  const [{ data: subjectRows }, { data: categoryRows }] = await Promise.all([
    admin.from('subjects').select('id, name').order('display_order'),
    admin.from('categories').select('id, name, subject_id').order('display_order'),
  ]);

  let query = admin
    .from('questions')
    .select(
      'id, question_text, difficulty, status, created_at, subject_id, category_id, categories(name), subjects(name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (sp.subject) query = query.eq('subject_id', sp.subject);
  if (sp.category) query = query.eq('category_id', sp.category);
  if (sp.difficulty) query = query.eq('difficulty', sp.difficulty as 'easy' | 'medium' | 'hard');
  if (sp.status) query = query.eq('status', sp.status as 'draft' | 'published' | 'archived');
  if (sp.q) query = query.ilike('question_text', `%${sp.q}%`);

  const { data: rows, count } = await query;

  const questions: QuestionRow[] = (rows ?? []).map(r => {
    const category = Array.isArray(r.categories) ? r.categories[0] : r.categories;
    const subject = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    return {
      id: r.id,
      preview: r.question_text.slice(0, 80),
      subjectName: (subject as { name: string } | null)?.name ?? '—',
      categoryName: (category as { name: string } | null)?.name ?? '—',
      difficulty: r.difficulty,
      status: r.status,
      createdAt: r.created_at,
    };
  });

  const subjects: FilterOption[] = (subjectRows ?? []).map(s => ({ value: s.id, label: s.name }));
  const categories = (categoryRows ?? []).map(c => ({
    value: c.id,
    label: c.name,
    subjectId: c.subject_id,
  }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 md:p-8">
      <QuestionsTable
        questions={questions}
        subjects={subjects}
        categories={categories}
        total={total}
        page={page}
        totalPages={totalPages}
        filters={{
          subject: sp.subject ?? '',
          category: sp.category ?? '',
          difficulty: sp.difficulty ?? '',
          status: sp.status ?? '',
          q: sp.q ?? '',
        }}
      />
    </div>
  );
}
