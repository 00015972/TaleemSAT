import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  QuestionForm,
  type SubjectOption,
  type CategoryOption,
  type QuestionFormInitial,
} from '@/components/admin/question-form';
import type { QuestionOptions } from '@/lib/admin/question-validation';

export const metadata = { title: 'Edit question — Taleem SAT Admin' };

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: question }, { data: subjectRows }, { data: categoryRows }] =
    await Promise.all([
      supabase
        .from('questions')
        .select(
          'id, subject_id, category_id, question_text, passage, options, correct_answer, explanation, difficulty, status, tags'
        )
        .eq('id', id)
        .single(),
      supabase.from('subjects').select('id, name').order('display_order'),
      supabase.from('categories').select('id, name, subject_id').order('display_order'),
    ]);

  if (!question) notFound();

  const subjects: SubjectOption[] = subjectRows ?? [];
  const categories: CategoryOption[] = (categoryRows ?? []).map(c => ({
    id: c.id,
    name: c.name,
    subjectId: c.subject_id,
  }));

  const opts = (question.options ?? {}) as Partial<QuestionOptions>;
  const initial: QuestionFormInitial = {
    subjectId: question.subject_id,
    categoryId: question.category_id,
    questionText: question.question_text,
    passage: question.passage ?? '',
    options: {
      A: opts.A ?? '',
      B: opts.B ?? '',
      C: opts.C ?? '',
      D: opts.D ?? '',
    },
    correctAnswer: question.correct_answer,
    explanation: question.explanation,
    difficulty: question.difficulty,
    status: question.status,
    tags: question.tags ?? [],
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="adm-crumbs">
        <Link href="/admin/questions">Questions</Link>
        <span>/</span>
        <span className="here">Edit</span>
      </div>
      <div className="adm-head">
        <h1>Edit question</h1>
        <StatusBadge status={question.status} />
      </div>
      <QuestionForm
        mode="edit"
        questionId={question.id}
        subjects={subjects}
        categories={categories}
        initial={initial}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    published: 'var(--ok)',
    draft: 'var(--gold-d)',
    archived: 'var(--muted)',
  };
  const color = colors[status] ?? 'var(--muted)';
  return (
    <span
      className="adm-pill"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {status}
    </span>
  );
}
