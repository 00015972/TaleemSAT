import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/supabase/types';
import {
  USERS_EXPORT_LIMIT,
  USERS_PAGE_SIZE,
} from './users.params';
import type {
  AdminSubscriptionStatus,
  AdminUserDetail,
  AdminUserNote,
  UserDirectoryRow,
  UsersFilters,
  UsersWorkspaceSummary,
} from './users.types';

type AdminClient = SupabaseClient<Database>;
type DirectoryResult = {
  users: UserDirectoryRow[];
  total: number;
  error: boolean;
};

const DAY_MS = 86_400_000;

function asCount(value: number | string | null | undefined): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function asActivity(value: Json): number[] {
  if (!Array.isArray(value)) return [0, 0, 0, 0, 0, 0, 0];
  return Array.from({ length: 7 }, (_, index) => asCount(value[index] as number | string | null));
}

function accuracy(correct: number, total: number): number | null {
  return total > 0 ? Math.round((correct / total) * 1000) / 10 : null;
}

function mapDirectoryRow(row: Database['public']['Functions']['admin_users_directory']['Returns'][number]): UserDirectoryRow {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    tier: row.tier,
    createdAt: row.created_at,
    subscriptionStatus: row.subscription_status,
    lastActiveAt: row.last_active_at,
    attempts7d: asCount(row.attempts_7d),
    totalAttempts: asCount(row.total_attempts),
    correctAttempts: asCount(row.correct_attempts),
    accuracy: row.accuracy === null ? null : asCount(row.accuracy),
    dailyActivity: asActivity(row.daily_activity),
  };
}

export async function getUsersWorkspaceSummary(
  client: AdminClient = createAdminClient()
): Promise<{ summary: UsersWorkspaceSummary | null; error: boolean }> {
  const { data, error } = await client.rpc('admin_users_summary');
  const row = data?.[0];
  if (!error && row) {
    return {
      summary: {
        totalUsers: asCount(row.total_users),
        paidAccess: asCount(row.paid_access),
        weeklyActive: asCount(row.weekly_active),
        needsAttention: asCount(row.needs_attention),
        workspaceHealth: asCount(row.workspace_health),
        renewalRisk: asCount(row.renewal_risk),
        inactivePaid: asCount(row.inactive_paid),
        recentUpgrades: asCount(row.recent_upgrades),
      },
      error: false,
    };
  }

  // Transitional fallback keeps the page useful before migration 017 is
  // applied. The production path above remains a single database aggregate.
  try {
    return { summary: await getSummaryFallback(client), error: false };
  } catch (fallbackError) {
    console.error('[admin-users] summary unavailable', error ?? fallbackError);
    return { summary: null, error: true };
  }
}

async function getSummaryFallback(client: AdminClient): Promise<UsersWorkspaceSummary> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * DAY_MS).toISOString();
  const fourteenDaysAgo = new Date(now - 14 * DAY_MS).toISOString();

  const [usersResult, attemptsResult, subscriptionsResult, auditResult] = await Promise.all([
    client
      .from('users')
      .select('id, tier, created_at, subscription_status')
      .limit(USERS_EXPORT_LIMIT),
    client.from('attempts').select('user_id, created_at').gte('created_at', fourteenDaysAgo).limit(USERS_EXPORT_LIMIT),
    client
      .from('subscriptions')
      .select('user_id, tier, status, created_at')
      .gte('created_at', sevenDaysAgo)
      .limit(USERS_EXPORT_LIMIT),
    client
      .from('audit_log')
      .select('target_id, before, after')
      .eq('target_type', 'user')
      .eq('action', 'user.update')
      .gte('created_at', sevenDaysAgo)
      .limit(USERS_EXPORT_LIMIT),
  ]);

  if (usersResult.error || attemptsResult.error || subscriptionsResult.error || auditResult.error) {
    throw usersResult.error ?? attemptsResult.error ?? subscriptionsResult.error ?? auditResult.error;
  }

  const users = usersResult.data ?? [];
  const active7 = new Set(
    (attemptsResult.data ?? [])
      .filter(item => new Date(item.created_at).getTime() >= now - 7 * DAY_MS)
      .map(item => item.user_id)
  );
  const active14 = new Set((attemptsResult.data ?? []).map(item => item.user_id));
  const renewalIds = new Set(
    users
      .filter(user => user.subscription_status === 'past_due' || user.subscription_status === 'incomplete')
      .map(user => user.id)
  );
  const inactiveIds = new Set(
    users
      .filter(
        user =>
          (user.tier === 'pro' || user.tier === 'elite') &&
          new Date(user.created_at).getTime() <= now - 14 * DAY_MS &&
          !active14.has(user.id)
      )
      .map(user => user.id)
  );
  const attention = new Set([...renewalIds, ...inactiveIds]);
  const paidAccess = users.filter(user => user.tier === 'pro' || user.tier === 'elite').length;
  const recentUpgradeIds = new Set<string>();

  for (const subscription of subscriptionsResult.data ?? []) {
    if (
      (subscription.tier === 'pro' || subscription.tier === 'elite') &&
      (subscription.status === 'active' || subscription.status === 'trialing')
    ) {
      recentUpgradeIds.add(subscription.user_id);
    }
  }
  for (const entry of auditResult.data ?? []) {
    const before = entry.before && typeof entry.before === 'object' && !Array.isArray(entry.before) ? entry.before : {};
    const after = entry.after && typeof entry.after === 'object' && !Array.isArray(entry.after) ? entry.after : {};
    if (entry.target_id && before.tier === 'free' && (after.tier === 'pro' || after.tier === 'elite')) {
      recentUpgradeIds.add(entry.target_id);
    }
  }

  return {
    totalUsers: users.length,
    paidAccess,
    weeklyActive: active7.size,
    needsAttention: attention.size,
    workspaceHealth:
      paidAccess === 0
        ? 100
        : Math.max(0, Math.min(100, Math.round((100 * (paidAccess - attention.size)) / paidAccess))),
    renewalRisk: renewalIds.size,
    inactivePaid: inactiveIds.size,
    recentUpgrades: recentUpgradeIds.size,
  };
}

