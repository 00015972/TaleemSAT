'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import {
  ExamRoot,
  ExamTopBar,
  ExamSplit,
  ExamFooter,
  ExamNavigator,
} from '@/components/exam/exam-chrome';
import {
  AnnotateToggle,
  AppearanceMenu,
  CalculatorButton,
  ReferenceButton,
  MoreMenu,
  FullscreenToggle,
  LineReaderOverlay,
  READING_DIRECTIONS,
  MATH_DIRECTIONS,
  type MenuKey,
} from '@/components/exam/exam-toolbar';
import { PassageReader, type Tool } from '@/components/reading/passage-reader';
import { WhyPanel } from '@/components/reading/why-panel';
import { ChartFigure } from '@/components/reading/chart-figure';
import { QuestionBody } from '@/components/reading/question-body';
import { GridInInput } from '@/components/reading/grid-in-input';
import { PracticeBrowse, type PracticeScope } from '@/components/practice/practice-browse';
import type { PracticeOverview } from '@/lib/practice/overview';

const NO_MARKS: Set<number> = new Set();

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { id: string; text: string };

type Question = {
  id: string;
  passage: string | null;
  question_text: string;
  chart_svg: string | null;
  tables: string[] | null;
  question_type: 'mcq' | 'grid_in';
  options: Option[];
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
};

type ManifestEntry = { id: string; difficulty: 'easy' | 'medium' | 'hard' };

type Status = 'loading' | 'ready' | 'empty' | 'error';

// ─── Main component ───────────────────────────────────────────────────────────

