'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  FiActivity,
  FiAlertCircle,
  FiAlertTriangle,
  FiCheck,
  FiCheckCircle,
  FiEdit3,
  FiFilter,
  FiInbox,
  FiLayers,
  FiSearch,
  FiShield,
  FiX,
  FiXCircle,
  FiZap,
} from 'react-icons/fi';
import { ItemStatusPill, StatusPill } from '@/components/admin/import-status-pill';
import { ChartFigure } from '@/components/reading/chart-figure';
import { QuestionBody } from '@/components/reading/question-body';

export type ImportItem = {
  id: string;
  status: string;
  source_ref: string | null;
  question_type: 'mcq' | 'grid_in';
  question_text: string | null;
  passage: string | null;
  options: { id: string; text: string }[];
  correct_answer: string | null;
  accepted_answers: string[];
  explanation: string | null;
  difficulty: string | null;
  question_image_url: string | null;
  chart_svg: string | null;
  tables: string[] | null;
  verification_notes: Record<string, unknown> | null;
  validation_errors: string[] | null;
  question_id: string | null;
  topics: { name: string } | null;
  categories: { name: string } | null;
};

export type ImportJob = {
  id: string;
  status: string;
  source_filename: string | null;
  total_count: number;
  success_count: number;
  failed_count: number;
  error: string | null;
};

type StreamFilter = 'all' | 'ready' | 'attention' | 'approved' | 'rejected';
type Notice = { kind: 'success' | 'warning' | 'error'; text: string };
type EditPayload = {
  questionText: string;
  explanation: string;
  correctAnswer: string | null;
  acceptedAnswers: string[];
  options: { id: string; text: string }[];
};

const STREAM_FILTERS: { value: StreamFilter; label: string }[] = [
  { value: 'all', label: 'All questions' },
  { value: 'ready', label: 'Ready to review' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function isPromotable(item: ImportItem) {
  return !item.question_id && item.status === 'pending_review';
}

function isResolved(item: ImportItem) {
  return Boolean(item.question_id) || item.status === 'approved' || item.status === 'rejected';
}

function needsAttention(item: ImportItem) {
  return item.status === 'verification_failed' || (item.validation_errors?.length ?? 0) > 0;
}

function filterStream(items: ImportItem[], query: string, filter: StreamFilter) {
  const needle = query.trim().toLowerCase();

  return items.filter(item => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'ready' && isPromotable(item)) ||
      (filter === 'attention' && needsAttention(item)) ||
      (filter === 'approved' && (Boolean(item.question_id) || item.status === 'approved')) ||
      (filter === 'rejected' && item.status === 'rejected');

    if (!matchesFilter) return false;
    if (!needle) return true;

    return [
      item.source_ref,
      item.question_text,
      item.topics?.name,
      item.categories?.name,
      item.difficulty,
      item.question_type,
    ]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(needle));
  });
}

