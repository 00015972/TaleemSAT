import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { validateQuestion } from '@/lib/admin/question-validation';
import { sanitizeQuestionTextBlocks, sanitizeRichText } from '@/lib/import/richtext-sanitize';

export const dynamic = 'force-dynamic';

type Body = {
  questionText?: string;
  passage?: string | null;
  options?: { id: string; text: string }[];
  correctAnswer?: string | null;
  acceptedAnswers?: string[];
  explanation?: string;
  difficulty?: string;
  questionType?: string;
  questionImageUrl?: string | null;
  topicId?: string | null;
  /** 'rejected' discards the item; 'pending_review' un-rejects it. */
  status?: 'pending_review' | 'rejected';
};

/**
 * Edit or reject a staged item.
 *
 * Edits are re-validated here, and an item that now passes clears its blocking
 * errors — that is how a reviewer resolves a `verification_failed` item without
 * having to touch the database.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id, itemId } = await params;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: item, error: loadError } = await admin
    .from('import_job_items')
    .select('*')
    .eq('id', itemId)
    .eq('job_id', id)
    .single();

  if (loadError || !item) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  if (item.question_id) {
    return Response.json({ error: 'ALREADY_PROMOTED' }, { status: 409 });
  }

  // A plain reject needs no validation.
  if (body.status === 'rejected') {
    const { error } = await admin
      .from('import_job_items')
      .update({ status: 'rejected' })
      .eq('id', itemId);
    if (error) {
      return Response.json({ error: 'DB_ERROR', detail: error.message }, { status: 500 });
    }
    return Response.json({ ok: true, status: 'rejected' });
  }

  const merged = {
    questionType: body.questionType ?? item.question_type,
    questionText: body.questionText ?? item.question_text ?? '',
    passage: body.passage !== undefined ? body.passage : item.passage,
    options: body.options ?? (item.options as { id: string; text: string }[]),
    correctAnswer: body.correctAnswer !== undefined ? body.correctAnswer : item.correct_answer,
    acceptedAnswers: body.acceptedAnswers ?? item.accepted_answers ?? [],
    explanation: body.explanation ?? item.explanation ?? '',
    difficulty: body.difficulty ?? item.difficulty ?? '',
    topicId: body.topicId !== undefined ? body.topicId : item.topic_id,
    questionImageUrl:
      body.questionImageUrl !== undefined ? body.questionImageUrl : item.question_image_url,
  };

  // Changing the topic moves the item's category and subject with it, so the
  // promoted question stays consistent with the taxonomy.
  let subjectId = item.subject_id;
  let categoryId = item.category_id;
  if (merged.topicId && merged.topicId !== item.topic_id) {
    const { data: topic } = await admin
      .from('topics')
      .select('category_id, categories(subject_id)')
      .eq('id', merged.topicId)
      .single();
    if (!topic) {
      return Response.json({ error: 'TOPIC_NOT_FOUND' }, { status: 400 });
    }
    categoryId = topic.category_id;
    const cat = topic.categories as unknown as { subject_id: string } | null;
    subjectId = cat?.subject_id ?? subjectId;
  }

  // Sanitize here regardless of source: content already parsed by
  // lib/import/html-questions.ts is already sanitized (re-sanitizing is a
  // no-op), but an admin free-typing into the review editor bypasses that
  // parser entirely and must not reach `dangerouslySetInnerHTML` unsanitized.
  merged.questionText = sanitizeQuestionTextBlocks(merged.questionText);
  merged.explanation = sanitizeQuestionTextBlocks(merged.explanation);
  const options = (merged.options ?? []).map(o => ({ ...o, text: sanitizeRichText(o.text) }));
  const validation = validateQuestion({
    subjectId: subjectId ?? '',
    categoryId: categoryId ?? '',
    questionText: merged.questionText,
    passage: merged.passage,
    options: {
      A: options.find(o => o.id === 'A')?.text ?? '',
      B: options.find(o => o.id === 'B')?.text ?? '',
      C: options.find(o => o.id === 'C')?.text ?? '',
      D: options.find(o => o.id === 'D')?.text ?? '',
    },
    correctAnswer: merged.correctAnswer ?? '',
    explanation: merged.explanation,
    difficulty: merged.difficulty,
    status: 'draft',
    questionType: merged.questionType,
    acceptedAnswers: merged.acceptedAnswers,
  });

  const { error } = await admin
    .from('import_job_items')
    .update({
      status: validation.ok ? 'pending_review' : 'verification_failed',
      question_type: merged.questionType as 'mcq' | 'grid_in',
      question_text: merged.questionText || null,
      passage: merged.passage,
      options: merged.questionType === 'grid_in' ? [] : options,
      correct_answer: merged.correctAnswer,
      accepted_answers: merged.acceptedAnswers,
      explanation: merged.explanation || null,
      difficulty: merged.difficulty as 'easy' | 'medium' | 'hard',
      question_image_url: merged.questionImageUrl,
      topic_id: merged.topicId,
      subject_id: subjectId,
      category_id: categoryId,
      validation_errors: validation.ok ? null : validation.errors,
    })
    .eq('id', itemId);

  if (error) {
    return Response.json({ error: 'DB_ERROR', detail: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    status: validation.ok ? 'pending_review' : 'verification_failed',
    errors: validation.errors,
  });
}
