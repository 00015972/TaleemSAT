import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: schedule } = await admin
    .from('qod_schedule')
    .select('id, scheduled_date, question_id')
    .eq('id', id)
    .single();

  if (!schedule) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  // Only future-dated QODs can be unscheduled — today and past are locked in.
  const today = new Date().toISOString().slice(0, 10);
  if (schedule.scheduled_date <= today) {
    return Response.json({ error: 'PAST_OR_TODAY' }, { status: 422 });
  }

  const { error } = await admin.from('qod_schedule').delete().eq('id', id);
  if (error) {
    return Response.json({ error: 'DELETE_FAILED', detail: error.message }, { status: 500 });
  }

  await logAudit(admin, {
    actorUserId: user.id,
    action: 'qod.unschedule',
    targetType: 'qod',
    targetId: id,
    before: { scheduled_date: schedule.scheduled_date, question_id: schedule.question_id },
  });

  return Response.json({ ok: true });
}