function importTitle(filename: string | null) {
  if (!filename) return 'Imported question set';
  return filename
    .replace(/\.html?$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+\d+\s+questions?$/i, '')
    .replace(/^SAT\s+(?:Math|Reading|Writing)\s+(?:Easy|Medium|Hard)\s+/i, '')
    .replace(/\bAnd\b/gi, '&')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

export function ImportReview({
  initialJob,
  initialItems,
}: {
  initialJob: ImportJob;
  initialItems: ImportItem[];
}) {
  const [job, setJob] = useState(initialJob);
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StreamFilter>('all');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);
  const [promotingItemId, setPromotingItemId] = useState<string | null>(null);
  const [bulkPromoting, setBulkPromoting] = useState(false);
  const [successItemId, setSuccessItemId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const inFlight = job.status === 'queued' || job.status === 'running';
  const promotable = useMemo(() => items.filter(isPromotable), [items]);
  const visibleItems = useMemo(() => filterStream(items, query, filter), [items, query, filter]);
  const visiblePromotable = useMemo(() => visibleItems.filter(isPromotable), [visibleItems]);
  const selectedIds = useMemo(
    () => [...selected].filter(id => promotable.some(item => item.id === id)),
    [selected, promotable]
  );

  const attentionCount = items.filter(needsAttention).length;
  const resolvedCount = items.filter(isResolved).length;
  const readyCount = promotable.length;
  const totalCount = items.length || job.total_count || 0;
  const reviewPercent = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;
  const allVisibleSelected =
    visiblePromotable.length > 0 && visiblePromotable.every(item => selected.has(item.id));
  const promotionLocked = bulkPromoting || promotingItemId !== null;

  const refresh = useCallback(async (silent = false): Promise<ImportItem[] | null> => {
    try {
      const res = await fetch('/api/admin/import-jobs/' + job.id);
      if (!res.ok) {
        if (!silent) {
          setNotice({
            kind: 'error',
            text: 'Could not refresh this import. The last loaded data is still visible.',
          });
        }
        return null;
      }

      const data = await res.json();
      const nextItems = data.items as ImportItem[];
      setJob(data.job as ImportJob);
      setItems(nextItems);
      setSelected(previous =>
        new Set(
          [...previous].filter(id =>
            nextItems.some(item => item.id === id && isPromotable(item))
          )
        )
      );
      return nextItems;
    } catch {
      if (!silent) {
        setNotice({
          kind: 'error',
          text: 'Could not reach the server. The last loaded data is still visible.',
        });
      }
      return null;
    }
  }, [job.id]);

  useEffect(() => {
    if (!inFlight) return;
    const timer = window.setInterval(() => void refresh(true), 3000);
    return () => window.clearInterval(timer);
  }, [inFlight, refresh]);

  function toggleItem(itemId: string, checked: boolean) {
    setSelected(previous => {
      const next = new Set(previous);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  function toggleVisible(checked: boolean) {
    setSelected(previous => {
      const next = new Set(previous);
      for (const item of visiblePromotable) {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  }

  async function promote(ids: string[], mode: 'single' | 'bulk') {
    if (ids.length === 0 || promotionLocked) return;

    if (mode === 'bulk') setBulkPromoting(true);
    else setPromotingItemId(ids[0]);
    setNotice(null);

    try {
      const res = await fetch('/api/admin/import-jobs/' + job.id + '/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: ids }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setNotice({ kind: 'error', text: data?.detail ?? 'Could not approve those questions.' });
        return;
      }

      const skipped = (data.skipped ?? []) as { itemId: string; reason: string }[];
      await refresh(true);

      if (mode === 'single') {
        setSuccessItemId(ids[0]);
        window.setTimeout(() => setSuccessItemId(null), 1000);
      }

      setNotice({
        kind: skipped.length > 0 ? 'warning' : 'success',
        text:
          'Approved ' +
          data.promoted +
          ' question' +
          (data.promoted === 1 ? '' : 's') +
          ' as drafts.' +
          (skipped.length > 0
            ? ' ' + skipped.length + ' skipped: ' + skipped[0].reason
            : ''),
      });
    } catch {
      setNotice({ kind: 'error', text: 'Could not reach the server. Try approving again.' });
    } finally {
      setBulkPromoting(false);
      setPromotingItemId(null);
    }
  }

  async function saveItem(itemId: string, payload: EditPayload) {
    setSavingItemId(itemId);
    setNotice(null);

    try {
      const res = await fetch('/api/admin/import-jobs/' + job.id + '/items/' + itemId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setNotice({ kind: 'error', text: data?.detail ?? 'Could not save this question.' });
        return false;
      }

      await refresh(true);
      setSuccessItemId(itemId);
      window.setTimeout(() => setSuccessItemId(null), 1000);
      setNotice({
        kind: data.status === 'verification_failed' ? 'warning' : 'success',
        text:
          data.status === 'verification_failed'
            ? 'Changes saved, but this question still has validation issues.'
            : 'Changes saved. This question is ready to review.',
      });
      return true;
    } catch {
      setNotice({
        kind: 'error',
        text: 'Could not reach the server. Your edits are still here.',
      });
      return false;
    } finally {
      setSavingItemId(null);
    }
  }

  async function rejectItem(itemId: string) {
    setRejectingItemId(itemId);
    setNotice(null);

    try {
      const res = await fetch('/api/admin/import-jobs/' + job.id + '/items/' + itemId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setNotice({ kind: 'error', text: data?.detail ?? 'Could not reject this question.' });
        return;
      }

      await refresh(true);
      setSelected(previous => {
        const next = new Set(previous);
        next.delete(itemId);
        return next;
      });
      setEditingItemId(current => (current === itemId ? null : current));
      setSuccessItemId(itemId);
      window.setTimeout(() => setSuccessItemId(null), 1000);
      setNotice({ kind: 'success', text: 'Question rejected.' });
    } catch {
      setNotice({ kind: 'error', text: 'Could not reach the server. Try rejecting again.' });
    } finally {
      setRejectingItemId(null);
    }
  }

  return (
    <section className="import-cockpit import-stream">
      <div className="import-cockpit-ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="import-cockpit-header import-cockpit-enter">
        <div className="import-cockpit-heading">
          <p className="import-cockpit-kicker">
            <FiShield aria-hidden="true" />
            Continuous review
          </p>
          <div className="import-cockpit-title-row">
            <h1>{importTitle(job.source_filename)}</h1>
            <StatusPill status={job.status} />
          </div>
          <p className="import-cockpit-filename" title={job.source_filename ?? undefined}>
            {job.source_filename ?? 'Import source'}
          </p>
        </div>

        <div className="import-cockpit-progress-block">
          <div
            className="import-cockpit-progress-ring"
            style={{ '--import-progress': reviewPercent + '%' } as CSSProperties}
            aria-label={reviewPercent + '% of questions resolved'}
          >
            <span>{reviewPercent}%</span>
          </div>
          <div>
            <strong>{resolvedCount} of {totalCount}</strong>
            <small>questions resolved</small>
          </div>
        </div>
      </header>

      <div className="import-cockpit-metrics import-cockpit-enter" aria-label="Import summary">
        <Metric icon={<FiLayers />} label="Extracted" value={totalCount} tone="green" />
        <Metric icon={<FiCheckCircle />} label="Ready" value={readyCount} tone="green" />
        <Metric
          icon={<FiAlertTriangle />}
          label="Needs attention"
          value={attentionCount}
          tone="gold"
        />
        <Metric icon={<FiActivity />} label="Resolved" value={resolvedCount} tone="muted" />
      </div>

      {job.error && (
        <div className="import-cockpit-notice error" role="alert">
          <FiAlertCircle aria-hidden="true" />
          <span>{job.error}</span>
        </div>
      )}

      {notice && (
        <div
          className={'import-cockpit-notice ' + notice.kind}
          role="status"
          aria-live="polite"
        >
          {notice.kind === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
            <FiX />
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="import-cockpit-empty import-cockpit-enter">
          <span><FiInbox aria-hidden="true" /></span>
          <h2>{inFlight ? 'Reading your question bank' : 'No questions were extracted'}</h2>
          <p>
            {inFlight
              ? 'The extractor is preparing the review stream. This page updates automatically.'
              : 'Check that the file follows the HTML import schema, then start a new import.'}
          </p>
        </div>
      ) : (
        <>
          <ReviewToolbar
            query={query}
            filter={filter}
            visibleCount={visibleItems.length}
            totalCount={items.length}
            readyCount={visiblePromotable.length}
            selectedCount={selectedIds.length}
            allVisibleSelected={allVisibleSelected}
            bulkPromoting={bulkPromoting}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
            onToggleVisible={toggleVisible}
            onApproveSelected={() => void promote(selectedIds, 'bulk')}
          />

          {visibleItems.length === 0 ? (
            <div className="import-stream-empty">
              <span><FiSearch aria-hidden="true" /></span>
              <h2>No questions match this view</h2>
              <p>Try another search or return to all statuses.</p>
              <button
                type="button"
                className="import-cockpit-button primary"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <ol className="import-stream-list" aria-label="Imported questions">
              {visibleItems.map((item, index) => (
                <li key={item.id}>
                  <ReviewCard
                    item={item}
                    position={items.findIndex(candidate => candidate.id === item.id) + 1}
                    selected={selected.has(item.id)}
                    editing={editingItemId === item.id}
                    saving={savingItemId === item.id}
                    rejecting={rejectingItemId === item.id}
                    promoting={promotingItemId === item.id}
                    promotionLocked={promotionLocked}
                    success={successItemId === item.id}
                    revealIndex={index}
                    onToggle={checked => toggleItem(item.id, checked)}
                    onEdit={() => setEditingItemId(item.id)}
                    onCancelEdit={() => setEditingItemId(null)}
                    onSave={async payload => {
                      const saved = await saveItem(item.id, payload);
                      if (saved) setEditingItemId(null);
                      return saved;
                    }}
                    onReject={() => void rejectItem(item.id)}
                    onApprove={() => void promote([item.id], 'single')}
                  />
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {selectedIds.length > 0 && (
        <div className="import-stream-bulk" role="region" aria-label="Bulk actions">
          <span className="import-stream-bulk-count">{selectedIds.length}</span>
          <div>
            <strong>{selectedIds.length} selected</strong>
            <small>Ready questions will become drafts</small>
          </div>
          <button
            type="button"
            className="import-cockpit-button ghost"
            onClick={() => setSelected(new Set())}
            disabled={bulkPromoting}
          >
            Clear
          </button>
          <button
            type="button"
            className="import-cockpit-button primary"
            disabled={bulkPromoting}
            onClick={() => void promote(selectedIds, 'bulk')}
          >
            <FiShield aria-hidden="true" />
            {bulkPromoting ? 'Approving…' : 'Approve selected'}
          </button>
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        Showing {visibleItems.length} of {items.length} questions
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'green' | 'gold' | 'muted';
}) {
  return (
    <div className={'import-cockpit-metric ' + tone}>
      <span className="import-cockpit-metric-icon" aria-hidden="true">{icon}</span>
      <div><small>{label}</small><strong>{value}</strong></div>
      <i aria-hidden="true" />
    </div>
  );
}

function ReviewToolbar({
  query,
  filter,
  visibleCount,
  totalCount,
  readyCount,
  selectedCount,
  allVisibleSelected,
  bulkPromoting,
  onQueryChange,
  onFilterChange,
  onToggleVisible,
  onApproveSelected,
}: {
  query: string;
  filter: StreamFilter;
  visibleCount: number;
  totalCount: number;
  readyCount: number;
  selectedCount: number;
  allVisibleSelected: boolean;
  bulkPromoting: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: StreamFilter) => void;
  onToggleVisible: (checked: boolean) => void;
  onApproveSelected: () => void;
}) {
  return (
    <div className="import-stream-toolbar import-cockpit-enter">
      <div className="import-stream-toolbar-title">
        <span><FiLayers aria-hidden="true" /></span>
        <div>
          <small>Review stream</small>
          <strong>{visibleCount} <em>of {totalCount}</em></strong>
        </div>
      </div>

      <label className="import-stream-search">
        <FiSearch aria-hidden="true" />
        <span className="sr-only">Search this import</span>
        <input
          type="search"
          value={query}
          placeholder="Search question text or source ID…"
          onChange={event => onQueryChange(event.target.value)}
        />
        {query && (
          <button type="button" onClick={() => onQueryChange('')} aria-label="Clear search">
            <FiX />
          </button>
        )}
      </label>

      <label className="import-stream-filter">
        <FiFilter aria-hidden="true" />
        <span className="sr-only">Filter questions</span>
        <select
          value={filter}
          onChange={event => onFilterChange(event.target.value as StreamFilter)}
        >
          {STREAM_FILTERS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <label className={'import-stream-select-ready' + (readyCount === 0 ? ' is-disabled' : '')}>
        <input
          type="checkbox"
          checked={allVisibleSelected}
          disabled={readyCount === 0}
          onChange={event => onToggleVisible(event.target.checked)}
        />
        <span>Select ready</span>
        <small>{readyCount}</small>
      </label>

      {selectedCount > 0 && (
        <button
          type="button"
          className="import-cockpit-button primary import-stream-toolbar-approve"
          disabled={bulkPromoting}
          onClick={onApproveSelected}
        >
          <FiShield aria-hidden="true" />
          {bulkPromoting ? 'Approving…' : 'Approve ' + selectedCount}
        </button>
      )}
    </div>
  );
}

function ReviewCard({
  item,
  position,
  selected,
  editing,
  saving,
  rejecting,
  promoting,
  promotionLocked,
  success,
  revealIndex,
  onToggle,
  onEdit,
  onCancelEdit,
  onSave,
  onReject,
  onApprove,
}: {
  item: ImportItem;
  position: number;
  selected: boolean;
  editing: boolean;
  saving: boolean;
  rejecting: boolean;
  promoting: boolean;
  promotionLocked: boolean;
  success: boolean;
  revealIndex: number;
  onToggle: (checked: boolean) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (payload: EditPayload) => Promise<boolean>;
  onReject: () => void;
  onApprove: () => void;
}) {
  const errors = item.validation_errors ?? [];
  const notes = item.verification_notes as
    | { modelNotes?: string; answersAgree?: boolean; confidence?: string }
    | null;
  const resolved = isResolved(item);
  const warnings = [
    ...(notes?.answersAgree === false ? ['Extracted answer does not match verification.'] : []),
    ...errors,
  ];

  return (
    <article
      id={'import-item-' + item.id}
      className={
        'import-stream-card' +
        (selected ? ' is-selected' : '') +
        (needsAttention(item) ? ' has-issue' : '') +
        (resolved ? ' is-resolved' : '') +
        (success ? ' is-success' : '')
      }
      style={{ '--stream-index': Math.min(revealIndex, 12) } as CSSProperties}
    >
      <header className="import-stream-card-head">
        <div className="import-stream-card-select">
          {isPromotable(item) ? (
            <input
              type="checkbox"
              checked={selected}
              onChange={event => onToggle(event.target.checked)}
              aria-label={'Select question ' + (item.source_ref ?? position)}
            />
          ) : (
            <span className="import-stream-card-state" aria-hidden="true">
              {needsAttention(item) ? <FiAlertTriangle /> : <FiCheckCircle />}
            </span>
          )}
        </div>

        <div className="import-stream-card-number">
          <small>Question</small>
          <strong>{String(position).padStart(2, '0')}</strong>
        </div>

        <div className="import-stream-card-meta">
          <div>
            <code>{item.source_ref ?? 'No source ID'}</code>
            <ItemStatusPill status={item.status} />
          </div>
          <div className="import-stream-card-tags">
            <span>{item.question_type === 'grid_in' ? 'Grid-in' : 'Multiple choice'}</span>
            {item.difficulty && <span>{item.difficulty}</span>}
            {(item.categories?.name ?? item.topics?.name) && (
              <span>{item.categories?.name ?? item.topics?.name}</span>
            )}
            {notes?.confidence && <span>{notes.confidence} confidence</span>}
          </div>
        </div>

        {warnings.length === 0 && !resolved && (
          <span className="import-stream-healthy">
            <FiCheckCircle aria-hidden="true" />
            Ready
          </span>
        )}
      </header>

      {warnings.length > 0 && (
        <div className="import-stream-issues" role="alert">
          <FiAlertTriangle aria-hidden="true" />
          <div>
            <strong>Needs attention</strong>
            <ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          </div>
        </div>
      )}

      {notes?.modelNotes && (
        <div className="import-stream-review-note">
          <strong>Reviewer note</strong>
          <span>{notes.modelNotes}</span>
        </div>
      )}

      <div className="import-stream-card-body">
        {editing ? (
          <QuestionEditor
            key={item.id}
            item={item}
            saving={saving}
            onCancel={onCancelEdit}
            onSave={onSave}
          />
        ) : (
          <QuestionPreview item={item} />
        )}
      </div>

      {!editing && (
        <footer className="import-stream-card-actions">
          {resolved ? (
            <div className="import-stream-resolved">
              <FiCheckCircle aria-hidden="true" />
              <div>
                <strong>
                  {item.status === 'rejected' ? 'Review closed' : 'Added to question bank'}
                </strong>
                <span>
                  {item.status === 'rejected'
                    ? 'This item was rejected.'
                    : 'This question is saved as a draft.'}
                </span>
              </div>
              {item.question_id && (
                <Link href={'/admin/questions/' + item.question_id + '/edit'}>Open draft →</Link>
              )}
            </div>
          ) : (
            <>
              <span className="import-stream-card-hint">
                {isPromotable(item)
                  ? 'Review, select, or approve this question in place.'
                  : 'Resolve the validation issues before approval.'}
              </span>
              <div>
                <button
                  type="button"
                  className="import-cockpit-button ghost"
                  onClick={onEdit}
                >
                  <FiEdit3 aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  className="import-cockpit-button danger"
                  onClick={onReject}
                  disabled={rejecting || promotionLocked}
                >
                  <FiXCircle aria-hidden="true" />
                  {rejecting ? 'Rejecting…' : 'Reject'}
                </button>
                <button
                  type="button"
                  className="import-cockpit-button primary"
                  onClick={onApprove}
                  disabled={!isPromotable(item) || promotionLocked}
                >
                  <FiShield aria-hidden="true" />
                  {promoting ? 'Approving…' : 'Approve'}
                </button>
              </div>
            </>
          )}
        </footer>
      )}
    </article>
  );
}

function QuestionPreview({ item }: { item: ImportItem }) {
  return (
    <div className="import-cockpit-preview">
      {item.passage && (
        <div className="import-cockpit-passage">
          <span>Passage</span>
          <p>{item.passage}</p>
        </div>
      )}

      <div className="import-cockpit-figure-zone">
        <ChartFigure svg={item.chart_svg} />
        {item.question_image_url && (
          <figure className="import-cockpit-imported-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.question_image_url}
              alt="Imported question figure"
              loading="lazy"
              decoding="async"
            />
          </figure>
        )}
      </div>

      <div className="import-cockpit-question-content">
        {item.question_text ? (
          <QuestionBody
            text={item.question_text}
            tables={item.tables}
            className="import-cockpit-question-text"
          />
        ) : (
          <p className="import-cockpit-question-missing">
            <em>No question text was extracted.</em>
          </p>
        )}

        {item.question_type === 'mcq' ? (
          <ol className="import-cockpit-options">
            {(item.options ?? []).map(option => (
              <li
                key={option.id}
                className={option.id === item.correct_answer ? 'is-correct' : undefined}
              >
                <b className="import-cockpit-option-letter">{option.id}</b>
                <span dangerouslySetInnerHTML={{ __html: option.text }} />
                {option.id === item.correct_answer && (
                  <small><FiCheck aria-hidden="true" /> Correct answer</small>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <div className="import-cockpit-grid-answer">
            <span>Accepted answers</span>
            <code>{(item.accepted_answers ?? []).join(' · ') || '—'}</code>
          </div>
        )}

        {item.explanation && (
          <section className="import-cockpit-explanation">
            <div><FiZap aria-hidden="true" /><span>Answer rationale</span></div>
            <QuestionBody text={item.explanation} />
          </section>
        )}
      </div>
    </div>
  );
}

function QuestionEditor({
  item,
  saving,
  onCancel,
  onSave,
}: {
  item: ImportItem;
  saving: boolean;
  onCancel: () => void;
  onSave: (payload: EditPayload) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState({
    questionText: item.question_text ?? '',
    explanation: item.explanation ?? '',
    correctAnswer: item.correct_answer ?? '',
    acceptedAnswers: (item.accepted_answers ?? []).join(', '),
    options: (item.options ?? []).map(option => ({ ...option })),
  });

  async function submit() {
    await onSave({
      questionText: draft.questionText,
      explanation: draft.explanation,
      correctAnswer: draft.correctAnswer || null,
      acceptedAnswers: draft.acceptedAnswers
        .split(',')
        .map(answer => answer.trim())
        .filter(Boolean),
      options: draft.options,
    });
  }

  return (
    <div className="import-cockpit-editor">
      <div className="import-cockpit-editor-banner">
        <span><FiEdit3 aria-hidden="true" /></span>
        <div>
          <strong>Editing imported content</strong>
          <small>Saving will run validation again.</small>
        </div>
      </div>

      <label className="import-cockpit-field">
        <span>Question</span>
        <textarea
          rows={5}
          value={draft.questionText}
          onChange={event =>
            setDraft(current => ({ ...current, questionText: event.target.value }))
          }
        />
      </label>

      {item.question_type === 'mcq' ? (
        <div className="import-cockpit-editor-options">
          {draft.options.map((option, index) => (
            <label key={option.id} className="import-cockpit-field option">
              <span>Option {option.id}</span>
              <textarea
                rows={2}
                value={option.text}
                onChange={event =>
                  setDraft(current => {
                    const options = [...current.options];
                    options[index] = { ...options[index], text: event.target.value };
                    return { ...current, options };
                  })
                }
              />
            </label>
          ))}
          <label className="import-cockpit-field answer">
            <span>Correct answer</span>
            <input
              value={draft.correctAnswer}
              maxLength={1}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  correctAnswer: event.target.value.toUpperCase(),
                }))
              }
            />
          </label>
        </div>
      ) : (
        <label className="import-cockpit-field">
          <span>Accepted answers <small>Comma separated</small></span>
          <input
            value={draft.acceptedAnswers}
            onChange={event =>
              setDraft(current => ({ ...current, acceptedAnswers: event.target.value }))
            }
          />
        </label>
      )}

      <label className="import-cockpit-field">
        <span>Explanation</span>
        <textarea
          rows={7}
          value={draft.explanation}
          onChange={event =>
            setDraft(current => ({ ...current, explanation: event.target.value }))
          }
        />
      </label>

      <div className="import-cockpit-editor-actions">
        <button
          type="button"
          className="import-cockpit-button ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="import-cockpit-button primary"
          onClick={() => void submit()}
          disabled={saving}
        >
          <FiCheck aria-hidden="true" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

