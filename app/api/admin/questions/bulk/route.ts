import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';
import { parseJsonRequest } from '@/lib/validation/request';
import { bulkQuestionActionSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const parsed = await parseJsonRequest(request, bulkQuestionActionSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const { ids, action } = body;

  const admin = createAdminClient();

  if (action === 'delete') {
    // One at a time: a single-statement bulk delete would abort entirely if
    // any row hits the exam_questions/attempts FK restrict, so instead we
    // delete what we can and report the rest back to the admin.
    const deleted: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const qid of ids) {
      const { error } = await admin.from('questions').delete().eq('id', qid);
      if (error) {
        skipped.push({
          id: qid,
          reason:
            error.code === '23503'
              ? 'In use by an exam or has student attempts — archive instead'
              : error.message,
        });
      } else {
        deleted.push(qid);
      }
    }

    await logAudit(admin, {
      actorUserId: user.id,
      action: 'question.bulk_delete',
      targetType: 'question',
      after: { count: deleted.length, skipped: skipped.length },
      note: `${deleted.length} question(s) deleted`,
    });

    return Response.json({ deleted: deleted.length, skipped });
  }

  const status = action === 'publish' ? 'published' : 'archived';

  const { error } = await admin
    .from('questions')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error) {
    return Response.json({ error: 'UPDATE_FAILED', detail: error.message }, { status: 500 });
  }

  await logAudit(admin, {
    actorUserId: user.id,
    action: `question.bulk_${action}`,
    targetType: 'question',
    after: { status, count: ids.length },
    note: `${ids.length} question(s)`,
  });

  return Response.json({ updated: ids.length, status });
}