export function PracticeShell({
  overview,
  pro = false,
}: {
  overview: PracticeOverview;
  pro?: boolean;
}) {
  const [scope, setScope] = useState<PracticeScope | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  // The ordered set for this scope — walked sequentially, not re-fetched.
  const [manifest, setManifest] = useState<ManifestEntry[] | null>(null);
  const [index, setIndex] = useState(0);
  const [current, setCurrent] = useState<Question | null>(null);
  const [currentLoading, setCurrentLoading] = useState(false);
  const cacheRef = useRef<Map<string, Question>>(new Map());

  // Per-question outcomes, keyed by question id so they survive paging away
  // and back via the navigator.
  const [tries, setTries] = useState<Record<string, string[]>>({});
  const [solvedAnswer, setSolvedAnswer] = useState<Record<string, string>>({});
  const [firstResult, setFirstResult] = useState<Record<string, boolean>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [eliminated, setEliminated] = useState<Record<string, string[]>>({});
  const [elimMode, setElimMode] = useState(false);

  // Reading-tool state — lifted so the top-bar Annotate toggle and the
  // Highlights list in More can see/drive it, and so highlights survive
  // paging away from a question and back (they didn't before).
  const [marks, setMarks] = useState<Record<string, Set<number>>>({});
  const [readingTool, setReadingTool] = useState<Tool>('define');
  const [lineReaderOn, setLineReaderOn] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);

  // Transient, current-question-only state.
  const [picked, setPicked] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [qStartedAt, setQStartedAt] = useState<number | null>(null);

  const loadQuestion = useCallback(async (id: string): Promise<Question | null> => {
    const hit = cacheRef.current.get(id);
    if (hit) return hit;
    try {
      const res = await fetch(`/api/practice/question?id=${id}`);
      const data = (await res.json()) as { question?: Question };
      if (!res.ok || !data.question) return null;
      cacheRef.current.set(id, data.question);
      return data.question;
    } catch {
      return null;
    }
  }, []);

  const prefetch = useCallback(
    (id: string | undefined) => {
      if (!id || cacheRef.current.has(id)) return;
      void loadQuestion(id);
    },
    [loadQuestion]
  );

  const goTo = useCallback(
    async (i: number, manifestOverride?: ManifestEntry[]) => {
      const list = manifestOverride ?? manifest;
      if (!list) return;
      const clamped = Math.min(Math.max(i, 0), list.length - 1);
      // Re-landing on the question already on screen (boundary Next/Back, or
      // re-clicking the current bubble) shouldn't clobber an in-progress pick.
      if (!manifestOverride && clamped === index) return;
      const entry = list[clamped];
      setIndex(clamped);
      setPicked(null);

      const hit = cacheRef.current.get(entry.id);
      if (hit) {
        setCurrent(hit);
        setQStartedAt(Date.now());
      } else {
        setCurrentLoading(true);
        setCurrent(null);
        const q = await loadQuestion(entry.id);
        setCurrentLoading(false);
        setCurrent(q);
        setQStartedAt(Date.now());
      }
      prefetch(list[clamped + 1]?.id);
      prefetch(list[clamped - 1]?.id);
    },
    [manifest, index, loadQuestion, prefetch]
  );

  async function startScope(target: PracticeScope) {
    setScope(target);
    setStatus('loading');
    setManifest(null);
    setIndex(0);
    setCurrent(null);
    cacheRef.current = new Map();
    setTries({});
    setSolvedAnswer({});
    setFirstResult({});
    setFlagged(new Set());
    setEliminated({});
    setElimMode(false);
    setMarks({});
    setReadingTool('define');
    setLineReaderOn(false);
    setOpenMenu(null);

    try {
      const scopeKey =
        target.kind === 'topic'
          ? 'topicSlug'
          : target.kind === 'category'
            ? 'categorySlug'
            : 'subjectSlug';
      const params = new URLSearchParams({ [scopeKey]: target.slug });
      if (target.difficulty !== 'all') params.set('difficulty', target.difficulty);
      const res = await fetch(`/api/practice/manifest?${params}`);
      const data = (await res.json()) as { ids?: ManifestEntry[] };
      if (!res.ok || !data.ids || data.ids.length === 0) {
        setStatus('empty');
        return;
      }
      setManifest(data.ids);
      setStatus('ready');
      await goTo(0, data.ids);
    } catch {
      setStatus('error');
    }
  }

  function backToTopics() {
    setScope(null);
  }

  const toggleFlag = useCallback((id: string) => {
    setFlagged(f => {
      const next = new Set(f);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleElim = useCallback((id: string, optionId: string) => {
    setEliminated(cur => {
      const list = cur[id] ?? [];
      return {
        ...cur,
        [id]: list.includes(optionId) ? list.filter(x => x !== optionId) : [...list, optionId],
      };
    });
  }, []);

  const setMarksFor = useCallback((id: string, next: Set<number>) => {
    setMarks(m => ({ ...m, [id]: next }));
  }, []);

  const selectOption = useCallback(
    (id: string, optionId: string) => {
      if (solvedAnswer[id] !== undefined) return;
      if ((tries[id] ?? []).includes(optionId)) return;
      setPicked(optionId);
    },
    [solvedAnswer, tries]
  );

  const checkAnswer = useCallback(async () => {
    if (!manifest || !current || !picked) return;
    const id = manifest[index].id;
    const isFirst = firstResult[id] === undefined;
    setChecking(true);
    try {
      const res = await fetch('/api/practice/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: id,
          selectedAnswer: picked,
          timeTakenMs: isFirst && qStartedAt ? Date.now() - qStartedAt : undefined,
          recordAttempt: isFirst,
        }),
      });
      const data = (await res.json()) as { isCorrect: boolean };
      if (isFirst) setFirstResult(r => ({ ...r, [id]: data.isCorrect }));
      if (data.isCorrect) {
        setSolvedAnswer(s => ({ ...s, [id]: picked }));
      } else {
        setTries(t => ({ ...t, [id]: [...(t[id] ?? []), picked] }));
      }
      // Either way the pick has been consumed: correct is now redundant with
      // solvedAnswer, wrong needs a fresh pick before Check re-enables.
      setPicked(null);
    } catch {
      // leave the pick in place so the student can just retry Check
    } finally {
      setChecking(false);
    }
  }, [manifest, current, picked, index, firstResult, qStartedAt]);

  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const goBack = useCallback(() => goTo(index - 1), [goTo, index]);

  const currentId = manifest?.[index]?.id;
  const resolved = currentId !== undefined && solvedAnswer[currentId] !== undefined;
  // Practice questions carry no subject field — passage presence is the same
  // proxy the Mock runner already uses for its own Reading-vs-Math ternary.
  const directionsText = current ? (current.passage ? READING_DIRECTIONS : MATH_DIRECTIONS) : undefined;

  // A–D/1–4 to pick, Enter to check-or-continue, ←/→ to page, F to flag.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!manifest || !current || !currentId) return;

      const letter = e.key.toUpperCase();
      if (letter === 'F') {
        e.preventDefault();
        toggleFlag(currentId);
        return;
      }
      if (!resolved) {
        const opts = current.options;
        let id: string | undefined;
        if (letter >= 'A' && letter <= 'D') {
          id = opts.find(o => o.id === letter)?.id ?? opts[letter.charCodeAt(0) - 65]?.id;
        } else if (e.key >= '1' && e.key <= '4') {
          id = opts[Number(e.key) - 1]?.id;
        }
        if (id) {
          e.preventDefault();
          selectOption(currentId, id);
          return;
        }
      }
      if ((e.target as HTMLElement | null)?.closest('button, [role="button"]')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!resolved && picked) checkAnswer();
        else if (resolved) goNext();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manifest, current, currentId, resolved, picked, selectOption, checkAnswer, goNext, goBack, toggleFlag]);

  // No scope chosen yet — browse the topics, sidebar and all.
  if (!scope) {
    return <PracticeBrowse overview={overview} onStart={startScope} />;
  }

  return (
    <ExamRoot variant="practice">
      <ExamTopBar
        title={scope.label}
        subtitle={scope.difficulty !== 'all' ? `${scope.difficulty} difficulty` : undefined}
        directions={directionsText}
        onExit={backToTopics}
        exitLabel="All topics"
        center={
          status !== 'ready' ? undefined : currentLoading || !current ? (
            <span className="ex-clock big">--:--</span>
          ) : (
            <QuestionTimer key={currentId} startedAt={qStartedAt} frozen={resolved} />
          )
        }
        right={
          <>
            <AnnotateToggle
              on={readingTool === 'highlight'}
              onToggle={() => setReadingTool(t => (t === 'highlight' ? 'define' : 'highlight'))}
              disabled={!current?.passage}
            />
            <AppearanceMenu
              open={openMenu === 'appearance'}
              onOpenChange={v => setOpenMenu(v ? 'appearance' : null)}
            />
            <CalculatorButton
              open={openMenu === 'calculator'}
              onOpenChange={v => setOpenMenu(v ? 'calculator' : null)}
            />
            <ReferenceButton
              open={openMenu === 'reference'}
              onOpenChange={v => setOpenMenu(v ? 'reference' : null)}
            />
            <MoreMenu
              open={openMenu === 'more'}
              onOpenChange={v => setOpenMenu(v ? 'more' : null)}
              lineReaderOn={lineReaderOn}
              onToggleLineReader={() => setLineReaderOn(v => !v)}
              markCount={currentId ? (marks[currentId]?.size ?? 0) : 0}
              onClearMarks={() => currentId && setMarksFor(currentId, new Set())}
            />
            <FullscreenToggle />
          </>
        }
      />

      {status === 'loading' && (
        <CenteredStage>
          <LoadingSkeleton />
        </CenteredStage>
      )}
      {(status === 'empty' || status === 'error') && (
        <CenteredStage>
          <EmptyState
            title={status === 'error' ? "Couldn't load this set." : 'Nothing here yet.'}
            body={
              status === 'error'
                ? 'Something went wrong reaching the question bank. Try again.'
                : "No questions match this difficulty yet. Try a different difficulty, or another topic."
            }
            onReset={backToTopics}
          />
        </CenteredStage>
      )}

      {status === 'ready' && manifest && currentId && (
        <ExamSplit
          storageKey="taleem_practice_split"
          showWatermark={false}
          overlay={<LineReaderOverlay active={lineReaderOn} />}
          left={
            <QuestionPane
              seq={index + 1}
              question={current}
              loading={currentLoading}
              pro={pro}
              marks={currentId ? (marks[currentId] ?? NO_MARKS) : NO_MARKS}
              onMarksChange={next => currentId && setMarksFor(currentId, next)}
              tool={readingTool}
              onToolChange={setReadingTool}
            />
          }
          right={
            <ChoicesPane
              question={current}
              loading={currentLoading}
              picked={picked}
              tries={tries[currentId] ?? []}
              solvedAnswer={solvedAnswer[currentId]}
              firstCorrect={firstResult[currentId]}
              flagged={flagged.has(currentId)}
              eliminated={eliminated[currentId] ?? []}
              elimMode={elimMode}
              checking={checking}
              pro={pro}
              onSelect={optId => selectOption(currentId, optId)}
              onCheck={checkAnswer}
              onToggleFlag={() => toggleFlag(currentId)}
              onToggleElim={optId => toggleElim(currentId, optId)}
              onToggleElimMode={() => setElimMode(m => !m)}
            />
          }
        />
      )}

      <ExamFooter
        left={
          <span className="ex-hint">
            A–D to choose · Enter to check · ←/→ to page · F to flag
          </span>
        }
        center={
          status === 'ready' && manifest ? (
            <ExamNavigator
              index={index}
              total={manifest.length}
              onJump={goTo}
              bubbleClass={i => {
                const m = manifest[i];
                const r = firstResult[m.id];
                const cls = r === true ? 'ok' : r === false ? 'bad' : '';
                return `${cls}${flagged.has(m.id) ? ' flag' : ''}`;
              }}
              legend={
                <>
                  <span className="ex-lg"><i className="ex-lg-dot ok" /> Correct</span>
                  <span className="ex-lg"><i className="ex-lg-dot bad" /> Incorrect</span>
                  <span className="ex-lg"><i className="ex-lg-dot flag" /> Marked</span>
                </>
              }
            />
          ) : undefined
        }
        right={
          status === 'ready' && manifest ? (
            <div className="ex-pager">
              <button className="ex-page-btn" onClick={goBack} disabled={index === 0}>
                <ChevronLeft aria-hidden="true" /> Back
              </button>
              <button
                className="ex-page-btn next"
                onClick={goNext}
                disabled={index === manifest.length - 1}
              >
                Next <ChevronRight aria-hidden="true" />
              </button>
            </div>
          ) : undefined
        }
      />
    </ExamRoot>
  );
}

