'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
    <>
      <div className="adm-crumbs">
        <Link href="/admin/import-jobs">Imports</Link>
        <span>/</span>
        <span>New</span>
      </div>

      <div className="adm-head">
        <div>
          <h1>Import questions</h1>
          <p>
            Questions are read out of the file and held for your review. Nothing reaches
            students until you approve it.
          </p>
        </div>
      </div>

      {error && <div className="adm-alert err">{error}</div>}

      <div
        className={`adm-drop${dragging ? ' drag' : ''}`}
        onDragOver={e => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) chooseFile(file);
        }}
      >
        {phase.name !== 'idle' && (
          <div className="file-tag">
            <span>{phase.file.name}</span>
            <span>· {(phase.file.size / 1024 / 1024).toFixed(1)} MB</span>
          </div>
        )}

        <p className="text-sm text-muted mb-3">
          {phase.name === 'idle'
            ? 'Drop a converted question-bank HTML file here, or choose one.'
            : 'Ready to import.'}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="text/html,.html,.htm"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) chooseFile(file);
          }}
        />

        <div className="adm-actions justify-center">
          <button
            type="button"
            className="adm-btn secondary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            Choose file
          </button>
          {phase.name !== 'idle' && (
            <button type="button" className="adm-btn" onClick={startImport} disabled={busy}>
              {busy ? 'Uploading…' : 'Start import'}
            </button>
          )}
        </div>
      </div>

      <div className="adm-panel mt-4">
        <p className="adm-section-label">What happens next</p>
        <ol className="text-sm text-muted mt-2" style={{ paddingLeft: '1.1rem' }}>
          <li>
            The file is parsed directly — no AI involved, since the HTML already tags the
            question text, options, correct answer, and explanation explicitly.
          </li>
          <li>
            Anything the parser can&apos;t make sense of — a missing correct-answer marker,
            an unrecognized skill, an embedded figure — is flagged for you rather than
            guessed at.
          </li>
          <li>You review, fix anything wrong, and approve. Approved questions become drafts.</li>
        </ol>
        <p className="text-sm text-muted mt-3">
          The HTML needs to follow a specific structure to parse correctly — see
          docs/15-html-import-schema.md for the exact contract.
        </p>
      </div>
    </>
  );
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
