import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';
import { invalidPathParameter, parseJsonRequest } from '@/lib/validation/request';
import { adminUserUpdateSchema, uuidSchema } from '@/lib/validation/schemas';
import { getAdminUserDetail } from '@/lib/admin/users';

type Role = 'student' | 'admin';
type Tier = 'free' | 'pro' | 'elite';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return invalidPathParameter('id');

  try {
    const user = await getAdminUserDetail(id);
    if (!user) {
      return Response.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }
    return Response.json({ user });
  } catch (error) {
    console.error('[admin-users] detail request failed', error);
    return Response.json({ error: 'DETAIL_FAILED' }, { status: 500 });
  }
}

/**
 * Change a user's role and/or tier. Sensitive: every change is audit-logged.
 *
 * Guards:
 *  - an admin cannot change their OWN role (avoids accidental self-lockout)
 *  - the LAST remaining admin cannot be demoted (avoids locking everyone out)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return invalidPathParameter('id');

  const parsed = await parseJsonRequest(request, adminUserUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const { role, tier } = body;

  // Self-protection: never let an admin change their own role.
  if (role !== undefined && id === user.id) {
    return Response.json({ error: 'CANNOT_CHANGE_OWN_ROLE' }, { status: 409 });
  }

  const admin = createAdminClient();

  const { data: before } = await admin
    .from('users')
    .select('email, role, tier')
    .eq('id', id)
    .single();

  if (!before) {
    return Response.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  // Don't allow demoting the last admin.
  if (role === 'student' && before.role === 'admin') {
    const { count } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');
    if ((count ?? 0) <= 1) {
      return Response.json({ error: 'LAST_ADMIN' }, { status: 409 });
    }
  }

  const patch: { role?: Role; tier?: Tier; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (role !== undefined) patch.role = role;
  if (tier !== undefined) patch.tier = tier;

  const { error } = await admin.from('users').update(patch).eq('id', id);
  if (error) {
    return Response.json({ error: 'UPDATE_FAILED', detail: error.message }, { status: 500 });
  }

  const changes = [
    role && role !== before.role ? `role ${before.role}→${role}` : null,
    tier && tier !== before.tier ? `tier ${before.tier}→${tier}` : null,
  ].filter(Boolean);

  await logAudit(admin, {
    actorUserId: user.id,
    action: 'user.update',
    targetType: 'user',
    targetId: id,
    before: { role: before.role, tier: before.tier },
    after: { role: role ?? before.role, tier: tier ?? before.tier },
    note: `${before.email}: ${changes.join(', ') || 'no change'}`,
  });

  return Response.json({ id });
}
