import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminUserNotes } from '@/lib/admin/users';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAudit } from '@/lib/admin/audit';
import { invalidPathParameter, parseJsonRequest } from '@/lib/validation/request';
import { adminUserNoteSchema, uuidSchema } from '@/lib/validation/schemas';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return invalidPathParameter('id');

  try {
    const notes = await getAdminUserNotes(id);
    return Response.json({ notes });
  } catch (error) {
    console.error('[admin-users] note list failed', error);
    return Response.json({ error: 'NOTES_FAILED' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return invalidPathParameter('id');

  const parsed = await parseJsonRequest(request, adminUserNoteSchema);
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: target } = await admin.from('users').select('id').eq('id', id).maybeSingle();
  if (!target) return Response.json({ error: 'USER_NOT_FOUND' }, { status: 404 });

  const { data: note, error } = await admin
    .from('admin_user_notes')
    .insert({
      user_id: id,
      author_user_id: user.id,
      body: parsed.data.body,
    })
    .select('id, body, created_at, author_user_id')
    .single();
  if (error || !note) {
    console.error('[admin-users] note create failed', error);
    return Response.json({ error: 'NOTE_CREATE_FAILED' }, { status: 500 });
  }

  await logAudit(admin, {
    actorUserId: user.id,
    action: 'user.note.create',
    targetType: 'user',
    targetId: id,
    after: { note_id: note.id },
    note: `Internal note ${note.id} added`,
  });

  return Response.json(
    {
      note: {
        id: note.id,
        body: note.body,
        createdAt: note.created_at,
        authorUserId: note.author_user_id,
        authorName: null,
        authorEmail: user.email,
      },
    },
    { status: 201 }
  );
}
