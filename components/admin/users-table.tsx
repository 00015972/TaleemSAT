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
      <div className="mb-5">
        <h1 className="font-serif text-2xl font-bold text-txt">Users</h1>
        <p className="text-sm text-muted mt-0.5">{total} total</p>
      </div>

      {/* Filter toolbar */}
      <div
        className="flex flex-wrap items-end gap-3 p-3 rounded-l mb-4"
        style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
      >
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
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-xs font-semibold text-txt">Search</span>
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

      {error && (
        <div
          className="rounded p-3 mb-3 text-sm"
          style={{
            background: 'color-mix(in srgb, var(--err) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--err) 35%, transparent)',
            color: 'var(--txt)',
          }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-l overflow-hidden"
        style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <Th>User</Th>
              <Th>Role</Th>
              <Th>Tier</Th>
              <Th className="hidden md:table-cell text-right">Points</Th>
              <Th className="hidden md:table-cell text-right">Streak</Th>
              <Th className="hidden lg:table-cell">Joined</Th>
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
                  <tr
                    key={u.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    className="transition-colors hover:bg-surf2"
                  >
                    <Td>
                      <div className="flex flex-col">
                        <span className="text-txt font-medium">
                          {u.fullName || '—'}
                          {isSelf && (
                            <span className="ml-2 text-xs text-muted font-normal">(you)</span>
                          )}
                        </span>
                        <span className="text-xs text-muted">{u.email}</span>
                      </div>
                    </Td>
                    <Td>
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
                    </Td>
                    <Td>
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
                    </Td>
                    <Td className="hidden md:table-cell text-right text-txt-soft">
                      {u.points}
                    </Td>
                    <Td className="hidden md:table-cell text-right text-txt-soft">
                      {u.streakDays > 0 ? `${u.streakDays}🔥` : '—'}
                    </Td>
                    <Td className="hidden lg:table-cell text-muted">
                      {formatDate(u.createdAt)}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => gotoPage(page - 1)}
            disabled={page <= 1}
            className="rounded px-3 py-1.5 text-sm disabled:opacity-40"
            style={{ background: 'var(--surf2)', color: 'var(--txt)', border: '1px solid var(--border)' }}
          >
            ← Prev
          </button>
          <span className="text-sm text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => gotoPage(page + 1)}
            disabled={page >= totalPages}
            className="rounded px-3 py-1.5 text-sm disabled:opacity-40"
            style={{ background: 'var(--surf2)', color: 'var(--txt)', border: '1px solid var(--border)' }}
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
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-txt">{label}</span>
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

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left font-semibold text-xs uppercase tracking-wide px-3 py-2.5 text-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}
