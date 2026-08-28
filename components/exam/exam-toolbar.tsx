'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  subscribe as subscribeTheme,
  getSnapshot as getThemeSnapshot,
  getServerSnapshot as getThemeServerSnapshot,
  STORAGE_KEY as THEME_KEY,
} from '@/components/theme-toggle';
import { FONTSIZE_KEY, type FontSize } from '@/components/exam/exam-chrome';

/**
 * The Bluebook-style toolbar that lives in `ExamTopBar`'s `right` slot:
 * Fullscreen, Annotate, Appearance, Calculator, Reference, More. Shared by
 * Practice and Mock so both exam surfaces stay in sync. Prefix .ex-*.
 */

export type MenuKey = 'appearance' | 'calculator' | 'reference' | 'more';

export const READING_DIRECTIONS =
  'Read each passage (or pair of passages) and then answer the question that follows, based on what is stated or implied in the passage(s) and in any introductory material provided.';

export const MATH_DIRECTIONS =
  'Solve each problem, using any available space for scratch work. Choose the best answer from the choices given, or enter your answer if no choices are given.';

// ─── shared: outside-click / Escape dismiss (cloned from ExamNavigator) ───────

function usePopoverDismiss(
  open: boolean,
  boxRef: RefObject<HTMLDivElement | null>,
  onOpenChange: (open: boolean) => void
) {
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) onOpenChange(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, boxRef, onOpenChange]);
}

/** Icon trigger + anchored popover — the shell every menu below is built on. */
function MenuBox({
  label,
  icon,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  usePopoverDismiss(open, boxRef, onOpenChange);

  return (
    <div className="ex-menu-box" ref={boxRef}>
      <button
        type="button"
        className={`ex-tool${open ? ' on' : ''}`}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        {icon}
      </button>
      {open && (
        <div className="ex-menu-pop" role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Fullscreen ─────────────────────────────────────────────────────────────

export function FullscreenToggle() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    function onChange() {
      setActive(document.fullscreenElement != null);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        // fullscreen can be denied (e.g. iframe without allow="fullscreen") — no-op
      });
    }
  }, []);

  return (
    <button
      type="button"
      className={`ex-tool${active ? ' on' : ''}`}
      onClick={toggle}
      aria-pressed={active}
      title={active ? 'Exit full screen' : 'Full screen'}
    >
      <span aria-hidden="true">⛶</span>
    </button>
  );
}

// ─── Annotate ───────────────────────────────────────────────────────────────

