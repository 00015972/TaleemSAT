'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type UserRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: 'student' | 'admin';
  tier: 'free' | 'pro' | 'elite';
  points: number;
  streakDays: number;
  createdAt: string;
};

type Filters = {
  q: string;
  role: string;
  tier: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  CANNOT_CHANGE_OWN_ROLE: "You can't change your own role.",
  LAST_ADMIN: "Can't demote the last admin — promote someone else first.",
  INVALID_ROLE: 'Invalid role.',
  INVALID_TIER: 'Invalid tier.',
  USER_NOT_FOUND: 'That user no longer exists.',
  UPDATE_FAILED: 'Could not update the user. Try again.',
};

export function UsersTable({
  users,
  total,
  page,
  totalPages,
  currentUserId,
  filters,
}: {
  users: UserRow[];
  total: number;
  page: number;
  totalPages: number;
  currentUserId: string;
  filters: Filters;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<Filters>(filters);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function applyFilters(next: Filters) {
    const params = new URLSearchParams();
    if (next.q) params.set('q', next.q);
    if (next.role) params.set('role', next.role);
    if (next.tier) params.set('tier', next.tier);
    router.push(`/admin/users?${params.toString()}`);
  }

  function setFilter(patch: Partial<Filters>) {
    const next = { ...local, ...patch };
    setLocal(next);
    if (!('q' in patch)) applyFilters(next); // selects apply immediately
  }

  function gotoPage(p: number) {
    const params = new URLSearchParams();
    if (local.q) params.set('q', local.q);
    if (local.role) params.set('role', local.role);
    if (local.tier) params.set('tier', local.tier);
    params.set('page', String(p));
    router.push(`/admin/users?${params.toString()}`);
  }

  async function save(id: string, patch: { role?: string; tier?: string }) {
    setSavingId(id);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(ERROR_MESSAGES[data?.error] ?? 'Could not update the user.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSavingId(null);
      router.refresh(); // resync selects to server state (also reverts on failure)
    }
  }

  function changeRole(u: UserRow, role: string) {
    if (role === u.role) return;
    const label = u.fullName || u.email;
    const ok = window.confirm(
      role === 'admin'
        ? `Grant ADMIN access to ${label}? They'll be able to manage all content and users.`
        : `Remove admin access from ${label}?`
    );
    if (!ok) return;
    save(u.id, { role });
  }

  return (
    <div>
      {/* Header */}
      <div className="adm-head mb-5">
        <h1>Users</h1>
        <p>{total.toLocaleString('en-US')} accounts</p>
      </div>

      {/* Filter toolbar */}
      <div className="adm-toolbar">
        <FilterSelect
          label="Role"
          value={local.role}
          onChange={v => setFilter({ role: v })}
          options={[
            { value: 'student', label: 'Student' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
        <FilterSelect
          label="Tier"
          value={local.tier}
          onChange={v => setFilter({ tier: v })}
          options={[
            { value: 'free', label: 'Free' },
            { value: 'pro', label: 'Pro' },
            { value: 'elite', label: 'Elite' },
          ]}
        />
        <div className="adm-filter flex-1 min-w-[180px]">
          <span>Search</span>
          <input
            className="form-input"
            value={local.q}
            placeholder="Search name or email…"
            onChange={e => setLocal({ ...local, q: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter') applyFilters(local);
            }}
          />
        </div>
      </div>

      {error && <div className="adm-alert err">{error}</div>}

      {/* Table */}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Tier</th>
              <th className="hidden md:table-cell text-right">Points</th>
              <th className="hidden md:table-cell text-right">Streak</th>
              <th className="hidden lg:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted text-sm">
                  No users match these filters.
                </td>
              </tr>
            ) : (
              users.map(u => {
                const isSelf = u.id === currentUserId;
                const saving = savingId === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-txt font-medium">
                          {u.fullName || '—'}
                          {isSelf && (
                            <span className="ml-2 text-xs text-muted font-normal">
                              (you)
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted">{u.email}</span>
                      </div>
                    </td>
                    <td>
                      <select
                        className="form-input"
                        style={{ minWidth: 110, padding: '0.3rem 0.5rem' }}
                        value={u.role}
                        disabled={isSelf || saving}
                        title={isSelf ? "You can't change your own role" : undefined}
                        onChange={e => changeRole(u, e.target.value)}
                      >
                        <option value="student">Student</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-input"
                        style={{ minWidth: 100, padding: '0.3rem 0.5rem' }}
                        value={u.tier}
                        disabled={saving}
                        onChange={e => save(u.id, { tier: e.target.value })}
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="elite">Elite</option>
                      </select>
                    </td>
                    <td
                      className="hidden md:table-cell text-right"
                      style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}
                    >
                      {u.points}
                    </td>
                    <td
                      className="hidden md:table-cell text-right"
                      style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}
                    >
                      {u.streakDays > 0 ? (
                        <span style={{ color: 'var(--green)' }}>{u.streakDays}d</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell text-muted">
                      {formatDate(u.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="adm-pager">
          <button
            onClick={() => gotoPage(page - 1)}
            disabled={page <= 1}
            className="adm-btn secondary"
          >
            ← Prev
          </button>
          <span className="where">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => gotoPage(page + 1)}
            disabled={page >= totalPages}
            className="adm-btn secondary"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="adm-filter">
      <span>{label}</span>
      <select
        className="form-input"
        style={{ minWidth: 130 }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
