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
  const [warn, setWarn] = useState('');

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
    setWarn('');
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
    <div
      className="rounded-l p-5"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <h2 className="text-sm font-semibold text-txt mb-4">Schedule a question</h2>

      {publishedQuestions.length === 0 ? (
        <p className="text-sm text-muted">
          No published questions yet. Publish a question first, then schedule it here.
        </p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-txt">Date</span>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-xs font-semibold text-txt">Find a question</span>
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
                  onClick={() => setSelectedId(q.id)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background:
                      selectedId === q.id
                        ? 'color-mix(in srgb, var(--green) 12%, transparent)'
                        : 'transparent',
                  }}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{
                      border: `2px solid ${selectedId === q.id ? 'var(--green)' : 'var(--border)'}`,
                      background: selectedId === q.id ? 'var(--green)' : 'transparent',
                    }}
                  />
                  <span className="flex-1 text-sm text-txt">
                    {q.preview}
                    {q.preview.length >= 70 ? '…' : ''}
                  </span>
                  <span className="text-xs text-muted shrink-0 hidden sm:inline">
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
          {warn && (
            <p className="text-sm mb-3" style={{ color: 'var(--gold-d)' }}>
              {warn}
            </p>
          )}

          <button
            onClick={schedule}
            disabled={status === 'saving' || !selectedId}
            className="rounded px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--green)', color: '#fff' }}
          >
            {status === 'saving' ? 'Scheduling…' : 'Schedule for ' + date}
          </button>
        </>
      )}
    </div>
  );
}
