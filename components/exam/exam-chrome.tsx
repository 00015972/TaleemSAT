'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Grid2X2,
} from 'lucide-react';

/**
 * Test-taking chrome — the shell a timed section runs inside.
 *
 * The real thing strips away everything that isn't the question: while an
 * <ExamRoot> is mounted, <html data-exam="on"> hides the app sidebar/topbar and
 * locks page scroll, and the root covers the viewport. Nothing scrolls except
 * the two reading panes, so a question never runs off the bottom of the screen.
 *
 * All classes are namespaced .ex-*.
 */

// ─── Root ─────────────────────────────────────────────────────────────────────

/** localStorage key for the Appearance menu's reading font-size choice. */
export const FONTSIZE_KEY = 'taleem_reading_fontsize';
export type FontSize = 'standard' | 'large' | 'xl';

export function ExamRoot({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'practice';
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-exam', 'on');
    try {
      const saved = localStorage.getItem(FONTSIZE_KEY);
      if (saved === 'large' || saved === 'xl') root.setAttribute('data-fontsize', saved);
    } catch {
      // localStorage unavailable — fall back to standard size
    }
    return () => {
      root.removeAttribute('data-exam');
      root.removeAttribute('data-fontsize');
    };
  }, []);

  return <div className={`ex-root${variant === 'practice' ? ' ex-practice' : ''}`}>{children}</div>;
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

export function ExamTopBar({
  title,
  subtitle,
  directions,
  center,
  right,
  onExit,
  exitLabel = 'Exit',
}: {
  title: string;
  subtitle?: string;
  /** Short instructional text — rendered behind a "Directions ▾" toggle. */
  directions?: string;
  center?: ReactNode;
  right?: ReactNode;
  onExit?: () => void;
  exitLabel?: string;
}) {
  const [dirOpen, setDirOpen] = useState(false);
  return (
    <header className={`ex-top${dirOpen ? ' dir-open' : ''}`}>
      <div className="ex-top-l">
        {onExit && (
          <button type="button" className="ex-exit" onClick={onExit}>
            <ArrowLeft aria-hidden="true" /> {exitLabel}
          </button>
        )}
        <div className="ex-titles">
          <p className="ex-title">{title}</p>
          {subtitle && <p className="ex-sub">{subtitle}</p>}
          {directions && (
            <>
              <button
                type="button"
                className="ex-dir-toggle"
                onClick={() => setDirOpen(o => !o)}
                aria-expanded={dirOpen}
              >
                Directions {dirOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              </button>
              {dirOpen && <p className="ex-dir-body">{directions}</p>}
            </>
          )}
        </div>
      </div>
      <div className="ex-top-c">{center}</div>
      <div className="ex-top-r">{right}</div>
    </header>
  );
}

/** Clock with a Hide toggle — the same escape hatch the official app offers. */
export function ExamClock({
  label,
  tone = '',
  hidden,
  onToggle,
}: {
  label: string;
  tone?: '' | 'warn' | 'danger';
  hidden: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="ex-clock-box">
      <span className={`ex-clock${tone ? ` ${tone}` : ''}`} aria-live="off">
        {hidden ? '• • •' : label}
      </span>
      <button type="button" className="ex-clock-btn" onClick={onToggle}>
        {hidden ? 'Show' : 'Hide'}
      </button>
    </div>
  );
}

// ─── Stage: header block + question block | choices block ─────────────────────

/**
 * Three bordered blocks over the branded surface: a header strip carrying the
 * question count and its progress rule, then the question (passage + stem) on
 * the left and the answer choices on the right. Each block scrolls on its own.
 */
export function ExamStage({
  header,
  question,
  choices,
  questionLabel = 'Question',
  choicesLabel = 'Answer choices',
  overlay,
}: {
  header?: ReactNode;
  question: ReactNode;
  choices: ReactNode;
  questionLabel?: string;
  choicesLabel?: string;
  /** Decorative overlay (e.g. the line-reader band) — rendered last, above everything. */
  overlay?: ReactNode;
}) {
  return (
    <div className="ex-stage">
      <ExamWatermark />
      {header && <div className="ex-qbar">{header}</div>}
      <div className="ex-body">
        <section className="ex-panel">
          <p className="ex-panel-label">{questionLabel}</p>
          <div className="ex-panel-in">{question}</div>
        </section>
        <section className="ex-panel">
          <p className="ex-panel-label">{choicesLabel}</p>
          <div className="ex-panel-in">{choices}</div>
        </section>
      </div>
      {overlay}
    </div>
  );
}

/** The crest and wordmark, printed faintly under the blocks. Decorative only. */
export function ExamWatermark() {
  return (
    <div className="ex-wm" aria-hidden="true">
      <div className="ex-wm-tile" />
      <div className="ex-wm-logo" />
    </div>
  );
}

// ─── Split: two borderless, independently-scrolling panes with a drag handle ──

const SPLIT_MIN = 25;
const SPLIT_MAX = 75;
const SPLIT_DEFAULT = 50;

function clampSplit(n: number) {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));
}

