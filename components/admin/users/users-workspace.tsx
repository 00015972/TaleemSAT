'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiActivity,
  FiArrowUpRight,
  FiCreditCard,
  FiDownload,
  FiShield,
  FiUsers,
} from 'react-icons/fi';
import {
  hasActiveUsersFilters,
  usersFiltersToSearchParams,
} from '@/lib/admin/users.params';
import type {
  AdminUserDetail,
  UserDirectoryRow,
  UsersFilters,
  UsersPagePayload,
  UsersSegment,
} from '@/lib/admin/users.types';
import { UserCommandDrawer } from './user-command-drawer';
import { UserDirectory, LiveSignals } from './user-directory';
import { UsersFiltersBar } from './users-filters';
import { UserMetricCard } from './user-metric-card';

const EMPTY_FILTERS: UsersFilters = {
  q: '',
  role: '',
  tier: '',
  segment: '',
  sort: 'newest',
  page: 1,
};

export function UsersWorkspace({
  payload,
  currentUserId,
}: {
  payload: UsersPagePayload;
  currentUserId: string;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(payload.filters);
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<UserDirectoryRow | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const detailCache = useRef(new Map<string, AdminUserDetail>());
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const navigate = useCallback((next: UsersFilters, includePage = false) => {
    const params = usersFiltersToSearchParams(next, { includePage });
    const query = params.toString();
    startTransition(() => router.push(query ? `/admin/users?${query}` : '/admin/users'));
  }, [router]);

  useEffect(() => {
    if (local.q === payload.filters.q) return;
    const timer = window.setTimeout(() => navigate({ ...local, page: 1 }), 380);
    return () => window.clearTimeout(timer);
  }, [local, navigate, payload.filters.q]);

  useEffect(() => {
    if (!selected) return;
    const cached = detailCache.current.get(selected.id);
    if (cached && retryVersion === 0) {
      setDetail(cached);
      setDetailError(false);
      setDetailLoading(false);
      return;
    }

    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(false);
    setDetail(null);
    fetch(`/api/admin/users/${selected.id}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('DETAIL_FAILED');
        const result = await response.json();
        const next = result.user as AdminUserDetail;
        detailCache.current.set(selected.id, next);
        setDetail(next);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setDetailError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selected, retryVersion]);

  function patchFilters(patch: Partial<UsersFilters>) {
    const next = { ...local, ...patch, page: 1 };
    setLocal(next);
    navigate(next);
  }

  function resetFilters() {
    setLocal(EMPTY_FILTERS);
    navigate(EMPTY_FILTERS);
  }

  function selectSignal(segment: UsersSegment) {
    patchFilters({ segment });
  }

  function openUser(user: UserDirectoryRow, trigger: HTMLButtonElement) {
    openerRef.current = trigger;
    setRetryVersion(0);
    setSelected(user);
  }

  const closeDrawer = useCallback(() => {
    setSelected(null);
    setDetail(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  function updateDetail(next: AdminUserDetail) {
    detailCache.current.set(next.id, next);
    setDetail(next);
    setSelected(current => current && current.id === next.id ? { ...current, role: next.role, tier: next.tier } : current);
  }

  const activeCount = [
    local.q,
    local.role,
    local.tier,
    local.segment,
    local.sort === 'newest' ? '' : local.sort,
  ].filter(Boolean).length;
  const exportParams = usersFiltersToSearchParams(local).toString();
  const summary = payload.summary;

  return (
    <section className="users-pulse">
      <div className="users-pulse-atmosphere" aria-hidden="true">
        <span /><span /><span />
      </div>

      <header className="users-pulse-header users-pulse-enter">
        <div>
          <div className="users-pulse-eyebrow"><span className="users-pulse-live-dot" aria-hidden="true" /> User pulse · live</div>
          <h1>People, <em>in motion.</em></h1>
          <p>See who is thriving, who needs help, and act without losing context.</p>
        </div>
        <a className="users-pulse-export" href={`/api/admin/users/export${exportParams ? `?${exportParams}` : ''}`}>
          <FiDownload aria-hidden="true" /> Export users <FiArrowUpRight aria-hidden="true" />
        </a>
      </header>

      <div className="users-pulse-metrics" aria-label="User workspace overview">
        <UserMetricCard
          icon={FiUsers}
          label="Total learners"
          value={summary?.totalUsers ?? null}
          detail={<><strong>{payload.total.toLocaleString('en-US')}</strong> in this view</>}
          tone="primary"
          delay={0.05}
        />
        <UserMetricCard
          icon={FiCreditCard}
          label="Paid access"
          value={summary?.paidAccess ?? null}
          detail={summary && summary.totalUsers > 0 ? <><strong>{Math.round((summary.paidAccess / summary.totalUsers) * 100)}%</strong> of learners</> : 'No paid accounts yet'}
          tone="gold"
          delay={0.1}
        />
        <UserMetricCard
          icon={FiActivity}
          label="Weekly active"
          value={summary?.weeklyActive ?? null}
          detail="Practice activity in seven days"
          tone="green"
          delay={0.15}
        />
        <UserMetricCard
          icon={FiShield}
          label="Workspace health"
          value={summary?.workspaceHealth ?? null}
          suffix="%"
          detail={summary ? <><strong>{summary.needsAttention}</strong> need attention</> : 'Live summary unavailable'}
          tone="health"
          delay={0.2}
        />
      </div>

      {payload.summaryError && (
        <p className="users-pulse-summary-warning" role="status">Live workspace metrics are temporarily unavailable. Directory controls remain active.</p>
      )}

      <UsersFiltersBar
        filters={local}
        activeCount={activeCount}
        pending={isPending}
        onSearchChange={value => setLocal(current => ({ ...current, q: value, page: 1 }))}
        onPatch={patchFilters}
        onReset={resetFilters}
      />

      <div className="users-pulse-grid">
        <UserDirectory
          users={payload.users}
          total={payload.total}
          page={payload.filters.page}
          totalPages={payload.totalPages}
          selectedId={selected?.id ?? null}
          pending={isPending}
          error={payload.directoryError}
          hasFilters={hasActiveUsersFilters(payload.filters)}
          onOpen={openUser}
          onPage={page => {
            const next = { ...local, page };
            setLocal(next);
            navigate(next, true);
          }}
          onClear={resetFilters}
          onRetry={() => router.refresh()}
        />
        <LiveSignals summary={summary} activeSegment={local.segment} onSelect={selectSignal} />
      </div>

      {selected && (
        <UserCommandDrawer
          key={selected.id}
          user={selected}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          currentUserId={currentUserId}
          onClose={closeDrawer}
          onRetry={() => setRetryVersion(value => value + 1)}
          onDetailChange={updateDetail}
          onRefresh={() => router.refresh()}
        />
      )}
    </section>
  );
}
