import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { FiArrowLeft, FiEdit3 } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/server';
import {
  QuestionForm,
  type SubjectOption,
  type CategoryOption,
  type QuestionFormInitial,
} from '@/components/admin/question-form';
import { ANSWER_KEYS, type QuestionOptions } from '@/lib/admin/question-validation';

/** Options are stored as [{ id: 'A', text }, ...] — see app/api/admin/questions/route.ts. */
function toOptionsMap(raw: unknown): QuestionOptions {
  const map: QuestionOptions = { A: '', B: '', C: '', D: '' };
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const key = entry?.id as keyof QuestionOptions | undefined;
      if (key && ANSWER_KEYS.includes(key)) map[key] = entry?.text ?? '';
    }
  }
  return map;
}

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
          'id, subject_id, category_id, question_text, passage, question_type, options, correct_answer, accepted_answers, explanation, difficulty, status, tags, tables, chart_svg'
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

  const initial: QuestionFormInitial = {
    subjectId: question.subject_id,
    categoryId: question.category_id,
    questionText: question.question_text,
    passage: question.passage ?? '',
    questionType: question.question_type,
    options: toOptionsMap(question.options),
    correctAnswer: question.correct_answer,
    acceptedAnswers: question.accepted_answers ?? [],
    explanation: question.explanation,
    difficulty: question.difficulty,
    status: question.status,
    tags: question.tags ?? [],
    tables: question.tables ?? [],
    chartSvg: question.chart_svg ?? null,
  };

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
            <p>Question workshop / Edit</p>
            <div className="question-studio-route-title-line">
              <h1>Edit question</h1>
              <StatusBadge status={question.status} />
            </div>
            <span>Refine each stage, confirm the student view, and save when every detail is ready.</span>
          </div>
        </div>
      </header>
      <QuestionForm
        mode="edit"
        questionId={question.id}
        subjects={subjects}
        categories={categories}
        initial={initial}
      />
    </section>
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
    <span className="question-studio-route-status" style={{ '--status-color': color } as CSSProperties}>
      {status}
    </span>
  );
}
