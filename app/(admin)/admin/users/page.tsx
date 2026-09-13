import { UsersWorkspace } from '@/components/admin/users/users-workspace';
import { getUsersDirectory, getUsersWorkspaceSummary } from '@/lib/admin/users';
import {
  parseUsersSearchParams,
  USERS_PAGE_SIZE,
  type UsersSearchParams,
} from '@/lib/admin/users.params';
import type { UsersPagePayload } from '@/lib/admin/users.types';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClaimsUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Users — Taleem SAT Admin' };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<UsersSearchParams>;
}) {
  const filters = parseUsersSearchParams(await searchParams);
  const admin = createAdminClient();

  const [me, summaryResult, directoryResult] = await Promise.all([
    getClaimsUser(),
    getUsersWorkspaceSummary(admin),
    getUsersDirectory(filters, admin),
  ]);

  const totalPages = Math.max(1, Math.ceil(directoryResult.total / USERS_PAGE_SIZE));
  const payload: UsersPagePayload = {
    users: directoryResult.users,
    summary: summaryResult.summary,
    total: directoryResult.total,
    totalPages,
    filters,
    summaryError: summaryResult.error,
    directoryError: directoryResult.error,
  };

  return (
    <div className="users-pulse-route">
      <UsersWorkspace
        key={JSON.stringify(filters)}
        payload={payload}
        currentUserId={me?.id ?? ''}
      />
    </div>
  );
}
