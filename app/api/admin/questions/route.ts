import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { PRACTICE_CATALOG_CACHE_TAG } from '@/lib/practice/overview';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';
import {
  validateQuestion,
  type QuestionInput,
} from '@/lib/admin/question-validation';
import { sanitizeQuestionTextBlocks, sanitizeRichText } from '@/lib/import/richtext-sanitize';

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  let body: QuestionInput;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const result = validateQuestion(body);
  if (!result.ok) {
    return Response.json(
      { error: 'VALIDATION_FAILED', errors: result.errors, fieldErrors: result.fieldErrors },
      { status: 422 }
    );
  }

  const questionType = (body.questionType ?? 'mcq') as 'mcq' | 'grid_in';
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('questions')
    .insert({
      subject_id: body.subjectId,
      category_id: body.categoryId,
      question_text: sanitizeQuestionTextBlocks(body.questionText.trim()),
      passage: body.passage?.trim() || null,
      question_type: questionType,
      options:
        questionType === 'grid_in'
          ? []
          : (['A', 'B', 'C', 'D'] as const).map(k => ({
              id: k,
              text: sanitizeRichText(body.options[k]),
            })),
      correct_answer: body.correctAnswer,
      accepted_answers: questionType === 'grid_in' ? (body.acceptedAnswers ?? []) : [],
      explanation: sanitizeQuestionTextBlocks(body.explanation.trim()),
      difficulty: body.difficulty as 'easy' | 'medium' | 'hard',
      status: body.status as 'draft' | 'published' | 'archived',
      tags: body.tags ?? [],
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    return Response.json({ error: 'INSERT_FAILED', detail: error?.message }, { status: 500 });
  }

  await logAudit(admin, {
    actorUserId: user.id,
    action: 'question.create',
    targetType: 'question',
    targetId: data.id,
    after: { status: body.status, question_text: body.questionText.trim() },
  });

  revalidateTag(PRACTICE_CATALOG_CACHE_TAG, 'max');
  return Response.json({ id: data.id });
}