// ─── Question pane (left) ──────────────────────────────────────────────────────

function QuestionPane({
  seq,
  question,
  loading,
  pro,
  marks,
  onMarksChange,
  tool,
  onToolChange,
}: {
  seq: number;
  question: Question | null;
  loading: boolean;
  pro: boolean;
  marks: Set<number>;
  onMarksChange: (next: Set<number>) => void;
  tool: Tool;
  onToolChange: (next: Tool) => void;
}) {
  if (loading || !question) return <PaneSkeleton />;
  return (
    <>
      <div className="ex-q-head">
        <div className="ex-q-head-left">
          <span className="ex-qnum">{seq}</span>
          <DifficultyBadge difficulty={question.difficulty} />
        </div>
        <span className="ex-practice-mode">Practice mode</span>
      </div>
      {question.passage && (
        <PassageReader
          text={question.passage}
          variant="practice"
          pro={pro}
          marks={marks}
          onMarksChange={onMarksChange}
          tool={tool}
          onToolChange={onToolChange}
        />
      )}
      <ChartFigure svg={question.chart_svg} />
      <QuestionBody text={question.question_text} tables={question.tables} className="ex-stem" />
    </>
  );
}

// ─── Choices pane (right) ──────────────────────────────────────────────────────

function ChoicesPane({
  question,
  loading,
  picked,
  tries,
  solvedAnswer,
  firstCorrect,
  flagged,
  eliminated,
  elimMode,
  checking,
  pro,
  onSelect,
  onCheck,
  onToggleFlag,
  onToggleElim,
  onToggleElimMode,
}: {
  question: Question | null;
  loading: boolean;
  picked: string | null;
  tries: string[];
  solvedAnswer: string | undefined;
  firstCorrect: boolean | undefined;
  flagged: boolean;
  eliminated: string[];
  elimMode: boolean;
  checking: boolean;
  pro: boolean;
  onSelect: (optionId: string) => void;
  onCheck: () => void;
  onToggleFlag: () => void;
  onToggleElim: (optionId: string) => void;
  onToggleElimMode: () => void;
}) {
  if (loading || !question) return <PaneSkeleton />;

  const isGridIn = question.question_type === 'grid_in';
  const resolved = solvedAnswer !== undefined;
  const canCheck = !!picked?.trim() && !resolved && !tries.includes(picked ?? '') && !checking;

  return (
    <>
      <div className="ex-toolbar">
        <button
          type="button"
          className={`ex-mark${flagged ? ' on' : ''}`}
          onClick={onToggleFlag}
          aria-pressed={flagged}
        >
          <Bookmark aria-hidden="true" /> {flagged ? 'Marked' : 'Mark for review'}
        </button>
        <div className="ex-toolbar-right">
          {!isGridIn && (
            <button
              type="button"
              className={`ex-tool${elimMode ? ' on' : ''}`}
              onClick={onToggleElimMode}
              disabled={resolved}
              aria-pressed={elimMode}
              title="Cross out answer choices"
            >
              <span className="ex-abc">ABC</span>
            </button>
          )}
          {resolved ? (
            <span className="ex-solved-pill">{firstCorrect ? '✓ Correct' : '✓ Found it'}</span>
          ) : (
            <button type="button" className="prx-btn" onClick={onCheck} disabled={!canCheck}>
              {checking ? 'Checking…' : 'Check answer'}
            </button>
          )}
        </div>
      </div>

      {isGridIn ? (
        <GridInInput
          value={resolved ? (solvedAnswer ?? '') : (picked ?? '')}
          onChange={onSelect}
          onEnter={canCheck ? onCheck : undefined}
          disabled={resolved}
          state={resolved ? 'key' : undefined}
          tries={tries}
        />
      ) : (
        <ChoiceList
          options={question.options}
          picked={picked}
          tries={tries}
          solvedAnswer={solvedAnswer ?? null}
          eliminated={eliminated}
          elimMode={elimMode && !resolved}
          interactive={!resolved}
          onSelect={onSelect}
          onElim={onToggleElim}
        />
      )}

      {resolved && <WhyPanel questionId={question.id} pro={pro} />}
    </>
  );
}

