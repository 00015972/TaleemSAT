import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';
import {
  validateQuestion,
  type QuestionInput,
} from '@/lib/admin/question-validation';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const { id } = await params;

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

  const admin = createAdminClient();

  // Capture the prior state for the audit trail.
  const { data: before } = await admin
    .from('questions')
    .select('status, question_text, correct_answer, difficulty')
    .eq('id', id)
    .single();

  if (!before) {
    return Response.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
  }

  const { error } = await admin
    .from('questions')
    .update({
      subject_id: body.subjectId,
      category_id: body.categoryId,
      question_text: body.questionText.trim(),
      passage: body.passage?.trim() || null,
      options: body.options,
      correct_answer: body.correctAnswer,
      explanation: body.explanation.trim(),
      difficulty: body.difficulty as 'easy' | 'medium' | 'hard',
      status: body.status as 'draft' | 'published' | 'archived',
      tags: body.tags ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return Response.json({ error: 'UPDATE_FAILED', detail: error.message }, { status: 500 });
  }

  await logAudit(admin, {
    actorUserId: user.id,
    action: 'question.update',
    targetType: 'question',
    targetId: id,
    before,
    after: {
      status: body.status,
      question_text: body.questionText.trim(),
      correct_answer: body.correctAnswer,
      difficulty: body.difficulty,
    },
  });

  return Response.json({ id });
}
