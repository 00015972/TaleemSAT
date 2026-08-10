import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';
import { validateQuestion } from '@/lib/admin/question-validation';

export const dynamic = 'force-dynamic';

/**
 * Promote staged items into `questions` as drafts.
 *
 * This is the only path from staging into the real bank, so it re-validates
 * every item rather than trusting the status stored at extraction time — the
 * row could have been edited since, and an item that failed verification must
 * never slip through. Promoted questions land as `draft`: publishing stays a
 * separate, deliberate act in the questions admin.
 *
 * Body: { itemIds: string[] } — pass explicitly; there is no "promote
 * everything" shortcut, because approving in bulk is exactly where mistakes
 * become expensive.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const { id } = await params;

  let body: { itemIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const itemIds = (body.itemIds ?? []).filter(Boolean);
  if (itemIds.length === 0) {
    return Response.json({ error: 'NO_ITEMS' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: items, error: loadError } = await admin
    .from('import_job_items')
    .select('*')
    .eq('job_id', id)
    .in('id', itemIds);

  if (loadError) {
    return Response.json({ error: 'DB_ERROR', detail: loadError.message }, { status: 500 });
  }

  const promoted: string[] = [];
  const skipped: { itemId: string; reason: string }[] = [];

  for (const item of items ?? []) {
    if (item.question_id) {
      skipped.push({ itemId: item.id, reason: 'Already promoted' });
      continue;
    }
    if (item.status === 'rejected') {
      skipped.push({ itemId: item.id, reason: 'Rejected' });
      continue;
    }

    const options = (item.options ?? []) as { id: string; text: string }[];
    const validation = validateQuestion({
      subjectId: item.subject_id ?? '',
      categoryId: item.category_id ?? '',
      questionText: item.question_text ?? '',
      passage: item.passage,
      options: {
        A: options.find(o => o.id === 'A')?.text ?? '',
        B: options.find(o => o.id === 'B')?.text ?? '',
        C: options.find(o => o.id === 'C')?.text ?? '',
        D: options.find(o => o.id === 'D')?.text ?? '',
      },
      correctAnswer: item.correct_answer ?? '',
      explanation: item.explanation ?? '',
      difficulty: item.difficulty ?? '',
      status: 'draft',
      questionType: item.question_type,
      acceptedAnswers: item.accepted_answers ?? [],
    });

    if (!validation.ok) {
      skipped.push({ itemId: item.id, reason: validation.errors[0] });
      continue;
    }

    const { data: question, error: insertError } = await admin
      .from('questions')
      .insert({
        subject_id: item.subject_id!,
        category_id: item.category_id!,
        topic_id: item.topic_id,
        question_type: item.question_type,
        question_text: item.question_text!,
        passage: item.passage,
        // The page render is a review aid and shows the rationale; only a
        // deliberately attached figure ever reaches a student.
        question_image_url: item.question_image_url,
        chart_svg: item.chart_svg,
        options: item.question_type === 'grid_in' ? [] : options,
        correct_answer: item.correct_answer ?? '',
        accepted_answers: item.accepted_answers ?? [],
        explanation: item.explanation!,
        difficulty: item.difficulty!,
        status: 'draft',
        tags: [],
        created_by: user.id,
      })
      .select('id')
      .single();

    if (insertError || !question) {
      skipped.push({ itemId: item.id, reason: insertError?.message ?? 'Insert failed' });
      continue;
    }

    await admin
      .from('import_job_items')
      .update({ status: 'approved', question_id: question.id })
      .eq('id', item.id);

    promoted.push(question.id);
  }

  await logAudit(admin, {
    actorUserId: user.id,
    action: 'import.promote',
    targetType: 'question',
    targetId: id,
    after: { promoted: promoted.length, skipped: skipped.length },
    note: `Promoted ${promoted.length} imported question(s) to draft`,
  });

  return Response.json({
    promoted: promoted.length,
    skipped,
    questionIds: promoted,
  });
}
