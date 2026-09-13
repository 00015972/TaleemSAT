'use client';

import {
  FiRefreshCw,
  FiSearch,
  FiSliders,
  FiX,
} from 'react-icons/fi';
import type {
  AdminUserRole,
  AdminUserTier,
  UsersFilters,
  UsersSort,
} from '@/lib/admin/users.types';

export function UsersFiltersBar({
  filters,
  activeCount,
  pending,
  onSearchChange,
  onPatch,
  onReset,
}: {
  filters: UsersFilters;
  activeCount: number;
  pending: boolean;
  onSearchChange: (value: string) => void;
  onPatch: (patch: Partial<UsersFilters>) => void;
  onReset: () => void;
}) {
  return (
    <section className="users-pulse-controls users-pulse-enter" aria-label="User directory filters">
      <div className="users-pulse-controls-head">
        <div>
          <FiSliders aria-hidden="true" />
          <strong>Find and refine</strong>
          {activeCount > 0 && <span>{activeCount} active</span>}
        </div>
        <button type="button" onClick={onReset} disabled={activeCount === 0 || pending}>
          <FiRefreshCw aria-hidden="true" /> Reset
        </button>
      </div>

      <div className="users-pulse-filter-grid">
        <label className="users-pulse-search">
          <span className="sr-only">Search users</span>
          <FiSearch aria-hidden="true" />
          <input
            value={filters.q}
            maxLength={200}
            placeholder="Search name, email, or exact user ID…"
            onChange={event => onSearchChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onPatch({ q: filters.q });
              }
            }}
          />
          {filters.q && (
            <button type="button" aria-label="Clear search" onClick={() => onPatch({ q: '' })}>
              <FiX aria-hidden="true" />
            </button>
          )}
        </label>

        <SelectFilter
          label="Role"
          value={filters.role}
          onChange={value => onPatch({ role: value as '' | AdminUserRole })}
          options={[
            { value: '', label: 'All roles' },
            { value: 'student', label: 'Students' },
            { value: 'admin', label: 'Admins' },
          ]}
        />
        <SelectFilter
          label="Tier"
          value={filters.tier}
          onChange={value => onPatch({ tier: value as '' | AdminUserTier })}
          options={[
            { value: '', label: 'Any tier' },
            { value: 'free', label: 'Free' },
            { value: 'pro', label: 'Pro' },
            { value: 'elite', label: 'Elite' },
          ]}
        />
        <SelectFilter
          label="Sort"
          value={filters.sort}
          onChange={value => onPatch({ sort: value as UsersSort })}
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
            { value: 'recent-activity', label: 'Recent activity' },
            { value: 'lowest-accuracy', label: 'Lowest accuracy' },
          ]}
        />
      </div>

      {filters.segment && (
        <div className="users-pulse-segment-chip">
          Signal: <strong>{segmentLabel(filters.segment)}</strong>
          <button type="button" onClick={() => onPatch({ segment: '' })} aria-label="Clear signal filter">
            <FiX aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="users-pulse-select">
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function segmentLabel(segment: UsersFilters['segment']): string {
  return {
    '': '',
    attention: 'Needs attention',
    'renewal-risk': 'Renewals at risk',
    'inactive-paid': 'Quiet paid learners',
    'recent-upgrade': 'Recent upgrades',
  }[segment];
}
