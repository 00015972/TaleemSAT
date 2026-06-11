import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';

const HARD_BLOCK_DAYS = 30;
const WARN_DAYS = 90;

function daysBetween(a: string, b: string) {
  const ms = Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime());
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  let body: { scheduledDate?: string; questionId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { scheduledDate, questionId } = body;
  if (!scheduledDate || !questionId) {
    return Response.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return Response.json({ error: 'INVALID_DATE' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (scheduledDate < today) {
    return Response.json({ error: 'PAST_DATE' }, { status: 422 });
  }

  const admin = createAdminClient();

  // Date already taken?
  const { data: dateTaken } = await admin
    .from('qod_schedule')
    .select('id')
    .eq('scheduled_date', scheduledDate)
    .maybeSingle();

  if (dateTaken) {
    return Response.json({ error: 'DATE_TAKEN' }, { status: 409 });
  }

  // Question must exist and be published.
  const { data: question } = await admin
    .from('questions')
    .select('id, status')
    .eq('id', questionId)
    .single();

  if (!question) {
    return Response.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
  }
  if (question.status !== 'published') {
    return Response.json({ error: 'QUESTION_NOT_PUBLISHED' }, { status: 422 });
  }

  // Rotation: hard-block reuse within 30 days of any other scheduling.
  const { data: priorUses } = await admin
    .from('qod_schedule')
    .select('scheduled_date')
    .eq('question_id', questionId);

  let nearestDays: number | null = null;
  for (const use of priorUses ?? []) {
    const d = daysBetween(use.scheduled_date, scheduledDate);
    if (nearestDays === null || d < nearestDays) nearestDays = d;
  }

  if (nearestDays !== null && nearestDays <= HARD_BLOCK_DAYS) {
    return Response.json(
      { error: 'REUSE_TOO_SOON', daysApart: nearestDays, minDays: HARD_BLOCK_DAYS },
      { status: 422 }
    );
  }

  const { data: inserted, error } = await admin
    .from('qod_schedule')
    .insert({
      scheduled_date: scheduledDate,
      question_id: questionId,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return Response.json({ error: 'INSERT_FAILED', detail: error?.message }, { status: 500 });
  }

  await logAudit(admin, {
    actorUserId: user.id,
    action: 'qod.schedule',
    targetType: 'qod',
    targetId: inserted.id,
    after: { scheduled_date: scheduledDate, question_id: questionId },
  });

  const warn =
    nearestDays !== null && nearestDays <= WARN_DAYS
      ? `This question was last used ${nearestDays} days from this date.`
      : null;

  return Response.json({ id: inserted.id, scheduledDate, warn });
}