export function AnnotateToggle({
  on,
  onToggle,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`ex-tool${on ? ' on' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      title={disabled ? 'No passage to annotate' : 'Tap words to highlight them'}
    >
      <span aria-hidden="true">🔖</span>
    </button>
  );
}

// ─── Appearance ─────────────────────────────────────────────────────────────

const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'large', label: 'Large' },
  { id: 'xl', label: 'Extra large' },
];

export function AppearanceMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  // Lazy initializer, not an effect: localStorage is the source of truth
  // here (the DOM attribute ExamRoot sets is a one-way broadcast for CSS, so
  // reading it back would race ExamRoot's own mount effect) — and this
  // component only ever mounts client-side, inside ExamRoot, so a
  // synchronous localStorage read has no hydration-mismatch risk to guard.
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    try {
      const saved = localStorage.getItem(FONTSIZE_KEY);
      return saved === 'large' || saved === 'xl' ? saved : 'standard';
    } catch {
      return 'standard';
    }
  });

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
  }

  function setFontSize(next: FontSize) {
    setFontSizeState(next);
    if (next === 'standard') {
      document.documentElement.removeAttribute('data-fontsize');
      try {
        localStorage.removeItem(FONTSIZE_KEY);
      } catch {
        // ignore
      }
    } else {
      document.documentElement.setAttribute('data-fontsize', next);
      try {
        localStorage.setItem(FONTSIZE_KEY, next);
      } catch {
        // ignore
      }
    }
  }

  return (
    <MenuBox label="Appearance" icon={<span aria-hidden="true">🎨</span>} open={open} onOpenChange={onOpenChange}>
      <p className="ex-menu-label">Theme</p>
      <button type="button" className="ex-menu-row" onClick={toggleTheme}>
        <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
        <span aria-hidden="true">{theme === 'dark' ? '🌙' : '☀'}</span>
      </button>
      <p className="ex-menu-label">Reading text size</p>
      {FONT_SIZES.map(f => (
        <button
          key={f.id}
          type="button"
          className={`ex-menu-row${fontSize === f.id ? ' on' : ''}`}
          onClick={() => setFontSize(f.id)}
        >
          <span>{f.label}</span>
          {fontSize === f.id && <span aria-hidden="true">✓</span>}
        </button>
      ))}
    </MenuBox>
  );
}

// ─── Calculator ─────────────────────────────────────────────────────────────

type Op = '+' | '-' | '×' | '÷';

function computeOp(a: number, b: number, op: Op): number | 'error' {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? 'error' : a / b;
  }
}

/** Trims floating-point noise (0.1 + 0.2) without truncating real precision. */
function formatResult(n: number): string {
  return Number(n.toPrecision(12)).toString();
}

export function CalculatorButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Op | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [error, setError] = useState(false);

  function reset() {
    setDisplay('0');
    setStored(null);
    setPendingOp(null);
    setOverwrite(true);
    setError(false);
  }

  function pressDigit(d: string) {
    if (error) return;
    if (overwrite) {
      setDisplay(d === '.' ? '0.' : d);
      setOverwrite(false);
      return;
    }
    if (d === '.' && display.includes('.')) return;
    setDisplay(display === '0' && d !== '.' ? d : display + d);
  }

  function pressOp(op: Op) {
    if (error) return;
    const current = Number.parseFloat(display);
    if (stored !== null && pendingOp && !overwrite) {
      const result = computeOp(stored, current, pendingOp);
      if (result === 'error') {
        setError(true);
        setDisplay('Error');
        setStored(null);
        setPendingOp(null);
        return;
      }
      setStored(result);
      setDisplay(formatResult(result));
    } else {
      setStored(current);
    }
    setPendingOp(op);
    setOverwrite(true);
  }

  function pressEquals() {
    if (error || pendingOp === null || stored === null) return;
    const current = Number.parseFloat(display);
    const result = computeOp(stored, current, pendingOp);
    if (result === 'error') {
      setError(true);
      setDisplay('Error');
      setStored(null);
      setPendingOp(null);
      return;
    }
    setDisplay(formatResult(result));
    setStored(null);
    setPendingOp(null);
    setOverwrite(true);
  }

  function pressSign() {
    if (error || display === '0') return;
    setDisplay(display.startsWith('-') ? display.slice(1) : `-${display}`);
  }

  function pressPercent() {
    if (error) return;
    setDisplay(formatResult(Number.parseFloat(display) / 100));
    setOverwrite(true);
  }

  const keys: { label: string; onPress: () => void; cls?: string }[] = [
    { label: 'C', onPress: reset, cls: 'fn' },
    { label: '±', onPress: pressSign, cls: 'fn' },
    { label: '%', onPress: pressPercent, cls: 'fn' },
    { label: '÷', onPress: () => pressOp('÷'), cls: 'op' },
    { label: '7', onPress: () => pressDigit('7') },
    { label: '8', onPress: () => pressDigit('8') },
    { label: '9', onPress: () => pressDigit('9') },
    { label: '×', onPress: () => pressOp('×'), cls: 'op' },
    { label: '4', onPress: () => pressDigit('4') },
    { label: '5', onPress: () => pressDigit('5') },
    { label: '6', onPress: () => pressDigit('6') },
    { label: '−', onPress: () => pressOp('-'), cls: 'op' },
    { label: '1', onPress: () => pressDigit('1') },
    { label: '2', onPress: () => pressDigit('2') },
    { label: '3', onPress: () => pressDigit('3') },
    { label: '+', onPress: () => pressOp('+'), cls: 'op' },
    { label: '0', onPress: () => pressDigit('0'), cls: 'zero' },
    { label: '.', onPress: () => pressDigit('.') },
    { label: '=', onPress: pressEquals, cls: 'eq' },
  ];

  return (
    <MenuBox label="Calculator" icon={<span aria-hidden="true">🧮</span>} open={open} onOpenChange={onOpenChange}>
      <div className="ex-calc">
        <div className="ex-calc-display" aria-live="polite">
          {display}
        </div>
        <div className="ex-calc-pad">
          {keys.map(k => (
            <button
              key={k.label}
              type="button"
              className={`ex-calc-key${k.cls ? ` ${k.cls}` : ''}`}
              onClick={k.onPress}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
    </MenuBox>
  );
}

// ─── Reference sheet ────────────────────────────────────────────────────────

const REFERENCE_ROWS: { label: string; body: string }[] = [
  { label: 'Circle', body: 'A = πr²   C = 2πr' },
  { label: 'Rectangle', body: 'A = lw' },
  { label: 'Triangle', body: 'A = ½bh' },
  { label: 'Triangle angles', body: 'Interior angles sum to 180°' },
  { label: 'Right triangle', body: 'a² + b² = c²' },
  { label: 'Special right triangles', body: '30-60-90 → x, x√3, 2x  ·  45-45-90 → x, x, x√2' },
  { label: 'Rectangular solid', body: 'V = lwh' },
  { label: 'Cylinder', body: 'V = πr²h' },
  { label: 'Cone', body: 'V = ⅓πr²h' },
  { label: 'Sphere', body: 'V = 4∕3 πr³' },
  { label: 'Full circle', body: '360° = 2π radians' },
];

export function ReferenceButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <MenuBox label="Reference" icon={<span aria-hidden="true">📐</span>} open={open} onOpenChange={onOpenChange}>
      <div className="ex-ref">
        {REFERENCE_ROWS.map(r => (
          <div key={r.label} className="ex-ref-row">
            <span className="ex-ref-lbl">{r.label}</span>
            <span className="ex-ref-body">{r.body}</span>
          </div>
        ))}
      </div>
    </MenuBox>
  );
}

// ─── More ───────────────────────────────────────────────────────────────────

export function MoreMenu({
  open,
  onOpenChange,
  lineReaderOn,
  onToggleLineReader,
  markCount,
  onClearMarks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineReaderOn: boolean;
  onToggleLineReader: () => void;
  markCount: number;
  onClearMarks: () => void;
}) {
  return (
    <MenuBox label="More" icon={<span aria-hidden="true">⋯</span>} open={open} onOpenChange={onOpenChange}>
      <button
        type="button"
        className={`ex-menu-row${lineReaderOn ? ' on' : ''}`}
        onClick={onToggleLineReader}
        aria-pressed={lineReaderOn}
      >
        <span>Line reader</span>
        <span aria-hidden="true">{lineReaderOn ? '● On' : 'Off'}</span>
      </button>
      <div className="ex-menu-row">
        <span>{markCount > 0 ? `${markCount} word${markCount === 1 ? '' : 's'} highlighted` : 'No highlights yet'}</span>
        {markCount > 0 && (
          <button type="button" className="ex-menu-clear" onClick={onClearMarks}>
            Clear
          </button>
        )}
      </div>
    </MenuBox>
  );
}

// ─── Line reader overlay ────────────────────────────────────────────────────

/**
 * A horizontal reading-guide band that tracks the pointer, dimming everything
 * above/below it via a single-element CSS "spotlight" (box-shadow) trick.
 * Rendered as the last child of `.ex-split`/`.ex-stage` (its own positioned
 * container) via those components' `overlay` prop.
 */
export function LineReaderOverlay({ active }: { active: boolean }) {
  const bandRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const band = bandRef.current;
    const container = band?.parentElement;
    if (!band || !container) return;
    const half = band.offsetHeight / 2;

    function onMove(e: PointerEvent) {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const rect = container!.getBoundingClientRect();
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        band!.style.transform = `translateY(${y - half}px)`;
      });
    }

    container.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      container.removeEventListener('pointermove', onMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  if (!active) return null;
  return <div ref={bandRef} className="ex-linereader-band" aria-hidden="true" />;
}
