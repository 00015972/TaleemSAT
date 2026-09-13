import Link from 'next/link';
import { FiArrowLeft, FiEdit3 } from 'react-icons/fi';
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
    <section className="question-studio-route">
      <header className="question-studio-route-head question-studio-enter">
        <Link href="/admin/questions" className="question-studio-route-back">
          <FiArrowLeft aria-hidden="true" />
          Questions
        </Link>
        <div className="question-studio-route-title">
          <span className="question-studio-route-icon" aria-hidden="true">
            <FiEdit3 />
          </span>
          <div>
            <p>Question workshop / New</p>
            <h1>Create a question</h1>
            <span>Shape the content in four focused steps and review it exactly as a student will see it.</span>
          </div>
        </div>
      </header>
      <QuestionForm mode="create" subjects={subjects} categories={categories} />
    </section>
  );
}
