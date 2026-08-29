'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

const SPLIT_KEY = 'taleem_practice_split';
const CALCULATOR_WIDTH_KEY = 'taleem_practice_calculator_width';
const ANSWER_WIDTH_KEY = 'taleem_practice_calculator_answer_width';

const DOCKING_BREAKPOINT = 1180;
const PHONE_BREAKPOINT = 760;
const HANDLE_WIDTH = 14;
const WORKSPACE_PADDING = 12;
const MIN_CALCULATOR_WIDTH = 340;
const MIN_QUESTION_WIDTH = 360;
const MIN_ANSWER_WIDTH = 330;
const DEFAULT_CALCULATOR_WIDTH = 460;
const DEFAULT_ANSWER_WIDTH = 410;
const DEFAULT_SPLIT = 50;
const MIN_SPLIT = 25;
const MAX_SPLIT = 75;

type DragTarget = 'calculator' | 'question-answer' | null;

type WorkspaceStyle = CSSProperties & {
  '--prw-split'?: string;
  '--prw-calculator-width'?: string;
  '--prw-answer-width'?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function readStoredNumber(key: string, fallback: number, min: number, max: number) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // Resizing remains available for this visit when storage is blocked.
  }
}

function subscribeNever() {
  return () => {};
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);

  return matches;
}

function resolveDesktopSizes(containerWidth: number, calculator: number, answers: number) {
  const usable = Math.max(
    MIN_CALCULATOR_WIDTH + MIN_QUESTION_WIDTH + MIN_ANSWER_WIDTH,
    containerWidth - WORKSPACE_PADDING * 2 - HANDLE_WIDTH * 2
  );
  const calculatorWidth = clamp(
    calculator,
    MIN_CALCULATOR_WIDTH,
    usable - MIN_QUESTION_WIDTH - MIN_ANSWER_WIDTH
  );
  const answerWidth = clamp(
    answers,
    MIN_ANSWER_WIDTH,
    usable - calculatorWidth - MIN_QUESTION_WIDTH
  );
  return { calculatorWidth, answerWidth };
}

