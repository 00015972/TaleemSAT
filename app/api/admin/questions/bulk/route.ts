import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';

const MAX_IDS = 200;

const ACTION_TO_STATUS: Record<string, 'published' | 'archived'> = {
  publish: 'published',
  archive: 'archived',
};

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  let body: { ids?: string[]; action?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { ids, action } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: 'NO_IDS' }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return Response.json({ error: 'TOO_MANY_IDS', max: MAX_IDS }, { status: 400 });
  }

  const status = action ? ACTION_TO_STATUS[action] : undefined;
  if (!status) {
    return Response.json({ error: 'INVALID_ACTION' }, { status: 400 });
  }

  const admin = createAdminClient();
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
