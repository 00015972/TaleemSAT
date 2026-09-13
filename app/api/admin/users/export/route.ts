import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin/require-admin';
import { getUsersExportRows } from '@/lib/admin/users';
import { usersToCsv } from '@/lib/admin/users.csv';
import {
  parseUsersSearchParams,
  USERS_EXPORT_LIMIT,
  type UsersSearchParams,
} from '@/lib/admin/users.params';

export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries()) as UsersSearchParams;
  const filters = parseUsersSearchParams(raw);

  try {
    const { rows, total } = await getUsersExportRows(filters);
    if (total > USERS_EXPORT_LIMIT) {
      return Response.json(
        { error: 'EXPORT_LIMIT', limit: USERS_EXPORT_LIMIT },
        { status: 413 }
      );
    }

    const day = new Date().toISOString().slice(0, 10);
    return new Response(usersToCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="taleemsat-users-${day}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[admin-users] export failed', error);
    return Response.json({ error: 'EXPORT_FAILED' }, { status: 500 });
  }
}
