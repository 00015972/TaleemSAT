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
      <div className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/admin/questions" className="hover:underline">
          Questions
        </Link>
        <span>/</span>
        <span className="text-txt">Import CSV</span>
      </div>
      <h1 className="font-serif text-2xl font-bold text-txt mb-2">Import questions</h1>
      <p className="text-sm text-muted mb-6">
        Upload a CSV to bulk-create questions. All imported questions land as{' '}
        <strong>drafts</strong> — review and publish them after.
      </p>

      {/* Format guide */}
      <details
        className="rounded-l p-4 mb-5"
        style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
      >
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

      {error && (
        <p className="text-sm mb-4" style={{ color: 'var(--err)' }}>
          {error}
        </p>
      )}

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
          className="rounded-l p-8 text-center transition-colors"
          style={{
            background: dragging
              ? 'color-mix(in srgb, var(--green) 8%, transparent)'
              : 'var(--surf)',
            border: `2px dashed ${dragging ? 'var(--green)' : 'var(--border)'}`,
          }}
        >
          <p className="text-3xl mb-2">📄</p>
          {phase.name === 'idle' ? (
            <>
              <p className="text-sm text-txt mb-1">Drag &amp; drop your CSV here</p>
              <p className="text-xs text-muted mb-4">or</p>
            </>
          ) : (
            <p className="text-sm text-txt mb-4">
              Selected: <strong>{phase.fileName}</strong>
            </p>
          )}

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
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--surf2)', color: 'var(--txt)', border: '1px solid var(--border)' }}
            >
              Browse files
            </button>
            {phase.name === 'selected' && (
              <button
                onClick={runPreview}
                className="rounded px-4 py-2 text-sm font-semibold"
                style={{ background: 'var(--green)', color: '#fff' }}
              >
                Preview import →
              </button>
            )}
            {phase.name === 'previewing' && (
              <span className="text-sm text-muted">Analyzing…</span>
            )}
          </div>
        </div>
      )}

      {/* Phase: preview */}
      {(phase.name === 'preview' || phase.name === 'importing') && (
        <div>
          <SummaryCards summary={phase.summary} />

          {phase.summary.preview.length > 0 && (
            <div
              className="rounded-l overflow-hidden mb-4"
              style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs font-semibold text-muted px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                Preview (first {phase.summary.preview.length})
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {phase.summary.preview.map(p => (
                    <tr key={p.row} style={{ borderBottom: '1px solid var(--border)' }}>
                      <Td className="text-muted w-10">{p.row}</Td>
                      <Td className="text-txt">{p.questionText}…</Td>
                      <Td className="text-muted hidden sm:table-cell">{p.category}</Td>
                      <Td className="text-txt-soft">{p.correctAnswer}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {phase.summary.errors.length > 0 && (
            <ErrorList errors={phase.summary.errors} />
          )}

          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={runImport}
              disabled={phase.name === 'importing' || phase.summary.validCount === 0}
              className="rounded px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--green)', color: '#fff' }}
            >
              {phase.name === 'importing'
                ? 'Importing…'
                : `Import ${phase.summary.validCount} question${phase.summary.validCount === 1 ? '' : 's'}`}
            </button>
            <button
              onClick={reset}
              disabled={phase.name === 'importing'}
              className="rounded px-4 py-2.5 text-sm text-muted disabled:opacity-50 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Phase: done */}
      {phase.name === 'done' && (
        <div
          className="rounded-l p-6"
          style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
        >
          <p className="text-2xl mb-2">✅</p>
          <p className="text-base font-semibold text-txt mb-1">
            Imported {phase.summary.imported} question
            {phase.summary.imported === 1 ? '' : 's'} as drafts.
          </p>
          <p className="text-sm text-muted mb-4">
            {phase.summary.skipCount > 0 && `${phase.summary.skipCount} skipped. `}
            Review and publish them from the questions list.
          </p>
          {phase.summary.errors.length > 0 && (
            <ErrorList errors={phase.summary.errors} />
          )}
          <div className="flex gap-3 mt-4">
            <Link
              href="/admin/questions?status=draft"
              className="rounded px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--green)', color: '#fff' }}
            >
              Review drafts →
            </Link>
            <button
              onClick={reset}
              className="rounded px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--surf2)', color: 'var(--txt)', border: '1px solid var(--border)' }}
            >
              Import another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCards({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <MiniCard label="Will import" value={summary.validCount} color="var(--ok)" />
      <MiniCard label="Skipped (dupes)" value={summary.skipCount} color="var(--gold-d)" />
      <MiniCard label="Errors" value={summary.errorCount - summary.skipCount} color="var(--err)" />
    </div>
  );
}

function MiniCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="rounded p-3"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>
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
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--err)' }}>
        {errors.length} row{errors.length === 1 ? '' : 's'} with issues
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

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}
