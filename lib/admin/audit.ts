import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';

type AuditEntry = {
  actorUserId: string;
  action: string; // e.g. 'question.create', 'question.update', 'qod.schedule'
  targetType: 'question' | 'qod';
  targetId?: string | null;
  before?: Json | null;
  after?: Json | null;
  note?: string | null;
};

/**
 * Record an admin action in audit_log. Must be called with the service-role
 * admin client (there is no insert RLS policy — writes go through service role).
 *
 * Fire-and-forget: a logging failure must never break the user's action, so
 * errors are swallowed (and surfaced to the server console only).
 */
export async function logAudit(
  admin: SupabaseClient<Database>,
  entry: AuditEntry
): Promise<void> {
  const { error } = await admin.from('audit_log').insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    note: entry.note ?? null,
  });

  if (error) {
    console.error('[audit] failed to write log entry:', entry.action, error.message);
  }
}
