import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  QuestionForm,
  type SubjectOption,
  type CategoryOption,
} from '@/components/admin/question-form';

export const metadata = { title: 'New question — Taleem SAT Admin' };

export default async function NewQuestionPage() {
  const supabase = await createClient();

  const [{ data: subjectRows }, { data: categoryRows }] = await Promise.all([
    supabase.from('subjects').select('id, name').order('display_order'),
    supabase.from('categories').select('id, name, subject_id').order('display_order'),
  ]);

  const subjects: SubjectOption[] = subjectRows ?? [];
  const categories: CategoryOption[] = (categoryRows ?? []).map(c => ({
    id: c.id,
    name: c.name,
    subjectId: c.subject_id,
  }));

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/admin/questions" className="hover:underline">
          Questions
        </Link>
        <span>/</span>
        <span className="text-txt">New</span>
      </div>
      <h1 className="font-serif text-2xl font-bold text-txt mb-6">Add question</h1>
      <QuestionForm mode="create" subjects={subjects} categories={categories} />
    </div>
  );
}
