'use client';

import { useCallback, useState } from 'react';
import { Eraser, Highlighter } from 'lucide-react';

/**
 * Interactive passage renderer used in Practice and Mock.
 * Tap words to highlight them, like a highlighter on a real test.
 */

type Token = { text: string; isWord: boolean };

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /[A-Za-z][A-Za-z'-]*|[^A-Za-z]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ text: m[0], isWord: /^[A-Za-z]/.test(m[0]) });
  }
  return out;
}

const NO_MARKS: Set<number> = new Set();

export function PassageReader({
  text,
  className,
  marks: marksProp,
  onMarksChange,
  annotate: annotateProp,
  onAnnotateChange,
}: {
  text: string;
  className?: string;
  /**
   * Highlights can be lifted out so they survive navigation — the mock runner
   * keeps one set per question. Omit both props to keep them local.
   */
  marks?: Set<number>;
  onMarksChange?: (next: Set<number>) => void;
  /**
   * Whether tapping a word highlights it can likewise be lifted out — the
   * top-bar Annotate toggle needs to drive the same state the passage's own
   * Highlight button does. Omit both props to keep it local.
   */
  annotate?: boolean;
  onAnnotateChange?: (next: boolean) => void;
}) {
  const [ownAnnotate, setOwnAnnotate] = useState(false);
  const annotate = annotateProp ?? ownAnnotate;
  const setAnnotate = useCallback(
    (next: boolean) => {
      if (onAnnotateChange) onAnnotateChange(next);
      else setOwnAnnotate(next);
    },
    [onAnnotateChange]
  );
  const [ownMarks, setOwnMarks] = useState<Set<number>>(NO_MARKS);
  const marks = marksProp ?? ownMarks;
  const tokens = tokenize(text);

  const setMarks = useCallback(
    (next: Set<number>) => {
      if (onMarksChange) onMarksChange(next);
      else setOwnMarks(next);
    },
    [onMarksChange]
  );

  const toggleMark = useCallback(
    (i: number) => {
      const next = new Set(marks);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      setMarks(next);
    },
    [marks, setMarks]
  );

  // give each word token a stable index for highlight bookkeeping
  let wordIdx = -1;

  return (
    <div className={`pr-wrap${className ? ` ${className}` : ''}`}>
      <div className="pr-tools" role="group" aria-label="Reading tools">
        <button
          type="button"
          className={`pr-tool${annotate ? ' on' : ''}`}
          onClick={() => setAnnotate(!annotate)}
          title="Tap words to highlight them"
        >
          <Highlighter aria-hidden="true" /> Highlight
        </button>
        {marks.size > 0 && (
          <button type="button" className="pr-tool clear" onClick={() => setMarks(new Set<number>())}>
            <Eraser aria-hidden="true" /> Clear
          </button>
        )}
      </div>

      <div className="prx-passage pr-passage">
        {tokens.map((tk, i) => {
          if (!tk.isWord) return <span key={i}>{tk.text}</span>;
          const idx = ++wordIdx;
          return annotate ? (
            <span
              key={i}
              className={`pr-mark-w${marks.has(idx) ? ' on' : ''}`}
              onClick={() => toggleMark(idx)}
            >
              {tk.text}
            </span>
          ) : (
            <span key={i}>{tk.text}</span>
          );
        })}
      </div>
    </div>
  );
}