function ChoiceList({
  options,
  picked,
  tries,
  solvedAnswer,
  eliminated,
  elimMode,
  interactive,
  onSelect,
  onElim,
}: {
  options: Option[];
  picked: string | null;
  tries: string[];
  solvedAnswer: string | null;
  eliminated: string[];
  elimMode: boolean;
  interactive: boolean;
  onSelect: (id: string) => void;
  onElim: (id: string) => void;
}) {
  return (
    <div className="prx-opts" role="group" aria-label="Answer choices">
      {options.map((opt, i) => {
        const isTried = tries.includes(opt.id);
        const isKey = solvedAnswer === opt.id;
        const isElim = eliminated.includes(opt.id);
        const isPicked = picked === opt.id;
        const selectable = interactive && !isTried;

        let cls = '';
        if (isKey) cls = ' key';
        else if (isTried) cls = ' tried';
        else if (isPicked) cls = ' sel';
        if (isElim && !isTried) cls += ' elim';

        return (
          <div
            key={opt.id}
            role="button"
            tabIndex={selectable ? 0 : -1}
            aria-disabled={!selectable}
            className={`prx-opt prx-anim${cls}`}
            style={{ animationDelay: `${0.08 + i * 0.04}s` }}
            onClick={() => selectable && onSelect(opt.id)}
            onKeyDown={e => {
              if (!selectable) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(opt.id);
              }
            }}
            aria-pressed={isPicked}
          >
            <span className="prx-opt-bub">
              <span>{opt.id}</span>
            </span>
            <span className="prx-opt-text" dangerouslySetInnerHTML={{ __html: opt.text }} />
            {isKey && <span className="prx-opt-flag" style={{ color: 'var(--ok)' }}>✓</span>}
            {isTried && <span className="prx-opt-flag" style={{ color: 'var(--err)' }}>✗</span>}
            {interactive && elimMode && !isTried && (
              <button
                type="button"
                className="mk-elim-btn show"
                onClick={e => {
                  e.stopPropagation();
                  onElim(opt.id);
                }}
                aria-label={isElim ? 'Restore choice' : 'Eliminate choice'}
                title="Cross out"
              >
                {isElim ? <RotateCcw aria-hidden="true" /> : <X aria-hidden="true" />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ticks once a second while the question is unsolved; freezes once it's not.
 * Mounted fresh per question (keyed by question id in the caller) so its
 * clock naturally starts at zero — no reset-on-prop-change effect needed.
 */
function QuestionTimer({ startedAt, frozen }: { startedAt: number | null; frozen: boolean }) {
  const [now, setNow] = useState(() => startedAt ?? Date.now());

  useEffect(() => {
    if (frozen || startedAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [frozen, startedAt]);

  const elapsed = startedAt == null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <span className="ex-practice-timer">
      <span className="ex-clock big">{formatClock(elapsed)}</span>
      <span className="ex-practice-timer-label">Time on question</span>
    </span>
  );
}

function formatClock(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return <span className={`prx-diff ${difficulty}`}>{difficulty}</span>;
}

function CenteredStage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '42rem' }}>{children}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="prx-card flex flex-col gap-4 animate-pulse" aria-label="Loading question set">
      <div className="h-4 w-32 rounded" style={{ background: 'var(--border)' }} />
      <div className="h-20 rounded" style={{ background: 'var(--bg)' }} />
      <div className="h-5 w-3/4 rounded" style={{ background: 'var(--border)' }} />
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-12 rounded" style={{ background: 'var(--bg)' }} />
      ))}
    </div>
  );
}

/** Lightweight per-pane placeholder while a prefetch-miss loads. */
function PaneSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse" aria-label="Loading">
      <div className="h-4 w-24 rounded" style={{ background: 'var(--border)' }} />
      <div className="h-4 w-full rounded" style={{ background: 'var(--border)' }} />
      <div className="h-4 w-5/6 rounded" style={{ background: 'var(--border)' }} />
      <div className="h-4 w-2/3 rounded" style={{ background: 'var(--border)' }} />
    </div>
  );
}

function EmptyState({
  title,
  body,
  onReset,
}: {
  title: string;
  body: string;
  onReset: () => void;
}) {
  return (
    <div className="prx-empty">
      <div className="prx-idle-bubs" aria-hidden="true">
        {['A', 'B', 'C', 'D'].map(l => (
          <span key={l} className="prx-idle-bub done">{l}</span>
        ))}
      </div>
      <p className="prx-empty-title">{title}</p>
      <p className="prx-empty-sub mb-4">{body}</p>
      <button onClick={onReset} className="prx-btn">
        Back to topics
      </button>
    </div>
  );
}
