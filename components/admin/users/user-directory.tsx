'use client';

import type { MouseEvent } from 'react';
import {
  FiAlertCircle,
  FiArrowUpRight,
  FiAward,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiInbox,
  FiRefreshCw,
  FiTrendingUp,
} from 'react-icons/fi';
import type {
  UserDirectoryRow,
  UsersFilters,
  UsersSegment,
  UsersWorkspaceSummary,
} from '@/lib/admin/users.types';

export function UserDirectory({
  users,
  total,
  page,
  totalPages,
  selectedId,
  pending,
  error,
  hasFilters,
  onOpen,
  onPage,
  onClear,
  onRetry,
}: {
  users: UserDirectoryRow[];
  total: number;
  page: number;
  totalPages: number;
  selectedId: string | null;
  pending: boolean;
  error: boolean;
  hasFilters: boolean;
  onOpen: (user: UserDirectoryRow, trigger: HTMLButtonElement) => void;
  onPage: (page: number) => void;
  onClear: () => void;
  onRetry: () => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * 50 + 1;
  const to = Math.min(total, page * 50);

  return (
    <section className={`users-pulse-directory${pending ? ' is-pending' : ''}`} aria-busy={pending}>
      <div className="users-pulse-panel-head">
        <div>
          <span className="users-pulse-panel-icon"><FiTrendingUp aria-hidden="true" /></span>
          <div>
            <h2>User directory</h2>
            <p>{total.toLocaleString('en-US')} matching account{total === 1 ? '' : 's'}</p>
          </div>
        </div>
        <span className="users-pulse-result-range">{from}–{to} of {total.toLocaleString('en-US')}</span>
      </div>

      {error ? (
        <div className="users-pulse-state">
          <span><FiAlertCircle aria-hidden="true" /></span>
          <h3>Directory signal interrupted</h3>
          <p>We could not load the current user view. Your filters are still preserved.</p>
          <button type="button" onClick={onRetry}><FiRefreshCw aria-hidden="true" /> Try again</button>
        </div>
      ) : users.length === 0 ? (
        <div className="users-pulse-state">
          <span><FiInbox aria-hidden="true" /></span>
          <h3>{hasFilters ? 'No learners match this view' : 'Your first learner will appear here'}</h3>
          <p>{hasFilters ? 'Try clearing one or more filters to widen the signal.' : 'The directory is ready when the first account is created.'}</p>
          {hasFilters && <button type="button" onClick={onClear}><FiRefreshCw aria-hidden="true" /> Clear filters</button>}
        </div>
      ) : (
        <div className="users-pulse-table-wrap">
          <table className="users-pulse-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Access</th>
                <th>7-day rhythm</th>
                <th>Accuracy</th>
                <th>Last practice</th>
                <th><span className="sr-only">Open user</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr
                  key={user.id}
                  className={selectedId === user.id ? 'is-selected' : undefined}
                  style={{ '--users-row-delay': `${Math.min(index, 8) * 0.045}s` } as React.CSSProperties}
                >
                  <td data-label="User">
                    <div className="users-pulse-identity">
                      <Avatar user={user} />
                      <div>
                        <strong>{user.fullName || 'Unnamed learner'}</strong>
                        <span>{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Access">
                    <div className="users-pulse-badges">
                      <span className={`users-pulse-badge role-${user.role}`}>{user.role}</span>
                      <span className={`users-pulse-badge tier-${user.tier}`}>{user.tier}</span>
                      {(user.subscriptionStatus === 'past_due' || user.subscriptionStatus === 'incomplete') && (
                        <span className="users-pulse-badge status-risk">Billing risk</span>
                      )}
                    </div>
                  </td>
                  <td data-label="7-day rhythm">
                    <ActivityRhythm values={user.dailyActivity} attempts={user.attempts7d} />
                  </td>
                  <td data-label="Accuracy">
                    <div className="users-pulse-accuracy">
                      <strong>{user.accuracy === null ? '—' : `${user.accuracy}%`}</strong>
                      <span>{user.totalAttempts.toLocaleString('en-US')} attempts</span>
                    </div>
                  </td>
                  <td data-label="Last practice">
                    <span className="users-pulse-last"><FiClock aria-hidden="true" />{formatDateTime(user.lastActiveAt)}</span>
                  </td>
                  <td className="users-pulse-open-cell">
                    <button
                      type="button"
                      className="users-pulse-open"
                      aria-label={`Open ${user.fullName || user.email}`}
                      onClick={(event: MouseEvent<HTMLButtonElement>) => onOpen(user, event.currentTarget)}
                    >
                      <FiChevronRight aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!error && totalPages > 1 && (
        <div className="users-pulse-pagination">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1 || pending}>
            <FiChevronLeft aria-hidden="true" /> Previous
          </button>
          <span>Page <strong>{page}</strong> of {totalPages}</span>
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages || pending}>
            Next <FiChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

export function LiveSignals({
  summary,
  activeSegment,
  onSelect,
}: {
  summary: UsersWorkspaceSummary | null;
  activeSegment: UsersFilters['segment'];
  onSelect: (segment: UsersSegment) => void;
}) {
  const signals: {
    segment: UsersSegment;
    label: string;
    count: number | null;
    copy: string;
    icon: typeof FiCreditCard;
    tone: string;
  }[] = [
    {
      segment: 'renewal-risk',
      label: 'Renewals at risk',
      count: summary?.renewalRisk ?? null,
      copy: 'Billing needs attention before access is interrupted.',
      icon: FiCreditCard,
      tone: 'gold',
    },
    {
      segment: 'inactive-paid',
      label: 'Quiet paid learners',
      count: summary?.inactivePaid ?? null,
      copy: 'No practice signal for at least fourteen days.',
      icon: FiClock,
      tone: 'green',
    },
    {
      segment: 'recent-upgrade',
      label: 'Recent upgrades',
      count: summary?.recentUpgrades ?? null,
      copy: 'New Pro and Elite learners in the last seven days.',
      icon: FiAward,
      tone: 'bright',
    },
  ];

  return (
    <aside className="users-pulse-signals users-pulse-enter" aria-label="Live user signals">
      <div className="users-pulse-panel-head compact">
        <div>
          <span className="users-pulse-live-dot" aria-hidden="true" />
          <div><h2>Live signals</h2><p>Actionable segments</p></div>
        </div>
      </div>
      <div className="users-pulse-signal-list">
        {signals.map(signal => {
          const Icon = signal.icon;
          const active = activeSegment === signal.segment;
          return (
            <button
              key={signal.segment}
              type="button"
              className={`users-pulse-signal ${signal.tone}${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onSelect(active ? '' : signal.segment)}
            >
              <span className="users-pulse-signal-top">
                <i><Icon aria-hidden="true" /></i>
                <strong>{signal.count === null ? '—' : signal.count.toLocaleString('en-US')}</strong>
              </span>
              <b>{signal.label}</b>
              <small>{signal.copy}</small>
              <span className="users-pulse-signal-link">Filter directory <FiArrowUpRight aria-hidden="true" /></span>
            </button>
          );
        })}
      </div>
      <div className="users-pulse-signal-note">
        <span><FiTrendingUp aria-hidden="true" /></span>
        <p><strong>Health is a prompt, not a verdict.</strong> Open a learner to see the evidence behind the signal.</p>
      </div>
    </aside>
  );
}

function Avatar({ user }: { user: UserDirectoryRow }) {
  const source = user.fullName || user.email;
  const initials = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return <span className={`users-pulse-avatar tier-${user.tier}`}>{initials || 'U'}</span>;
}

function ActivityRhythm({ values, attempts }: { values: number[]; attempts: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="users-pulse-rhythm" aria-label={`${attempts} attempts in the last seven days`}>
      <div aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => {
          const value = values[index] ?? 0;
          const height = value === 0 ? 12 : Math.max(24, Math.round((value / max) * 100));
          return <i key={index} style={{ '--activity-height': `${height}%` } as React.CSSProperties} />;
        })}
      </div>
      <span>{attempts} this week</span>
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return 'No practice yet';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}
