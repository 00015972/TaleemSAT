'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export type PickQuestion = {
  id: string;
  preview: string;
  difficulty: string;
  categoryName: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  DATE_TAKEN: 'A question is already scheduled for that date.',
  PAST_DATE: 'Choose today or a future date.',
  QUESTION_NOT_PUBLISHED: 'Only published questions can be scheduled.',
  REUSE_TOO_SOON: 'This question was used too recently (within 30 days). Pick another.',
  MISSING_FIELDS: 'Pick a date and a question.',
};

export function QodScheduler({
  publishedQuestions,
  defaultDate,
}: {
  publishedQuestions: PickQuestion[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving'>('idle');
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return publishedQuestions.slice(0, 30);
    return publishedQuestions
      .filter(
        q =>
          q.preview.toLowerCase().includes(term) ||
          q.categoryName.toLowerCase().includes(term)
      )
      .slice(0, 30);
  }, [search, publishedQuestions]);

  async function schedule() {
    if (!selectedId || !date) {
      setError('Pick a date and a question.');
      return;
    }
    setStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/admin/qod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: date, questionId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(ERROR_MESSAGES[data?.error] ?? 'Could not schedule. Try again.');
        setStatus('idle');
        return;
      }
      setSelectedId(null);
      setStatus('idle');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setStatus('idle');
    }
  }

  return (
    <div className="adm-panel accent">
      <span className="adm-section-label">Schedule a question</span>

      {publishedQuestions.length === 0 ? (
        <p className="text-sm text-muted">
          No published questions yet. Publish a question first, then schedule it here.
        </p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <label className="adm-filter">
              <span>Date</span>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </label>
            <label className="adm-filter flex-1">
              <span>Find a question</span>
              <input
                className="form-input"
                placeholder="Search text or category…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>
          </div>

          <div
            className="rounded max-h-64 overflow-y-auto mb-3"
            style={{ border: '1px solid var(--border)' }}
          >
            {filtered.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">No matches.</p>
            ) : (
              filtered.map(q => (
                <button
                  key={q.id}
                  onClick={() => setSelectedId(selectedId === q.id ? null : q.id)}
                  className={`adm-pick${selectedId === q.id ? ' on' : ''}`}
                >
                  <span className="mark" />
                  <span
                    className="flex-1 min-w-0 truncate"
                    style={{ fontFamily: 'var(--serif-read)', fontSize: '0.92rem', color: 'var(--txt)' }}
                  >
                    {q.preview}
                    {q.preview.length >= 70 ? '…' : ''}
                  </span>
                  <span
                    className="shrink-0 hidden sm:inline"
                    style={{ fontFamily: 'var(--mono)', fontSize: '0.64rem', color: 'var(--muted)' }}
                  >
                    {q.categoryName} · {q.difficulty}
                  </span>
                </button>
              ))
            )}
          </div>

          {error && (
            <p className="text-sm mb-3" style={{ color: 'var(--err)' }}>
              {error}
            </p>
          )}

          <button
            onClick={schedule}
            disabled={status === 'saving' || !selectedId}
            className="adm-btn"
          >
            {status === 'saving' ? 'Scheduling…' : `Schedule for ${date}`}
          </button>
        </>
      )}
    </div>
  );
}
