import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';

const ROLES = ['student', 'admin'] as const;
const TIERS = ['free', 'pro', 'elite'] as const;
type Role = (typeof ROLES)[number];
type Tier = (typeof TIERS)[number];

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

  let body: { role?: string; tier?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { role, tier } = body;

  if (role === undefined && tier === undefined) {
    return Response.json({ error: 'NOTHING_TO_UPDATE' }, { status: 400 });
  }
  if (role !== undefined && !ROLES.includes(role as Role)) {
    return Response.json({ error: 'INVALID_ROLE' }, { status: 422 });
  }
  if (tier !== undefined && !TIERS.includes(tier as Tier)) {
    return Response.json({ error: 'INVALID_TIER' }, { status: 422 });
  }

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
  if (role !== undefined) patch.role = role as Role;
  if (tier !== undefined) patch.tier = tier as Tier;

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