export async function getUsersDirectory(
  filters: UsersFilters,
  client: AdminClient = createAdminClient()
): Promise<DirectoryResult> {
  const offset = (filters.page - 1) * USERS_PAGE_SIZE;
  const { data, error } = await client.rpc('admin_users_directory', {
    p_search: filters.q || null,
    p_role: filters.role || null,
    p_tier: filters.tier || null,
    p_segment: filters.segment || null,
    p_sort: filters.sort,
    p_offset: offset,
    p_limit: USERS_PAGE_SIZE,
  });

  if (!error && data) {
    return {
      users: data.map(mapDirectoryRow),
      total: data.length > 0 ? asCount(data[0].filtered_total) : 0,
      error: false,
    };
  }

  try {
    return await getDirectoryFallback(filters, client);
  } catch (fallbackError) {
    console.error('[admin-users] directory unavailable', error ?? fallbackError);
    return { users: [], total: 0, error: true };
  }
}

async function getDirectoryFallback(filters: UsersFilters, client: AdminClient): Promise<DirectoryResult> {
  if (filters.segment || filters.sort === 'recent-activity' || filters.sort === 'lowest-accuracy') {
    throw new Error('Advanced user filters require migration 017.');
  }

  const from = (filters.page - 1) * USERS_PAGE_SIZE;
  const to = from + USERS_PAGE_SIZE - 1;
  let query = client
    .from('users')
    .select('id, email, full_name, role, tier, created_at, subscription_status', { count: 'exact' });

  if (filters.role) query = query.eq('role', filters.role);
  if (filters.tier) query = query.eq('tier', filters.tier);
  if (filters.q) {
    const term = filters.q.replace(/[%_,()"\\]/g, ' ').trim();
    if (term) query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  }

  const { data: rows, count, error } = await query
    .order('created_at', { ascending: filters.sort === 'oldest' })
    .range(from, to);
  if (error) throw error;

  const ids = (rows ?? []).map(row => row.id);
  const { data: attempts, error: attemptsError } = ids.length
    ? await client
        .from('attempts')
        .select('user_id, is_correct, created_at')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(USERS_EXPORT_LIMIT)
    : { data: [], error: null };
  if (attemptsError) throw attemptsError;

  const byUser = new Map<string, { total: number; correct: number; last: string | null; days: number[] }>();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (const attempt of attempts ?? []) {
    const stats = byUser.get(attempt.user_id) ?? { total: 0, correct: 0, last: null, days: [0, 0, 0, 0, 0, 0, 0] };
    stats.total += 1;
    if (attempt.is_correct) stats.correct += 1;
    if (!stats.last || attempt.created_at > stats.last) stats.last = attempt.created_at;
    const day = Math.floor((today.getTime() - new Date(attempt.created_at).setUTCHours(0, 0, 0, 0)) / DAY_MS);
    if (day >= 0 && day <= 6) stats.days[6 - day] += 1;
    byUser.set(attempt.user_id, stats);
  }

  return {
    users: (rows ?? []).map(row => {
      const stats = byUser.get(row.id) ?? { total: 0, correct: 0, last: null, days: [0, 0, 0, 0, 0, 0, 0] };
      return {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        tier: row.tier,
        createdAt: row.created_at,
        subscriptionStatus: row.subscription_status,
        lastActiveAt: stats.last,
        attempts7d: stats.days.reduce((sum, value) => sum + value, 0),
        totalAttempts: stats.total,
        correctAttempts: stats.correct,
        accuracy: accuracy(stats.correct, stats.total),
        dailyActivity: stats.days,
      };
    }),
    total: count ?? 0,
    error: false,
  };
}

export async function getAdminUserNotes(
  userId: string,
  client: AdminClient = createAdminClient()
): Promise<AdminUserNote[]> {
  const { data: noteRows, error } = await client
    .from('admin_user_notes')
    .select('id, body, created_at, author_user_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const authorIds = Array.from(
    new Set((noteRows ?? []).map(note => note.author_user_id).filter((id): id is string => Boolean(id)))
  );
  const { data: authors, error: authorError } = authorIds.length
    ? await client.from('users').select('id, full_name, email').in('id', authorIds)
    : { data: [], error: null };
  if (authorError) throw authorError;
  const authorById = new Map((authors ?? []).map(author => [author.id, author]));

  return (noteRows ?? []).map(note => {
    const author = note.author_user_id ? authorById.get(note.author_user_id) : null;
    return {
      id: note.id,
      body: note.body,
      createdAt: note.created_at,
      authorUserId: note.author_user_id,
      authorName: author?.full_name ?? null,
      authorEmail: author?.email ?? null,
    };
  });
}

export async function getAdminUserDetail(
  userId: string,
  client: AdminClient = createAdminClient()
): Promise<AdminUserDetail | null> {
  const { data: user, error: userError } = await client
    .from('users')
    .select(
      'id, email, full_name, role, tier, timezone, target_sat_score, exam_date, marketing_opt_in, total_xp, current_streak, longest_streak, stripe_customer_id, subscription_status, current_period_end, created_at'
    )
    .eq('id', userId)
    .maybeSingle();
  if (userError) throw userError;
  if (!user) return null;

  const [subscriptionResult, attemptsResult, totalResult, correctResult, certificatesResult, notesResult] =
    await Promise.all([
      client
        .from('subscriptions')
        .select('provider, status, tier, current_period_end, cancel_at_period_end, stripe_customer_id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from('attempts')
        .select('id, question_id, is_correct, context, created_at, questions(question_text, source_ref)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      client.from('attempts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      client
        .from('attempts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_correct', true),
      client
        .from('certificates')
        .select('id, tier, awarded_at, pdf_url')
        .eq('user_id', userId)
        .order('awarded_at', { ascending: false })
        .limit(50),
      getAdminUserNotes(userId, client).catch(error => {
        console.error('[admin-users] notes unavailable', error);
        return [];
      }),
    ]);

  const queryError =
    subscriptionResult.error ??
    attemptsResult.error ??
    totalResult.error ??
    correctResult.error ??
    certificatesResult.error;
  if (queryError) throw queryError;

  const subscription = subscriptionResult.data;
  const totalAttempts = totalResult.count ?? 0;
  const correctAttempts = correctResult.count ?? 0;
  const recentAttempts = (attemptsResult.data ?? []).map(item => {
    const question = Array.isArray(item.questions) ? item.questions[0] : item.questions;
    return {
      id: item.id,
      questionId: item.question_id,
      questionPreview: question?.question_text?.slice(0, 120) ?? 'Question',
      sourceRef: question?.source_ref ?? null,
      isCorrect: item.is_correct,
      context: item.context,
      createdAt: item.created_at,
    };
  });

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    tier: user.tier,
    timezone: user.timezone,
    targetSatScore: user.target_sat_score,
    examDate: user.exam_date,
    marketingOptIn: user.marketing_opt_in,
    totalXp: user.total_xp,
    currentStreak: user.current_streak,
    longestStreak: user.longest_streak,
    createdAt: user.created_at,
    billing: {
      provider: subscription?.provider ?? (user.stripe_customer_id ? 'stripe' : null),
      status: (subscription?.status ?? user.subscription_status) as AdminSubscriptionStatus | null,
      tier: subscription?.tier ?? user.tier,
      currentPeriodEnd: subscription?.current_period_end ?? user.current_period_end,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
      stripeCustomerId: subscription?.stripe_customer_id ?? user.stripe_customer_id,
    },
    totalAttempts,
    correctAttempts,
    accuracy: accuracy(correctAttempts, totalAttempts),
    lastActiveAt: recentAttempts[0]?.createdAt ?? null,
    recentAttempts,
    certificates: (certificatesResult.data ?? []).map(certificate => ({
      id: certificate.id,
      tier: certificate.tier,
      awardedAt: certificate.awarded_at,
      pdfUrl: certificate.pdf_url,
    })),
    notes: notesResult,
  };
}

export async function getUsersExportRows(
  filters: UsersFilters,
  client: AdminClient = createAdminClient()
): Promise<{ rows: UserDirectoryRow[]; total: number }> {
  const { data, error } = await client.rpc('admin_users_directory', {
    p_search: filters.q || null,
    p_role: filters.role || null,
    p_tier: filters.tier || null,
    p_segment: filters.segment || null,
    p_sort: filters.sort,
    p_offset: 0,
    p_limit: USERS_EXPORT_LIMIT,
  });
  if (error) throw error;
  return {
    rows: (data ?? []).map(mapDirectoryRow),
    total: data && data.length > 0 ? asCount(data[0].filtered_total) : 0,
  };
}
