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
  topic?: string;
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
  const [{ data: subjectRows }, { data: categoryRows }, { data: topicRows }] = await Promise.all([
    admin.from('subjects').select('id, name').order('display_order'),
    admin.from('categories').select('id, name, subject_id').order('display_order'),
    admin.from('topics').select('id, name, category_id').order('display_order'),
  ]);

  let query = admin
    .from('questions')
    .select(
      'id, question_text, difficulty, status, created_at, subject_id, category_id, source_ref, categories(name), subjects(name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (sp.subject) query = query.eq('subject_id', sp.subject);
  if (sp.category) query = query.eq('category_id', sp.category);
  if (sp.topic) query = query.eq('topic_id', sp.topic);
  if (sp.difficulty) query = query.eq('difficulty', sp.difficulty as 'easy' | 'medium' | 'hard');
  if (sp.status) query = query.eq('status', sp.status as 'draft' | 'published' | 'archived');
  // A search term matches either the question text or its College Board
  // source ID — the ID printed above each question in the source bank, which
  // is what an admin chasing a specific question actually has in hand.
  // Quoted per PostgREST's or() syntax so a comma/paren in the search text
  // isn't parsed as a filter separator.
  if (sp.q) {
    const escaped = sp.q.replace(/"/g, '\\"');
    query = query.or(`question_text.ilike."%${escaped}%",source_ref.ilike."%${escaped}%"`);
  }

  const { data: rows, count } = await query;

  const questions: QuestionRow[] = (rows ?? []).map(r => {
    const category = Array.isArray(r.categories) ? r.categories[0] : r.categories;
    const subject = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    return {
      id: r.id,
      sourceRef: r.source_ref,
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
  const topics = (topicRows ?? []).map(t => ({
    value: t.id,
    label: t.name,
    categoryId: t.category_id,
  }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 md:p-8">
      <QuestionsTable
        questions={questions}
        subjects={subjects}
        categories={categories}
        topics={topics}
        total={total}
        page={page}
        totalPages={totalPages}
        filters={{
          subject: sp.subject ?? '',
          category: sp.category ?? '',
          topic: sp.topic ?? '',
          difficulty: sp.difficulty ?? '',
          status: sp.status ?? '',
          q: sp.q ?? '',
        }}
      />
    </div>
  );
}
