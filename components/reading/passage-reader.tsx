'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeWord, isAdvancedWord } from '@/lib/reading/common-words';

/**
 * Interactive passage renderer used in Practice and Mock.
 * Two reading tools share the same tokenized text:
 *   • Define  — hover (desktop) or tap (mobile) a word for an AI gloss with
 *               Uzbek/Russian translation. Results are cached cross-user server-side
 *               and per-session in this module, so repeats are instant.
 *   • Highlight — tap words to mark them, like a highlighter on a real test.
 */

type VocabEntry = {
  word: string;
  display: string;
  partOfSpeech: string | null;
  definition: string;
  uz: string;
  ru: string;
};

type Tool = 'define' | 'highlight';

/** True when the popover state holds a real translation (not a status sentinel). */
function isVocabEntry(
  e: VocabEntry | 'error' | 'loading' | 'locked' | null
): e is VocabEntry {
  return e !== null && typeof e === 'object';
}

// ─── session-level vocab cache (shared across all PassageReaders) ──────────────

const vocabCache = new Map<string, VocabEntry | 'error'>();
const inflight = new Map<string, Promise<VocabEntry | 'error'>>();

function fetchVocab(display: string, context: string): Promise<VocabEntry | 'error'> {
  const key = normalizeWord(display);
  const hit = vocabCache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async (): Promise<VocabEntry | 'error'> => {
    try {
      const res = await fetch('/api/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: display, context }),
      });
      const data = (await res.json()) as { ok?: boolean; entry?: VocabEntry };
      const result: VocabEntry | 'error' = data.ok && data.entry ? data.entry : 'error';
      vocabCache.set(key, result);
      return result;
    } catch {
      vocabCache.set(key, 'error');
      return 'error';
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// ─── tokenization ──────────────────────────────────────────────────────────────

type Token = { text: string; start: number; isWord: boolean };

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /[A-Za-z][A-Za-z'-]*|[^A-Za-z]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ text: m[0], start: m.index, isWord: /^[A-Za-z]/.test(m[0]) });
  }
  return out;
}

// ─── main component ──────────────────────────────────────────────────────────

const NO_MARKS: Set<number> = new Set();

export function PassageReader({
  text,
  className,
  pro = false,
  marks: marksProp,
  onMarksChange,
}: {
  text: string;
  className?: string;
  /** Pro/Elite unlocks real translations; free users get a locked teaser. */
  pro?: boolean;
  /**
   * Highlights can be lifted out so they survive navigation — the mock runner
   * keeps one set per question. Omit both props to keep them local.
   */
  marks?: Set<number>;
  onMarksChange?: (next: Set<number>) => void;
}) {
  const [tool, setTool] = useState<Tool>('define');
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
          className={`pr-tool${tool === 'define' ? ' on' : ''}`}
          onClick={() => setTool('define')}
          title="Tap a word for its meaning & translation"
        >
          <span aria-hidden="true">📖</span> Define
        </button>
        <button
          type="button"
          className={`pr-tool${tool === 'highlight' ? ' on' : ''}`}
          onClick={() => setTool('highlight')}
          title="Tap words to highlight them"
        >
          <span aria-hidden="true">🖍</span> Highlight
        </button>
        {marks.size > 0 && (
          <button type="button" className="pr-tool clear" onClick={() => setMarks(new Set<number>())}>
            Clear
          </button>
        )}
      </div>

      <div className="prx-passage pr-passage">
        {tokens.map((tk, i) => {
          if (!tk.isWord) return <span key={i}>{tk.text}</span>;
          const norm = normalizeWord(tk.text);
          const idx = ++wordIdx;
          if (!isAdvancedWord(norm)) {
            // common/basic word — still highlightable, never a vocab target
            return tool === 'highlight' ? (
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
          }
          const context = text.slice(Math.max(0, tk.start - 120), tk.start + tk.text.length + 120);
          return (
            <Word
              key={i}
              display={tk.text}
              context={context}
              tool={tool}
              pro={pro}
              marked={marks.has(idx)}
              onToggleMark={() => toggleMark(idx)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── a single interactive word ─────────────────────────────────────────────────

function Word({
  display,
  context,
  tool,
  pro,
  marked,
  onToggleMark,
}: {
  display: string;
  context: string;
  tool: Tool;
  pro: boolean;
  marked: boolean;
  onToggleMark: () => void;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [entry, setEntry] = useState<VocabEntry | 'error' | 'loading' | 'locked' | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(r.left + r.width / 2, 140), window.innerWidth - 140);
    setPos({ top: r.bottom + 8, left });
  }, []);

  const load = useCallback(() => {
    // Free users never trigger a Groq call — they see a locked teaser instead.
    if (!pro) {
      setEntry('locked');
      return;
    }
    const key = normalizeWord(display);
    const cached = vocabCache.get(key);
    if (cached) {
      setEntry(cached);
      return;
    }
    setEntry('loading');
    void fetchVocab(display, context).then(setEntry);
  }, [pro, display, context]);

  const show = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    place();
    setOpen(true);
    load();
  }, [place, load]);

  const hide = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      if (!pinned) setOpen(false);
    }, 140);
  }, [pinned]);

  // close pinned popovers on Escape / scroll / outside interaction
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPinned(false);
        setOpen(false);
      }
    }
    function onScroll() {
      setPinned(false);
      setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  if (tool === 'highlight') {
    return (
      <span
        className={`pr-mark-w${marked ? ' on' : ''}`}
        onClick={onToggleMark}
      >
        {display}
      </span>
    );
  }

  return (
    <>
      <span
        ref={ref}
        className={`vocab-word${pro ? '' : ' locked'}${open ? ' active' : ''}`}
        tabIndex={0}
        aria-describedby={open ? labelId : undefined}
        onPointerEnter={e => {
          if (e.pointerType === 'mouse') show();
        }}
        onPointerLeave={e => {
          if (e.pointerType === 'mouse') hide();
        }}
        onFocus={show}
        onBlur={hide}
        onClick={() => {
          // tap / click pins the popover open (essential on touch where there's no hover)
          if (open && pinned) {
            setPinned(false);
            setOpen(false);
          } else {
            setPinned(true);
            show();
          }
        }}
      >
        {display}
      </span>

      {open &&
        pos &&
        createPortal(
          <div
            id={labelId}
            role="tooltip"
            className="vocab-pop"
            style={{ top: pos.top, left: pos.left }}
            onPointerEnter={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current);
            }}
            onPointerLeave={hide}
          >
            <div className="vocab-pop-head">
              <span className="vocab-pop-word">{display.toLowerCase()}</span>
              {isVocabEntry(entry) && entry.partOfSpeech && (
                <span className="vocab-pop-pos">{entry.partOfSpeech}</span>
              )}
            </div>

            {entry === 'locked' ? (
              <div className="vocab-pop-lock">
                <p className="vocab-lock-title">🔒 Word translations</p>
                <p className="vocab-lock-text">
                  Uzbek &amp; Russian meanings for tough words are a Pro feature.
                </p>
                <a href="/settings" className="vocab-lock-cta">Upgrade to unlock →</a>
              </div>
            ) : entry === 'loading' || entry === null ? (
              <p className="vocab-pop-loading">
                <span className="vocab-spinner" aria-hidden="true" /> Looking it up…
              </p>
            ) : entry === 'error' ? (
              <p className="vocab-pop-err">No definition available.</p>
            ) : (
              <>
                <p className="vocab-pop-def">{entry.definition}</p>
                <div className="vocab-pop-tr">
                  <span className="vocab-flag" aria-hidden="true">🇺🇿</span>
                  <span>{entry.uz}</span>
                </div>
                <div className="vocab-pop-tr">
                  <span className="vocab-flag" aria-hidden="true">🇷🇺</span>
                  <span>{entry.ru}</span>
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
