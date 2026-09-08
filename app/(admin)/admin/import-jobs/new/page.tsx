'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiFileText,
  FiRefreshCw,
  FiShield,
  FiUploadCloud,
} from 'react-icons/fi';

type Phase =
  | { name: 'idle' }
  | { name: 'selected'; file: File }
  | { name: 'uploading'; file: File };

export default function NewImportPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = phase.name === 'uploading';

  function openFilePicker() {
    if (busy) return;
    if (fileRef.current) fileRef.current.value = '';
    fileRef.current?.click();
  }

  function chooseFile(file: File) {
    setError('');
    if (!/\.html?$/i.test(file.name)) {
      setError('Choose a .html file.');
      return;
    }
    setPhase({ name: 'selected', file });
  }

  async function startImport() {
    if (phase.name !== 'selected') return;
    const { file } = phase;
    setPhase({ name: 'uploading', file });
    setError('');

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/import-jobs/html', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(errorMessage(data?.error, data?.detail, data?.maxBytes));
        setPhase({ name: 'selected', file });
        return;
      }
      router.push(`/admin/import-jobs/${data.jobId}`);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setPhase({ name: 'selected', file });
    }
  }

  return (
    <section className="import-runway">
      <div className="import-runway-ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="import-runway-header import-runway-enter">
        <Link href="/admin/import-jobs" className="import-runway-back">
          <FiArrowLeft aria-hidden="true" />
          Imports
        </Link>
        <p className="import-runway-eyebrow">
          <span aria-hidden="true" />
          New import
          <span aria-hidden="true" />
        </p>
        <h1>Start a safe import</h1>
        <p className="import-runway-lede">
          Your questions stay private while the source is validated. Nothing reaches
          students until you review and approve it.
        </p>
      </header>

      <ImportProgressRail />

      <div className="import-runway-stage import-runway-enter">
        {error && (
          <div className="import-runway-error" role="alert">
            <span aria-hidden="true">
              <FiAlertCircle />
            </span>
            <div>
              <strong>Import needs attention</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="text/html,.html,.htm"
          className="sr-only"
          aria-label="Choose an HTML question-bank file"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) chooseFile(file);
          }}
        />

        <div
          className={`import-runway-dropzone${dragging ? ' is-dragging' : ''}${phase.name !== 'idle' ? ' has-file' : ''}${busy ? ' is-uploading' : ''}`}
          aria-busy={busy}
          onDragEnter={e => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragOver={e => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            if (busy) return;
            const file = e.dataTransfer.files?.[0];
            if (file) chooseFile(file);
          }}
        >
          <div className="import-runway-dropzone-ring" aria-hidden="true" />

          {phase.name === 'idle' ? (
            <div className="import-runway-idle">
              <div className="import-runway-beacon" aria-hidden="true">
                <FiUploadCloud />
              </div>
              <p className="import-runway-drop-kicker">
                {dragging ? 'File detected' : 'HTML question bank'}
              </p>
              <h2>{dragging ? 'Drop to attach this file' : 'Choose your question bank'}</h2>
              <p>
                {dragging
                  ? 'Release it here and we’ll prepare the source for validation.'
                  : 'Drag and drop a converted source file into this panel, or browse your computer.'}
              </p>
              <button type="button" className="import-runway-primary" onClick={openFilePicker}>
                <FiUploadCloud aria-hidden="true" />
                Browse files
              </button>
              <span className="import-runway-format">Accepts .html and .htm</span>
            </div>
          ) : (
            <div className="import-runway-file-state">
              <div className="import-runway-file-icon" aria-hidden="true">
                {busy ? <FiRefreshCw /> : <FiFileText />}
                {!busy && (
                  <span>
                    <FiCheck />
                  </span>
                )}
              </div>

              <div className="import-runway-file-copy">
                <p className="import-runway-drop-kicker">
                  {busy ? 'Secure transfer in progress' : 'Ready for validation'}
                </p>
                <h2 title={phase.file.name}>{phase.file.name}</h2>
                <div className="import-runway-file-meta">
                  <span>HTML</span>
                  <span>{formatFileSize(phase.file.size)}</span>
                  <span>{busy ? 'Uploading' : 'Attached'}</span>
                </div>
              </div>

              <div className="import-runway-file-actions">
                <button
                  type="button"
                  className="import-runway-secondary"
                  onClick={openFilePicker}
                  disabled={busy}
                >
                  Replace file
                </button>
                <button
                  type="button"
                  className="import-runway-primary"
                  onClick={startImport}
                  disabled={busy}
                >
                  {busy ? (
                    <FiRefreshCw className="import-runway-spin" aria-hidden="true" />
                  ) : (
                    <FiShield aria-hidden="true" />
                  )}
                  {busy ? 'Uploading…' : 'Start import'}
                </button>
              </div>

              {busy && (
                <div className="import-runway-upload-progress" role="status" aria-live="polite">
                  <span>Uploading and preparing your source…</span>
                  <i aria-hidden="true">
                    <b />
                  </i>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="import-runway-stage-caption">
          <FiShield aria-hidden="true" />
          <p>
            The file is parsed directly from its defined structure. Ambiguous questions are
            flagged for review instead of being guessed.
          </p>
        </div>
      </div>

      <div className="import-runway-trust import-runway-enter" aria-label="Import safeguards">
        <TrustNote
          number="01"
          title="Parsed directly"
          copy="The structured HTML is read without AI interpretation."
        />
        <TrustNote
          number="02"
          title="Reviewed by you"
          copy="Exceptions stay visible and editable in the review workspace."
        />
        <TrustNote
          number="03"
          title="Published manually"
          copy="Approved questions become drafts and never go live automatically."
        />
      </div>

      <p className="import-runway-schema import-runway-enter">
        Need the source contract? See <code>docs/15-html-import-schema.md</code>.
      </p>
    </section>
  );
}

function ImportProgressRail() {
  const steps = [
    { number: '1', label: 'Upload', detail: 'Attach source' },
    { number: '2', label: 'Validate', detail: 'Check structure' },
    { number: '3', label: 'Review', detail: 'Approve drafts' },
  ];

  return (
    <ol className="import-runway-progress import-runway-enter" aria-label="Import workflow">
      {steps.map((step, index) => (
        <li
          key={step.number}
          className={index === 0 ? 'is-active' : undefined}
          aria-current={index === 0 ? 'step' : undefined}
        >
          <span className="import-runway-step-number">{step.number}</span>
          <span className="import-runway-step-copy">
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

function TrustNote({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <article>
      <span>{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
    </article>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessage(code: string | undefined, detail: string | undefined, maxBytes?: number) {
  switch (code) {
    case 'NOT_HTML':
      return 'That file is not HTML.';
    case 'TOO_LARGE': {
      const mb = maxBytes ? Math.round(maxBytes / 1024 / 1024) : null;
      return `That file is over the${mb ? ` ${mb} MB` : ''} limit. Split it and import the parts.`;
    }
    case 'NO_QUESTIONS_PARSED':
      return `No questions could be parsed from that file (${detail ?? 'unknown reason'}). Check it matches docs/15-html-import-schema.md.`;
    case 'UPLOAD_FAILED':
      return `Upload failed: ${detail ?? 'unknown error'}`;
    default:
      return detail ?? 'The import could not be started.';
  }
}
