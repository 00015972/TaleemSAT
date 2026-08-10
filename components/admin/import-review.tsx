'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ItemStatusPill, StatusPill } from '@/components/admin/import-status-pill';
import { ChartFigure } from '@/components/reading/chart-figure';

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
  page_image_url: string | null;
  question_image_url: string | null;
  chart_svg: string | null;
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

export function ImportReview({
  initialJob,
  initialItems,
}: {
  initialJob: ImportJob;
  initialItems: ImportItem[];
}) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [promoting, setPromoting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'err'; text: string } | null>(null);

  const inFlight = job.status === 'queued' || job.status === 'running';

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/admin/import-jobs/${job.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setJob(data.job);
    setItems(data.items);
  }, [job.id]);

  // While the extractor is working, keep the page current.
  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [inFlight, refresh]);

  const promotable = items.filter(i => !i.question_id && i.status === 'pending_review');
  const selectedIds = [...selected].filter(id => promotable.some(p => p.id === id));

  async function promote(ids: string[]) {
    if (ids.length === 0) return;
    setPromoting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/import-jobs/${job.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: 'err', text: data?.detail ?? 'Could not approve those questions.' });
        return;
      }
      const skipped = (data.skipped ?? []) as { reason: string }[];
      setMessage({
        kind: skipped.length > 0 ? 'err' : 'info',
        text:
          `Approved ${data.promoted} question${data.promoted === 1 ? '' : 's'} as drafts.` +
          (skipped.length > 0 ? ` ${skipped.length} skipped: ${skipped[0].reason}` : ''),
      });
      setSelected(new Set());
      await refresh();
      router.refresh();
    } catch {
      setMessage({ kind: 'err', text: 'Could not reach the server.' });
    } finally {
      setPromoting(false);
    }
  }

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>{job.source_filename ?? 'Import'}</h1>
          <p>
            <StatusPill status={job.status} />{' '}
            {inFlight ? (
              <span className="adm-live">
                Extracting — {job.success_count + job.failed_count} of {job.total_count || '?'} done
              </span>
            ) : (
              <>
                {job.success_count} extracted
                {job.failed_count > 0 && `, ${job.failed_count} need a fix`}
              </>
            )}
          </p>
        </div>
        {promotable.length > 0 && (
          <button
            type="button"
            className="adm-btn"
            disabled={promoting || selectedIds.length === 0}
            onClick={() => promote(selectedIds)}
          >
            {promoting
              ? 'Approving…'
              : `Approve ${selectedIds.length || ''} selected`.replace('  ', ' ')}
          </button>
        )}
      </div>

      {job.error && <div className="adm-alert err">{job.error}</div>}
      {message && (
        <div className={`adm-alert ${message.kind === 'err' ? 'err' : 'info'}`}>{message.text}</div>
      )}

      {promotable.length > 0 && (
        <div className="adm-toolbar">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.length === promotable.length && promotable.length > 0}
              onChange={e =>
                setSelected(e.target.checked ? new Set(promotable.map(p => p.id)) : new Set())
              }
            />
            Select all {promotable.length} ready to review
          </label>
        </div>
      )}

      {items.length === 0 ? (
        <div className="adm-empty">
          <p>{inFlight ? 'Reading the PDF…' : 'Nothing was extracted from this file.'}</p>
        </div>
      ) : (
        <div className="imp-list">
          {items.map(item => (
            <ItemCard
              key={item.id}
              jobId={job.id}
              item={item}
              selected={selected.has(item.id)}
              onToggle={checked =>
                setSelected(prev => {
                  const next = new Set(prev);
                  if (checked) next.add(item.id);
                  else next.delete(item.id);
                  return next;
                })
              }
              onChanged={refresh}
              onApprove={() => promote([item.id])}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ItemCard({
  jobId,
  item,
  selected,
  onToggle,
  onChanged,
  onApprove,
}: {
  jobId: string;
  item: ImportItem;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onChanged: () => Promise<void>;
  onApprove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPage, setShowPage] = useState(false);
  const [draft, setDraft] = useState({
    questionText: item.question_text ?? '',
    explanation: item.explanation ?? '',
    correctAnswer: item.correct_answer ?? '',
    acceptedAnswers: (item.accepted_answers ?? []).join(', '),
    options: (item.options ?? []).map(o => ({ ...o })),
  });

  const errors = item.validation_errors ?? [];
  const notes = item.verification_notes as
    | { modelNotes?: string; answersAgree?: boolean; confidence?: string }
    | null;
  const done = Boolean(item.question_id);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/admin/import-jobs/${jobId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: draft.questionText,
          explanation: draft.explanation,
          correctAnswer: draft.correctAnswer || null,
          acceptedAnswers: draft.acceptedAnswers
            .split(',')
            .map(a => a.trim())
            .filter(Boolean),
          options: draft.options,
        }),
      });
      setEditing(false);
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function reject() {
    setSaving(true);
    try {
      await fetch(`/api/admin/import-jobs/${jobId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`imp-item${done ? ' done' : ''}`}>
      <header className="imp-item-head">
        {!done && item.status === 'pending_review' && (
          <input
            type="checkbox"
            checked={selected}
            onChange={e => onToggle(e.target.checked)}
            aria-label={`Select ${item.source_ref ?? 'question'}`}
          />
        )}
        <code className="imp-ref">{item.source_ref ?? '—'}</code>
        <ItemStatusPill status={item.status} />
        <span className="imp-meta">
          {item.question_type === 'grid_in' ? 'grid-in' : 'multiple choice'}
          {item.difficulty && ` · ${item.difficulty}`}
          {item.topics?.name && ` · ${item.topics.name}`}
        </span>
        <div className="imp-item-actions">
          {item.page_image_url && (
            <button
              type="button"
              className="adm-btn secondary sm"
              onClick={() => setShowPage(s => !s)}
            >
              {showPage ? 'Hide source' : 'Source page'}
            </button>
          )}
          {!done && (
            <>
              <button
                type="button"
                className="adm-btn secondary sm"
                onClick={() => setEditing(e => !e)}
                disabled={saving}
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
              {item.status !== 'rejected' && (
                <button
                  type="button"
                  className="adm-btn secondary sm"
                  onClick={reject}
                  disabled={saving}
                >
                  Reject
                </button>
              )}
              {item.status === 'pending_review' && (
                <button type="button" className="adm-btn sm" onClick={onApprove} disabled={saving}>
                  Approve
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {errors.length > 0 && (
        <ul className="imp-errors">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {notes?.modelNotes && <p className="imp-note">Model note: {notes.modelNotes}</p>}

      {editing ? (
        <div className="imp-edit">
          <label className="adm-form-group">
            <span>Question</span>
            <textarea
              rows={4}
              value={draft.questionText}
              onChange={e => setDraft(d => ({ ...d, questionText: e.target.value }))}
            />
          </label>

          {item.question_type === 'mcq' ? (
            <>
              {draft.options.map((opt, i) => (
                <label key={opt.id} className="adm-form-group">
                  <span>Option {opt.id}</span>
                  <textarea
                    rows={2}
                    value={opt.text}
                    onChange={e =>
                      setDraft(d => {
                        const options = [...d.options];
                        options[i] = { ...options[i], text: e.target.value };
                        return { ...d, options };
                      })
                    }
                  />
                </label>
              ))}
              <label className="adm-form-group">
                <span>Correct answer</span>
                <input
                  value={draft.correctAnswer}
                  maxLength={1}
                  onChange={e =>
                    setDraft(d => ({ ...d, correctAnswer: e.target.value.toUpperCase() }))
                  }
                />
              </label>
            </>
          ) : (
            <label className="adm-form-group">
              <span>Accepted answers (comma separated)</span>
              <input
                value={draft.acceptedAnswers}
                onChange={e => setDraft(d => ({ ...d, acceptedAnswers: e.target.value }))}
              />
            </label>
          )}

          <label className="adm-form-group">
            <span>Explanation</span>
            <textarea
              rows={6}
              value={draft.explanation}
              onChange={e => setDraft(d => ({ ...d, explanation: e.target.value }))}
            />
          </label>

          <div className="adm-actions">
            <button type="button" className="adm-btn" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="imp-body">
          <ChartFigure svg={item.chart_svg} />
          {item.passage && <p className="imp-passage">{item.passage}</p>}
          <p className="imp-q">{item.question_text ?? <em>No question text</em>}</p>

          {item.question_type === 'mcq' ? (
            <ul className="imp-opts">
              {(item.options ?? []).map(o => (
                <li key={o.id} className={o.id === item.correct_answer ? 'right' : undefined}>
                  <b>{o.id}</b> {o.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="imp-answer">
              Accepts: <code>{(item.accepted_answers ?? []).join('  ·  ') || '—'}</code>
            </p>
          )}

          {item.explanation && <p className="imp-expl">{item.explanation}</p>}
        </div>
      )}

      {showPage && item.page_image_url && (
        <figure className="imp-page">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.page_image_url} alt={`Source page for ${item.source_ref}`} />
          <figcaption>
            Source page, for checking the transcription. It includes the rationale, so it is
            never shown to students.
          </figcaption>
        </figure>
      )}
    </article>
  );
}
