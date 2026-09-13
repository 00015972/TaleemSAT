import { NextRequest } from 'next/server';
import { buildAuthCallbackUrl } from '@/lib/auth/redirect';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';
import { invalidPathParameter } from '@/lib/validation/request';
import { uuidSchema } from '@/lib/validation/schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user: actor } = gate;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return invalidPathParameter('id');

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from('users')
    .select('email')
    .eq('id', id)
    .maybeSingle();
  if (targetError) return Response.json({ error: 'RESET_FAILED' }, { status: 500 });
  if (!target) return Response.json({ error: 'USER_NOT_FOUND' }, { status: 404 });

  const redirectTo = buildAuthCallbackUrl(request.nextUrl.origin, {
    next: '/reset-password',
    flow: 'recovery',
  });
  const { error } = await admin.auth.resetPasswordForEmail(target.email, { redirectTo });
  if (error) {
    console.error('[admin-users] reset request failed', error);
    return Response.json({ error: 'RESET_FAILED' }, { status: 502 });
  }

  await logAudit(admin, {
    actorUserId: actor.id,
    action: 'user.password_reset.request',
    targetType: 'user',
    targetId: id,
    note: 'Password recovery email requested by an administrator',
  });

  return Response.json({ ok: true });
}