export function PracticeWorkspace({
  question,
  answers,
  calculator,
  calculatorOpen,
  overlay,
}: {
  question: ReactNode;
  answers: ReactNode;
  calculator?: ReactNode;
  calculatorOpen: boolean;
  overlay?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<DragTarget>(null);
  const splitRef = useRef(DEFAULT_SPLIT);
  const calculatorWidthRef = useRef(DEFAULT_CALCULATOR_WIDTH);
  const answerWidthRef = useRef(DEFAULT_ANSWER_WIDTH);

  const [containerWidth, setContainerWidth] = useState(0);
  const storedSplit = useSyncExternalStore(
    subscribeNever,
    () => readStoredNumber(SPLIT_KEY, DEFAULT_SPLIT, MIN_SPLIT, MAX_SPLIT),
    () => DEFAULT_SPLIT
  );
  const storedCalculatorWidth = useSyncExternalStore(
    subscribeNever,
    () => readStoredNumber(
      CALCULATOR_WIDTH_KEY,
      clamp(window.innerWidth * 0.27, MIN_CALCULATOR_WIDTH, 520),
      MIN_CALCULATOR_WIDTH,
      920
    ),
    () => DEFAULT_CALCULATOR_WIDTH
  );
  const storedAnswerWidth = useSyncExternalStore(
    subscribeNever,
    () => readStoredNumber(
      ANSWER_WIDTH_KEY,
      clamp(window.innerWidth * 0.25, MIN_ANSWER_WIDTH, 460),
      MIN_ANSWER_WIDTH,
      920
    ),
    () => DEFAULT_ANSWER_WIDTH
  );
  const [liveSplit, setLiveSplit] = useState<number | null>(null);
  const [liveCalculatorWidth, setLiveCalculatorWidth] = useState<number | null>(null);
  const [liveAnswerWidth, setLiveAnswerWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const split = liveSplit ?? storedSplit;
  const calculatorWidth = liveCalculatorWidth ?? storedCalculatorWidth;
  const answerWidth = liveAnswerWidth ?? storedAnswerWidth;
  const compact = useMediaQuery(`(max-width: ${DOCKING_BREAKPOINT}px)`);
  const phone = useMediaQuery(`(max-width: ${PHONE_BREAKPOINT}px)`);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? container.getBoundingClientRect().width;
      setContainerWidth(width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const renderedSizes = useMemo(
    () => resolveDesktopSizes(containerWidth || windowFallbackWidth(), calculatorWidth, answerWidth),
    [answerWidth, calculatorWidth, containerWidth]
  );

  const setSplitValue = useCallback((value: number) => {
    const next = clamp(value, MIN_SPLIT, MAX_SPLIT);
    splitRef.current = next;
    setLiveSplit(next);
  }, []);

  const setCalculatorValue = useCallback((value: number) => {
    const next = clamp(value, MIN_CALCULATOR_WIDTH, 920);
    calculatorWidthRef.current = next;
    setLiveCalculatorWidth(next);
  }, []);

  const setAnswerValue = useCallback((value: number) => {
    const next = clamp(value, MIN_ANSWER_WIDTH, 920);
    answerWidthRef.current = next;
    setLiveAnswerWidth(next);
  }, []);

  const resizeFromPointer = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || phone) return;
      const contentLeft = rect.left + WORKSPACE_PADDING;
      const contentRight = rect.right - WORKSPACE_PADDING;

      if (draggingRef.current === 'calculator' && calculatorOpen && !compact) {
        const max =
          rect.width -
          WORKSPACE_PADDING * 2 -
          HANDLE_WIDTH * 2 -
          renderedSizes.answerWidth -
          MIN_QUESTION_WIDTH;
        setCalculatorValue(clamp(clientX - contentLeft, MIN_CALCULATOR_WIDTH, max));
        return;
      }

      if (draggingRef.current !== 'question-answer') return;
      if (calculatorOpen && !compact) {
        const usable =
          rect.width -
          WORKSPACE_PADDING * 2 -
          HANDLE_WIDTH * 2 -
          renderedSizes.calculatorWidth -
          MIN_QUESTION_WIDTH;
        setAnswerValue(clamp(contentRight - clientX, MIN_ANSWER_WIDTH, usable));
      } else {
        const available = rect.width - WORKSPACE_PADDING * 2 - HANDLE_WIDTH;
        const next = ((clientX - contentLeft) / available) * 100;
        setSplitValue(next);
      }
    },
    [calculatorOpen, compact, phone, renderedSizes, setAnswerValue, setCalculatorValue, setSplitValue]
  );

  const finishDrag = useCallback(() => {
    const target = draggingRef.current;
    if (!target) return;

    if (target === 'calculator') {
      writeStoredNumber(CALCULATOR_WIDTH_KEY, calculatorWidthRef.current);
    } else if (target === 'question-answer') {
      if (calculatorOpen && !compact) {
        writeStoredNumber(ANSWER_WIDTH_KEY, answerWidthRef.current);
      } else {
        writeStoredNumber(SPLIT_KEY, splitRef.current);
      }
    }
    draggingRef.current = null;
    setIsResizing(false);
  }, [calculatorOpen, compact]);

  const startDrag = useCallback(
    (target: Exclude<DragTarget, null>, event: ReactPointerEvent<HTMLDivElement>) => {
      if (phone || (target === 'calculator' && (!calculatorOpen || compact))) return;
      if (target === 'calculator') {
        calculatorWidthRef.current = calculatorWidth;
      } else if (calculatorOpen && !compact) {
        answerWidthRef.current = answerWidth;
      } else {
        splitRef.current = split;
      }
      draggingRef.current = target;
      setIsResizing(true);
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [answerWidth, calculatorOpen, calculatorWidth, compact, phone, split]
  );

  const nudgeCalculator = useCallback(
    (direction: -1 | 1) => {
      const usable =
        (containerWidth || windowFallbackWidth()) -
        WORKSPACE_PADDING * 2 -
        HANDLE_WIDTH * 2 -
        renderedSizes.answerWidth -
        MIN_QUESTION_WIDTH;
      const next = clamp(renderedSizes.calculatorWidth + direction * 20, MIN_CALCULATOR_WIDTH, usable);
      setCalculatorValue(next);
      writeStoredNumber(CALCULATOR_WIDTH_KEY, next);
    },
    [containerWidth, renderedSizes, setCalculatorValue]
  );

  const nudgeQuestionAnswer = useCallback(
    (direction: -1 | 1) => {
      if (calculatorOpen && !compact) {
        const usable =
          (containerWidth || windowFallbackWidth()) -
          WORKSPACE_PADDING * 2 -
          HANDLE_WIDTH * 2 -
          renderedSizes.calculatorWidth -
          MIN_QUESTION_WIDTH;
        const next = clamp(
          renderedSizes.answerWidth - direction * 20,
          MIN_ANSWER_WIDTH,
          usable
        );
        setAnswerValue(next);
        writeStoredNumber(ANSWER_WIDTH_KEY, next);
      } else {
        const next = clamp(split + direction * 2, MIN_SPLIT, MAX_SPLIT);
        setSplitValue(next);
        writeStoredNumber(SPLIT_KEY, next);
      }
    },
    [calculatorOpen, compact, containerWidth, renderedSizes, setAnswerValue, setSplitValue, split]
  );

  const style: WorkspaceStyle = {
    '--prw-split': `${split}%`,
    '--prw-calculator-width': `${renderedSizes.calculatorWidth}px`,
    '--prw-answer-width': `${renderedSizes.answerWidth}px`,
  };
  const questionAnswerValue = calculatorOpen && !compact
    ? Math.round(renderedSizes.answerWidth)
    : Math.round(split);

  return (
    <div
      ref={containerRef}
      className={`prw-workspace${calculatorOpen && calculator ? ' is-calculator-open' : ''}${isResizing ? ' is-resizing' : ''}`}
      style={style}
    >
      <div className="prw-calculator-slot">{calculator}</div>
      <div
        className="prw-divider prw-calculator-divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the calculator and question panels"
        aria-valuemin={MIN_CALCULATOR_WIDTH}
        aria-valuemax={Math.max(MIN_CALCULATOR_WIDTH, Math.round(containerWidth - MIN_QUESTION_WIDTH - MIN_ANSWER_WIDTH))}
        aria-valuenow={Math.round(renderedSizes.calculatorWidth)}
        tabIndex={calculatorOpen && !compact ? 0 : -1}
        onPointerDown={event => startDrag('calculator', event)}
        onPointerMove={event => resizeFromPointer(event.clientX)}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          nudgeCalculator(event.key === 'ArrowLeft' ? -1 : 1);
        }}
      />
      <div className="ex-split-pane prw-pane prw-question-pane">{question}</div>
      <div
        className="prw-divider prw-question-divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the question and answer panels"
        aria-valuemin={calculatorOpen && !compact ? MIN_ANSWER_WIDTH : MIN_SPLIT}
        aria-valuemax={calculatorOpen && !compact ? 920 : MAX_SPLIT}
        aria-valuenow={questionAnswerValue}
        tabIndex={phone ? -1 : 0}
        onPointerDown={event => startDrag('question-answer', event)}
        onPointerMove={event => resizeFromPointer(event.clientX)}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          nudgeQuestionAnswer(event.key === 'ArrowLeft' ? -1 : 1);
        }}
      />
      <div className="ex-split-pane prw-pane prw-answer-pane">{answers}</div>
      {overlay}
    </div>
  );
}

function windowFallbackWidth() {
  return typeof window === 'undefined' ? 1440 : window.innerWidth;
}
