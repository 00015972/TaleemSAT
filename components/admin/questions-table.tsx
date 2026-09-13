'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiActivity,
  FiArchive,
  FiArrowUpRight,
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFilter,
  FiInbox,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSliders,
  FiTrash2,
  FiX,
} from 'react-icons/fi';

export type QuestionRow = {
  id: string;
  sourceRef: string | null;
  preview: string;
  subjectName: string;
  categoryName: string;
  difficulty: string;
  status: string;
  createdAt: string;
};

export type FilterOption = { value: string; label: string };
export type CategoryFilterOption = FilterOption & { subjectId: string };
export type TopicFilterOption = FilterOption & { categoryId: string };

type Filters = {
  subject: string;
  category: string;
  topic: string;
  difficulty: string;
  status: string;
  q: string;
};

type Inventory = {
  total: number;
  published: number;
  draft: number;
  archived: number;
};

const EMPTY_FILTERS: Filters = {
  subject: '',
  category: '',
  topic: '',
  difficulty: '',
  status: '',
  q: '',
};

export function QuestionsTable({
  questions,
  subjects,
  categories,
  topics,
  total,
  page,
  totalPages,
  inventory,
  filters,
}: {
  questions: QuestionRow[];
  subjects: FilterOption[];
  categories: CategoryFilterOption[];
  topics: TopicFilterOption[];
  total: number;
  page: number;
  totalPages: number;
  inventory: Inventory;
  filters: Filters;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [local, setLocal] = useState<Filters>(filters);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'err'; text: string } | null>(null);

  const visibleCategories = local.subject
    ? categories.filter(category => category.subjectId === local.subject)
    : categories;
  const visibleTopics = local.category
    ? topics.filter(topic => topic.categoryId === local.category)
    : topics;
  const activeFilterCount = Object.values(local).filter(Boolean).length;

  function paramsFor(next: Filters) {
    const params = new URLSearchParams();
    if (next.subject) params.set('subject', next.subject);
    if (next.category) params.set('category', next.category);
    if (next.topic) params.set('topic', next.topic);
    if (next.difficulty) params.set('difficulty', next.difficulty);
    if (next.status) params.set('status', next.status);
    if (next.q) params.set('q', next.q);
    return params;
  }

  function applyFilters(next: Filters) {
    const params = paramsFor(next);
    const query = params.toString();
    router.push(query ? `/admin/questions?${query}` : '/admin/questions');
  }

  function setFilter(patch: Partial<Filters>) {
    const next = { ...local, ...patch };
    if (patch.subject !== undefined) next.category = '';
    if (patch.subject !== undefined || patch.category !== undefined) next.topic = '';
    setLocal(next);
    if (!('q' in patch)) applyFilters(next);
  }

  function resetFilters() {
    setLocal(EMPTY_FILTERS);
    setSelected(new Set());
    setMessage(null);
    applyFilters(EMPTY_FILTERS);
  }

  function toggle(id: string) {
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(previous =>
      previous.size === questions.length ? new Set() : new Set(questions.map(question => question.id))
    );
  }

  async function bulk(action: 'publish' | 'archive') {
    if (selected.size === 0) return;
    setWorking(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ kind: 'err', text: data?.detail ?? `Could not ${action} those questions.` });
        return;
      }
      setMessage({
        kind: 'info',
        text: `${selected.size} question${selected.size === 1 ? '' : 's'} ${action === 'publish' ? 'published' : 'archived'}.`,
      });
      setSelected(new Set());
      router.refresh();
    } catch {
      setMessage({ kind: 'err', text: 'The operation could not be completed. Please try again.' });
    } finally {
      setWorking(false);
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    const count = selected.size;
    const confirmed = window.confirm(
      `Permanently delete ${count} question${count === 1 ? '' : 's'}? This cannot be undone. ` +
        `Questions used in an exam or already attempted by students will be skipped — archive those instead.`
    );
    if (!confirmed) return;

    setWorking(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action: 'delete' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ kind: 'err', text: data?.detail ?? 'Could not delete those questions.' });
        return;
      }
      const skipped = (data.skipped ?? []) as { id: string; reason: string }[];
      setMessage({
        kind: skipped.length > 0 ? 'err' : 'info',
        text:
          `Deleted ${data.deleted} question${data.deleted === 1 ? '' : 's'}.` +
          (skipped.length > 0 ? ` ${skipped.length} skipped: ${skipped[0].reason}` : ''),
      });
      setSelected(new Set());
      router.refresh();
    } catch {
      setMessage({ kind: 'err', text: 'The delete request could not be completed. Please try again.' });
    } finally {
      setWorking(false);
    }
  }

  function gotoPage(nextPage: number) {
    const params = paramsFor(local);
    params.set('page', String(nextPage));
    router.push(`/admin/questions?${params.toString()}`);
  }

  const allSelected = questions.length > 0 && selected.size === questions.length;

  return (
    <section className="questions-cockpit">
      <div className="questions-cockpit-ambient" aria-hidden="true" />

      <header className="questions-cockpit-header questions-cockpit-enter">
        <div>
          <div className="questions-cockpit-eyebrow">
            <span className="questions-cockpit-live-dot" aria-hidden="true" />
            Live content operations
          </div>
          <h1>Questions</h1>
          <p>
            High-density control for <strong>{inventory.total.toLocaleString('en-US')}</strong> question records.
          </p>
        </div>
        <Link href="/admin/questions/new" className="questions-cockpit-create">
          <FiPlus aria-hidden="true" />
          Create question
        </Link>
      </header>

      <div className="questions-cockpit-metrics" aria-label="Question inventory overview">
        <MetricCard
          icon={<FiBookOpen aria-hidden="true" />}
          label="Total inventory"
          value={inventory.total}
          detail={`${subjects.length} subject${subjects.length === 1 ? '' : 's'} in the library`}
          tone="primary"
          delay={0.08}
        />
        <MetricCard
          icon={<FiCheckCircle aria-hidden="true" />}
          label="Published"
          value={inventory.published}
          detail={inventory.total > 0 ? `${Math.round((inventory.published / inventory.total) * 100)}% currently live` : 'No questions yet'}
          tone="green"
          delay={0.13}
        />
        <MetricCard
          icon={<FiClock aria-hidden="true" />}
          label="Draft queue"
          value={inventory.draft}
          detail="Waiting for publication"
          tone="gold"
          delay={0.18}
        />
        <MetricCard
          icon={<FiArchive aria-hidden="true" />}
          label="Archived"
          value={inventory.archived}
          detail="Retained outside the live bank"
          tone="muted"
          delay={0.23}
        />
      </div>

      <div className="questions-cockpit-controls questions-cockpit-enter">
        <div className="questions-cockpit-control-head">
          <div>
            <FiSliders aria-hidden="true" />
            <span>Find and refine</span>
            {activeFilterCount > 0 && (
              <span className="questions-cockpit-filter-count">{activeFilterCount} active</span>
            )}
          </div>
          <button
            type="button"
            onClick={resetFilters}
            disabled={activeFilterCount === 0}
            className="questions-cockpit-reset"
          >
            <FiRefreshCw aria-hidden="true" />
            Reset
          </button>
        </div>

        <div className="questions-cockpit-filter-row">
          <div className="questions-cockpit-search">
            <FiSearch aria-hidden="true" />
            <label htmlFor="questions-search" className="sr-only">Search questions</label>
            <input
              id="questions-search"
              value={local.q}
              placeholder="Search question text or source ID…"
              onChange={event => setLocal({ ...local, q: event.target.value })}
              onKeyDown={event => {
                if (event.key === 'Enter') applyFilters(local);
              }}
            />
            <button type="button" onClick={() => applyFilters(local)} aria-label="Apply search">
              Search
            </button>
          </div>
          <FilterSelect
            label="Subject"
            value={local.subject}
            onChange={value => setFilter({ subject: value })}
            options={subjects}
          />
          <FilterSelect
            label="Category"
            value={local.category}
            onChange={value => setFilter({ category: value })}
            options={visibleCategories}
          />
          <FilterSelect
            label="Skill"
            value={local.topic}
            onChange={value => setFilter({ topic: value })}
            options={visibleTopics}
          />
          <FilterSelect
            label="Difficulty"
            value={local.difficulty}
            onChange={value => setFilter({ difficulty: value })}
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
          />
          <FilterSelect
            label="Status"
            value={local.status}
            onChange={value => setFilter({ status: value })}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="questions-cockpit-bulk" role="region" aria-label="Bulk question actions">
          <div className="questions-cockpit-bulk-count">
            <span><FiCheck aria-hidden="true" /></span>
            <strong>{selected.size}</strong> selected
          </div>
          <div className="questions-cockpit-bulk-actions">
            <button type="button" onClick={() => bulk('publish')} disabled={working}>
              <FiCheckCircle aria-hidden="true" /> Publish
            </button>
            <button type="button" onClick={() => bulk('archive')} disabled={working}>
              <FiArchive aria-hidden="true" /> Archive
            </button>
            <button type="button" onClick={bulkDelete} disabled={working} className="danger">
              <FiTrash2 aria-hidden="true" /> Delete
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="questions-cockpit-bulk-clear"
            aria-label="Clear question selection"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
      )}

      {message && (
        <div
          className={`questions-cockpit-alert ${message.kind}`}
          role={message.kind === 'err' ? 'alert' : 'status'}
        >
          {message.kind === 'err' ? <FiActivity aria-hidden="true" /> : <FiCheckCircle aria-hidden="true" />}
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message">
            <FiX aria-hidden="true" />
          </button>
        </div>
      )}

      <section className="questions-cockpit-ledger questions-cockpit-enter" aria-labelledby="question-ledger-title">
        <div className="questions-cockpit-ledger-head">
          <div>
            <span className="questions-cockpit-ledger-icon"><FiFilter aria-hidden="true" /></span>
            <div>
              <h2 id="question-ledger-title">Question ledger</h2>
              <p>{total.toLocaleString('en-US')} {total === 1 ? 'record' : 'records'} match this view</p>
            </div>
          </div>
          <span className="questions-cockpit-sync">
            <span aria-hidden="true" /> Synchronized
          </span>
        </div>

        <div className="questions-cockpit-table-wrap">
          <table className="questions-cockpit-table">
            <thead>
              <tr>
                <th className="questions-cockpit-check-cell">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all questions on this page"
                  />
                </th>
                <th>Source ID</th>
                <th>Question / classification</th>
                <th>Subject</th>
                <th>Difficulty</th>
                <th>Status</th>
                <th><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {questions.length === 0 ? (
                <tr className="questions-cockpit-empty-row">
                  <td colSpan={7}>
                    <div className="questions-cockpit-empty">
                      <span><FiInbox aria-hidden="true" /></span>
                      <h3>{activeFilterCount > 0 ? 'No matching questions' : 'The question bank is empty'}</h3>
                      <p>
                        {activeFilterCount > 0
                          ? 'Try broadening your filters or clearing the current search.'
                          : 'Create the first question to start building the content library.'}
                      </p>
                      {activeFilterCount > 0 ? (
                        <button type="button" onClick={resetFilters}><FiRefreshCw aria-hidden="true" /> Clear filters</button>
                      ) : (
                        <Link href="/admin/questions/new"><FiPlus aria-hidden="true" /> Create question</Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                questions.map((question, index) => (
                  <tr
                    key={question.id}
                    className={selected.has(question.id) ? 'is-selected' : ''}
                    style={{ animationDelay: `${0.25 + Math.min(index, 10) * 0.025}s` }}
                  >
                    <td className="questions-cockpit-check-cell" data-label="Select">
                      <input
                        type="checkbox"
                        checked={selected.has(question.id)}
                        onChange={() => toggle(question.id)}
                        aria-label={`Select question ${question.sourceRef ?? question.id}`}
                      />
                    </td>
                    <td data-label="Source ID">
                      <code className="questions-cockpit-source">{question.sourceRef ?? '—'}</code>
                    </td>
                    <td className="questions-cockpit-question-cell" data-label="Question">
                      <Link href={`/admin/questions/${question.id}/edit`}>
                        {question.preview}{question.preview.length >= 80 ? '…' : ''}
                      </Link>
                      <span>{question.categoryName}</span>
                    </td>
                    <td data-label="Subject"><span className="questions-cockpit-subject">{question.subjectName}</span></td>
                    <td data-label="Difficulty"><DifficultyPill difficulty={question.difficulty} /></td>
                    <td data-label="Status"><StatusPill status={question.status} /></td>
                    <td className="questions-cockpit-row-action">
                      <Link
                        href={`/admin/questions/${question.id}/edit`}
                        aria-label={`Edit question ${question.sourceRef ?? question.id}`}
                        title="Edit question"
                      >
                        <FiArrowUpRight aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {totalPages > 1 && (
        <nav className="questions-cockpit-pager questions-cockpit-enter" aria-label="Question pages">
          <button type="button" onClick={() => gotoPage(page - 1)} disabled={page <= 1}>
            <FiChevronLeft aria-hidden="true" /> Previous
          </button>
          <div>
            <span>Page</span>
            <strong>{page}</strong>
            <span>of {totalPages}</span>
          </div>
          <button type="button" onClick={() => gotoPage(page + 1)} disabled={page >= totalPages}>
            Next <FiChevronRight aria-hidden="true" />
          </button>
        </nav>
      )}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  tone: 'primary' | 'green' | 'gold' | 'muted';
  delay: number;
}) {
  return (
    <article className={`questions-cockpit-metric ${tone}`} style={{ animationDelay: `${delay}s` }}>
      <div className="questions-cockpit-metric-head">
        <span>{icon}</span>
        <label>{label}</label>
      </div>
      <strong>{value.toLocaleString('en-US')}</strong>
      <small>{detail}</small>
      <i aria-hidden="true"><span /><span /><span /><span /><span /></i>
    </article>
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
  onChange: (value: string) => void;
  options: FilterOption[];
}) {
  return (
    <label className="questions-cockpit-filter">
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`questions-cockpit-pill status-${status}`}>
      <span aria-hidden="true" />
      {status}
    </span>
  );
}

function DifficultyPill({ difficulty }: { difficulty: string }) {
  return (
    <span className={`questions-cockpit-pill difficulty-${difficulty}`}>
      <span aria-hidden="true" />
      {difficulty}
    </span>
  );
}