function readSplitPct(storageKey: string): number {
  if (typeof window === 'undefined') return SPLIT_DEFAULT;
  try {
    const saved = Number(localStorage.getItem(storageKey));
    return saved >= SPLIT_MIN && saved <= SPLIT_MAX ? saved : SPLIT_DEFAULT;
  } catch {
    return SPLIT_DEFAULT;
  }
}
function getSplitServerSnapshot() {
  return SPLIT_DEFAULT;
}
/** The stored ratio never changes except through our own drag/key handlers
 * below, which re-render locally — so there's nothing external to subscribe to. */
function subscribeNever() {
  return () => {};
}

/**
 * A resizable two-pane layout — no card chrome, just a hairline divider you
 * can drag. The ratio is remembered (localStorage) across questions and
 * visits until dragged again. Reads the persisted value via
 * useSyncExternalStore (not an effect) so it's SSR-safe without a
 * hydration-mismatch flash — same pattern as the sidebar's collapsed state.
 */
export function ExamSplit({
  left,
  right,
  storageKey = 'taleem_exam_split',
  overlay,
  showWatermark = true,
}: {
  left: ReactNode;
  right: ReactNode;
  storageKey?: string;
  /** Decorative overlay (e.g. the line-reader band) — rendered last, above everything. */
  overlay?: ReactNode;
  /** Practice can opt out so its clean paper surface never mounts branded image assets. */
  showWatermark?: boolean;
}) {
  const persistedPct = useSyncExternalStore(
    subscribeNever,
    () => readSplitPct(storageKey),
    getSplitServerSnapshot
  );
  // Non-null while the user is actively overriding the persisted ratio
  // (dragging, or just finished a keyboard nudge).
  const [livePct, setLivePct] = useState<number | null>(null);
  const pct = livePct ?? persistedPct;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const dragTo = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLivePct(clampSplit(((clientX - rect.left) / rect.width) * 100));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      dragTo(e.clientX);
    },
    [dragTo]
  );

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setLivePct(p => {
      if (p != null) localStorage.setItem(storageKey, String(Math.round(p)));
      return p;
    });
  }, [storageKey]);

  return (
    <div className="ex-split" ref={containerRef}>
      {showWatermark && <ExamWatermark />}
      <div className="ex-split-pane" style={{ flexBasis: `${pct}%` }}>
        {left}
      </div>
      <div
        className="ex-split-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the question and answer panels"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={e => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const next = clampSplit(pct + (e.key === 'ArrowLeft' ? -2 : 2));
          localStorage.setItem(storageKey, String(Math.round(next)));
          setLivePct(next);
        }}
      />
      <div className="ex-split-pane" style={{ flexBasis: `${100 - pct}%` }}>
        {right}
      </div>
      {overlay}
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export function ExamFooter({
  left,
  center,
  right,
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <footer className="ex-foot">
      <div className="ex-foot-l">{left}</div>
      <div className="ex-foot-c">{center}</div>
      <div className="ex-foot-r">{right}</div>
    </footer>
  );
}

/**
 * "Question N of M" — click for the bubble grid of the whole section.
 * `bubbleClass` decorates each bubble (answered / flagged / correct / wrong).
 */
export function ExamNavigator({
  index,
  total,
  bubbleClass,
  onJump,
  action,
  legend,
}: {
  index: number;
  total: number;
  bubbleClass: (i: number) => string;
  onJump: (i: number) => void;
  action?: ReactNode;
  legend?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="ex-nav-box" ref={boxRef}>
      {open && (
        <div className="ex-nav-pop" role="dialog" aria-label="Question navigator">
          <div className="ex-nav-grid">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`ex-bub${i === index ? ' now' : ''} ${bubbleClass(i)}`}
                onClick={() => {
                  onJump(i);
                  setOpen(false);
                }}
                aria-label={`Question ${i + 1}`}
                aria-current={i === index}
              >
                {i + 1}
              </button>
            ))}
          </div>
          {legend && <div className="ex-nav-legend">{legend}</div>}
          {action && <div className="ex-nav-action">{action}</div>}
        </div>
      )}
      <button
        type="button"
        className={`ex-nav-btn${open ? ' on' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <Grid2X2 className="ex-nav-icon" aria-hidden="true" />
        Question {index + 1} of {total}
        {open ? (
          <ChevronDown className="ex-nav-caret" aria-hidden="true" />
        ) : (
          <ChevronUp className="ex-nav-caret" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

export function ExamDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Keep going',
  tone = 'green',
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'green' | 'red';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="ex-modal-back" onClick={onCancel}>
      <div
        className="ex-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <p className="ex-modal-title">{title}</p>
        <div className="ex-modal-body">{body}</div>
        <div className="ex-modal-actions">
          <button type="button" className="prx-btn alt" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`prx-btn${tone === 'red' ? ' danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
