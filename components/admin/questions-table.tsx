'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export type QuestionRow = {
  id: string;
  preview: string;
  subjectName: string;
  categoryName: string;
  difficulty: string;
  status: string;
  createdAt: string;
};

export type FilterOption = { value: string; label: string };
export type CategoryFilterOption = FilterOption & { subjectId: string };

type Filters = {
  subject: string;
  category: string;
  difficulty: string;
  status: string;
  q: string;
};

export function QuestionsTable({
  questions,
  subjects,
  categories,
  total,
  page,
  totalPages,
  filters,
}: {
  questions: QuestionRow[];
  subjects: FilterOption[];
  categories: CategoryFilterOption[];
  total: number;
  page: number;
  totalPages: number;
  filters: Filters;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [local, setLocal] = useState<Filters>(filters);
  const [working, setWorking] = useState(false);

  const visibleCategories = local.subject
    ? categories.filter(c => c.subjectId === local.subject)
    : categories;

  function applyFilters(next: Filters) {
    const params = new URLSearchParams();
    if (next.subject) params.set('subject', next.subject);
    if (next.category) params.set('category', next.category);
    if (next.difficulty) params.set('difficulty', next.difficulty);
    if (next.status) params.set('status', next.status);
    if (next.q) params.set('q', next.q);
    router.push(`/admin/questions?${params.toString()}`);
  }

  function setFilter(patch: Partial<Filters>) {
    const next = { ...local, ...patch };
    // Reset category when subject changes.
    if (patch.subject !== undefined) next.category = '';
    setLocal(next);
    if (!('q' in patch)) applyFilters(next); // selects apply immediately
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === questions.length ? new Set() : new Set(questions.map(q => q.id))
    );
  }

  async function bulk(action: 'publish' | 'archive') {
    if (selected.size === 0) return;
    setWorking(true);
    try {
      const res = await fetch('/api/admin/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setWorking(false);
    }
  }

  function gotoPage(p: number) {
    const params = new URLSearchParams();
    if (local.subject) params.set('subject', local.subject);
    if (local.category) params.set('category', local.category);
    if (local.difficulty) params.set('difficulty', local.difficulty);
    if (local.status) params.set('status', local.status);
    if (local.q) params.set('q', local.q);
    params.set('page', String(p));
    router.push(`/admin/questions?${params.toString()}`);
  }

  const allSelected = questions.length > 0 && selected.size === questions.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div className="adm-head" style={{ marginBottom: 0 }}>
          <h1>Questions</h1>
          <p>{total.toLocaleString('en-US')} in the bank</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/questions/import" className="adm-btn secondary">
            Import CSV
          </Link>
          <Link href="/admin/questions/new" className="adm-btn">
            New question
          </Link>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="adm-toolbar">
        <FilterSelect
          label="Subject"
          value={local.subject}
          onChange={v => setFilter({ subject: v })}
          options={subjects}
        />
        <FilterSelect
          label="Category"
          value={local.category}
          onChange={v => setFilter({ category: v })}
          options={visibleCategories}
        />
        <FilterSelect
          label="Difficulty"
          value={local.difficulty}
          onChange={v => setFilter({ difficulty: v })}
          options={[
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Medium' },
            { value: 'hard', label: 'Hard' },
          ]}
        />
        <FilterSelect
          label="Status"
          value={local.status}
          onChange={v => setFilter({ status: v })}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'published', label: 'Published' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
        <div className="adm-filter flex-1 min-w-[180px]">
          <span>Search</span>
          <input
            className="form-input"
            value={local.q}
            placeholder="Search question text…"
            onChange={e => setLocal({ ...local, q: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter') applyFilters(local);
            }}
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded mb-3"
          style={{
            background: 'color-mix(in srgb, var(--green) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)',
          }}
        >
          <span
            className="text-xs font-semibold"
            style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}
          >
            {selected.size} selected
          </span>
          <button onClick={() => bulk('publish')} disabled={working} className="adm-btn">
            Publish
          </button>
          <button
            onClick={() => bulk('archive')}
            disabled={working}
            className="adm-btn secondary"
          >
            Archive
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-muted ml-auto hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th className="w-10">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th>Question</th>
              <th className="hidden md:table-cell">Subject</th>
              <th className="hidden lg:table-cell">Category</th>
              <th>Difficulty</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted text-sm">
                  No questions match these filters.
                </td>
              </tr>
            ) : (
              questions.map(q => (
                <tr key={q.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(q.id)}
                      onChange={() => toggle(q.id)}
                    />
                  </td>
                  <td>
                    <Link
                      href={`/admin/questions/${q.id}/edit`}
                      className="q-preview hover:underline"
                    >
                      {q.preview}
                      {q.preview.length >= 80 ? '…' : ''}
                    </Link>
                  </td>
                  <td className="hidden md:table-cell text-muted">{q.subjectName}</td>
                  <td className="hidden lg:table-cell text-muted">{q.categoryName}</td>
                  <td>
                    <DifficultyPill difficulty={q.difficulty} />
                  </td>
                  <td>
                    <StatusPill status={q.status} />
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/admin/questions/${q.id}/edit`}
                      className="text-sm font-medium hover:underline"
                      style={{ color: 'var(--green)' }}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
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

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    published: 'var(--ok)',
    draft: 'var(--gold-d)',
    archived: 'var(--muted)',
  };
  const color = colors[status] ?? 'var(--muted)';
  return (
    <span
      className="adm-pill"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {status}
    </span>
  );
}

function DifficultyPill({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    easy: 'var(--ok)',
    medium: 'var(--gold-d)',
    hard: 'var(--err)',
  };
  const color = colors[difficulty] ?? 'var(--muted)';
  return (
    <span
      className="adm-pill"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {difficulty}
    </span>
  );
}
