'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type RowError = { row: number; reason: string };
type PreviewRow = {
  row: number;
  subject: string;
  category: string;
  questionText: string;
  correctAnswer: string;
  difficulty: string;
};
type Summary = {
  totalRows: number;
  validCount: number;
  skipCount: number;
  errorCount: number;
  errors: RowError[];
  preview: PreviewRow[];
  imported?: number;
};

type Phase =
  | { name: 'idle' }
  | { name: 'selected'; fileName: string; csv: string }
  | { name: 'previewing'; fileName: string; csv: string }
  | { name: 'preview'; fileName: string; csv: string; summary: Summary }
  | { name: 'importing'; fileName: string; csv: string; summary: Summary }
  | { name: 'done'; summary: Summary };

export default function ImportPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError('');
    if (!file.name.endsWith('.csv')) {
      setError('Please choose a .csv file.');
      return;
    }
    const csv = await file.text();
    setPhase({ name: 'selected', fileName: file.name, csv });
  }

  async function runPreview() {
    if (phase.name !== 'selected') return;
    setPhase({ name: 'previewing', fileName: phase.fileName, csv: phase.csv });
    setError('');
    try {
      const res = await fetch('/api/admin/questions/import?dryRun=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: phase.csv }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail ?? 'Could not parse the CSV.');
        setPhase({ name: 'selected', fileName: phase.fileName, csv: phase.csv });
        return;
      }
      setPhase({
        name: 'preview',
        fileName: phase.fileName,
        csv: phase.csv,
        summary: data,
      });
    } catch {
      setError('Network error. Please try again.');
      setPhase({ name: 'selected', fileName: phase.fileName, csv: phase.csv });
    }
  }

  async function runImport() {
    if (phase.name !== 'preview') return;
    setPhase({
      name: 'importing',
      fileName: phase.fileName,
      csv: phase.csv,
      summary: phase.summary,
    });
    try {
      const res = await fetch('/api/admin/questions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: phase.csv }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail ?? 'Import failed.');
        setPhase({
          name: 'preview',
          fileName: phase.fileName,
          csv: phase.csv,
          summary: phase.summary,
        });
        return;
      }
      setPhase({ name: 'done', summary: data });
      router.refresh();
    } catch {
      setError('Network error during import.');
      setPhase({
        name: 'preview',
        fileName: phase.fileName,
        csv: phase.csv,
        summary: phase.summary,
      });
    }
  }

  function reset() {
    setPhase({ name: 'idle' });
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="adm-crumbs">
        <Link href="/admin/questions">Questions</Link>
        <span>/</span>
        <span className="here">Import CSV</span>
      </div>
      <div className="adm-head">
        <h1>Import questions</h1>
        <p>
          Bulk-create from CSV. Everything lands as <strong>drafts</strong> for review.
        </p>
      </div>

      {/* Format guide */}
      <details className="adm-panel mb-5">
        <summary className="text-sm font-semibold text-txt cursor-pointer">
          CSV format guide
        </summary>
        <div className="mt-3 text-xs text-muted leading-relaxed">
          <p className="mb-2">
            Columns: <code>subject, category, question_text, passage, option_a,
            option_b, option_c, option_d, correct_answer, explanation, difficulty,
            tags</code>
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li><strong>subject</strong> / <strong>category</strong> must match existing names (e.g. Math / Algebra).</li>
            <li><strong>correct_answer</strong>: A, B, C, or D.</li>
            <li><strong>difficulty</strong>: easy, medium, or hard.</li>
            <li><strong>passage</strong> optional; <strong>tags</strong> semicolon-separated.</li>
            <li>Duplicates (same question + answer) are skipped automatically.</li>
          </ul>
          <a
            href="/question-import-template.csv"
            download
            className="inline-block mt-3 font-semibold"
            style={{ color: 'var(--green)' }}
          >
            ↓ Download template
          </a>
        </div>
      </details>

      {error && <div className="adm-alert err">{error}</div>}

      {/* Phase: idle / selected — dropzone */}
      {(phase.name === 'idle' || phase.name === 'selected' || phase.name === 'previewing') && (
        <div
          onDragOver={e => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={`adm-drop${dragging ? ' drag' : ''}`}
        >
          <span className="file-tag">
            {phase.name === 'idle' ? '.CSV' : phase.fileName}
          </span>
          {phase.name === 'idle' && (
            <p className="text-sm text-txt mb-4">
              Drag &amp; drop your CSV here, or browse for it.
            </p>
          )}
          {phase.name !== 'idle' && <div className="mb-4" />}

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => fileRef.current?.click()} className="adm-btn secondary">
              Browse files
            </button>
            {phase.name === 'selected' && (
              <button onClick={runPreview} className="adm-btn">
                Preview import →
              </button>
            )}
            {phase.name === 'previewing' && (
              <span
                className="text-sm"
                style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted)' }}
              >
                Analyzing…
              </span>
            )}
          </div>
        </div>
      )}

      {/* Phase: preview */}
      {(phase.name === 'preview' || phase.name === 'importing') && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MiniStat label="Will import" value={phase.summary.validCount} color="var(--ok)" />
            <MiniStat label="Skipped (dupes)" value={phase.summary.skipCount} color="var(--gold-d)" />
            <MiniStat
              label="Errors"
              value={phase.summary.errorCount - phase.summary.skipCount}
              color="var(--err)"
            />
          </div>

          {phase.summary.preview.length > 0 && (
            <div className="adm-table-wrap mb-4">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th className="w-10">Row</th>
                    <th>Question</th>
                    <th className="hidden sm:table-cell">Category</th>
                    <th>Key</th>
                  </tr>
                </thead>
                <tbody>
                  {phase.summary.preview.map(p => (
                    <tr key={p.row}>
                      <td
                        style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--muted)' }}
                      >
                        {p.row}
                      </td>
                      <td className="q-preview">{p.questionText}…</td>
                      <td className="hidden sm:table-cell text-muted">{p.category}</td>
                      <td
                        style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--green)' }}
                      >
                        {p.correctAnswer}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {phase.summary.errors.length > 0 && <ErrorList errors={phase.summary.errors} />}

          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={runImport}
              disabled={phase.name === 'importing' || phase.summary.validCount === 0}
              className="adm-btn"
            >
              {phase.name === 'importing'
                ? 'Importing…'
                : `Import ${phase.summary.validCount} question${phase.summary.validCount === 1 ? '' : 's'}`}
            </button>
            <button
              onClick={reset}
              disabled={phase.name === 'importing'}
              className="text-sm text-muted disabled:opacity-50 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Phase: done */}
      {phase.name === 'done' && (
        <div className="adm-panel accent">
          <span
            className="adm-pill mb-3"
            style={{
              color: 'var(--ok)',
              background: 'color-mix(in srgb, var(--ok) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--ok) 30%, transparent)',
            }}
          >
            ✓ Import complete
          </span>
          <p className="text-base font-semibold text-txt mb-1 mt-2">
            Imported {phase.summary.imported} question
            {phase.summary.imported === 1 ? '' : 's'} as drafts.
          </p>
          <p className="text-sm text-muted mb-4">
            {phase.summary.skipCount > 0 && `${phase.summary.skipCount} skipped. `}
            Review and publish them from the questions list.
          </p>
          {phase.summary.errors.length > 0 && <ErrorList errors={phase.summary.errors} />}
          <div className="flex gap-3 mt-4">
            <Link href="/admin/questions?status=draft" className="adm-btn">
              Review drafts →
            </Link>
            <button onClick={reset} className="adm-btn secondary">
              Import another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="adm-stat">
      <p className="adm-stat-label">{label}</p>
      <p className="adm-stat-num" style={{ color, fontSize: '1.4rem' }}>
        {value}
      </p>
    </div>
  );
}

function ErrorList({ errors }: { errors: RowError[] }) {
  return (
    <div
      className="rounded p-3 max-h-48 overflow-y-auto"
      style={{
        background: 'color-mix(in srgb, var(--err) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--err) 25%, transparent)',
      }}
    >
      <p
        className="text-xs font-semibold mb-2"
        style={{ color: 'var(--err)', fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}
      >
        {errors.length} ROW{errors.length === 1 ? '' : 'S'} WITH ISSUES
      </p>
      <ul className="text-xs text-txt-soft flex flex-col gap-1">
        {errors.slice(0, 50).map((e, i) => (
          <li key={i}>
            <strong>Row {e.row}:</strong> {e.reason}
          </li>
        ))}
        {errors.length > 50 && <li className="text-muted">…and {errors.length - 50} more</li>}
      </ul>
    </div>
  );
}
