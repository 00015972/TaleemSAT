import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { UsersTable, type UserRow } from '@/components/admin/users-table';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Users — Taleem SAT Admin' };

const PAGE_SIZE = 50;

type SearchParams = {
  q?: string;
  role?: string;
  tier?: string;
  page?: string;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const admin = createAdminClient();

  // Current admin's id — used to block editing one's own role in the UI.
  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from('users')
    .select('id, email, full_name, role, tier, points, streak_days, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (sp.role) query = query.eq('role', sp.role as 'student' | 'admin');
  if (sp.tier) query = query.eq('tier', sp.tier as 'free' | 'pro' | 'elite');
  if (sp.q) {
    const term = sp.q.replace(/[%,]/g, '');
    query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  }

  const { data: rows, count } = await query;

  const users: UserRow[] = (rows ?? []).map(u => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    tier: u.tier,
    points: u.points,
    streakDays: u.streak_days,
    createdAt: u.created_at,
  }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 md:p-8">
      <UsersTable
        users={users}
        total={total}
        page={page}
        totalPages={totalPages}
        currentUserId={me?.id ?? ''}
        filters={{
          q: sp.q ?? '',
          role: sp.role ?? '',
          tier: sp.tier ?? '',
        }}
      />
    </div>
  );
}
