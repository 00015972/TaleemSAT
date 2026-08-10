'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Format = 'pdf' | 'html';

type Phase =
  | { name: 'idle' }
  | { name: 'selected'; file: File }
  | { name: 'uploading'; file: File };

const FORMAT_CONFIG: Record<
  Format,
  {
    label: string;
    accept: string;
    extensionTest: RegExp;
    endpoint: string;
    dropHint: string;
    invalidMessage: string;
  }
> = {
  pdf: {
    label: 'PDF (vision transcription)',
    accept: 'application/pdf,.pdf',
    extensionTest: /\.pdf$/i,
    endpoint: '/api/admin/import-jobs',
    dropHint: 'Drop a College Board question-bank PDF here, or choose one.',
    invalidMessage: 'Choose a .pdf file.',
  },
  html: {
    label: 'HTML (fast, no AI)',
    accept: 'text/html,.html,.htm',
    extensionTest: /\.html?$/i,
    endpoint: '/api/admin/import-jobs/html',
    dropHint: 'Drop a converted question-bank HTML file here, or choose one.',
    invalidMessage: 'Choose a .html file.',
  },
};

export default function NewImportPage() {
  const router = useRouter();
  const [format, setFormat] = useState<Format>('pdf');
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const config = FORMAT_CONFIG[format];
  const busy = phase.name === 'uploading';

  function switchFormat(next: Format) {
    if (busy || next === format) return;
    setFormat(next);
    setPhase({ name: 'idle' });
    setError('');
  }

  function chooseFile(file: File) {
    setError('');
    if (!config.extensionTest.test(file.name)) {
      setError(config.invalidMessage);
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
      const res = await fetch(config.endpoint, { method: 'POST', body: form });
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

      <div className="adm-actions mb-3">
        {(Object.keys(FORMAT_CONFIG) as Format[]).map(key => (
          <button
            key={key}
            type="button"
            className={`adm-btn sm${format === key ? '' : ' secondary'}`}
            onClick={() => switchFormat(key)}
            disabled={busy}
          >
            {FORMAT_CONFIG[key].label}
          </button>
        ))}
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
          {phase.name === 'idle' ? config.dropHint : 'Ready to import.'}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept={config.accept}
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
        {format === 'pdf' ? (
          <ol className="text-sm text-muted mt-2" style={{ paddingLeft: '1.1rem' }}>
            <li>Each page is read for its question ID, skill, difficulty and answer key.</li>
            <li>
              Pages are transcribed by a vision model, because the PDF draws formulas as
              images — that is where the LaTeX comes from.
            </li>
            <li>
              Both readings of the answer are compared. Anything that disagrees is flagged
              for you rather than imported quietly.
            </li>
            <li>You review, fix anything wrong, and approve. Approved questions become drafts.</li>
          </ol>
        ) : (
          <>
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
              <li>
                You review, fix anything wrong, and approve. Approved questions become drafts.
              </li>
            </ol>
            <p className="text-sm text-muted mt-3">
              The HTML needs to follow a specific structure to parse correctly — see
              docs/15-html-import-schema.md for the exact contract.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function errorMessage(code: string | undefined, detail: string | undefined, maxBytes?: number) {
  switch (code) {
    case 'NOT_A_PDF':
      return 'That file is not a PDF.';
    case 'NOT_HTML':
      return 'That file is not HTML.';
    case 'TOO_LARGE': {
      const mb = maxBytes ? Math.round(maxBytes / 1024 / 1024) : null;
      return `That file is over the${mb ? ` ${mb} MB` : ''} limit. Split it and import the parts.`;
    }
    case 'NO_QUESTIONS_PARSED':
      return `No questions could be parsed from that file (${detail ?? 'unknown reason'}). Check it matches docs/15-html-import-schema.md.`;
    case 'TRIGGER_FAILED':
      return `The extraction service did not accept the job: ${detail ?? 'unknown error'}. Make sure the Trigger.dev worker is running.`;
    case 'UPLOAD_FAILED':
      return `Upload failed: ${detail ?? 'unknown error'}`;
    default:
      return detail ?? 'The import could not be started.';
  }
}
