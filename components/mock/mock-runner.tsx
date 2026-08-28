'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RadarChart, ScoreRing } from '@/components/analytics/charts';
import {
  ExamClock,
  ExamDialog,
  ExamFooter,
  ExamNavigator,
  ExamRoot,
  ExamStage,
  ExamTopBar,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { id: string; text: string };

type MockQuestion = {
  id: string;
  passage: string | null;
  question_text: string;
  chart_svg: string | null;
  tables: string[] | null;
  question_type: 'mcq' | 'grid_in';
  options: Option[];
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  category: string;
  subjectSlug: string;
  subject: string;
};

type RawQuestion = Omit<MockQuestion, 'options'> & { options: unknown };

type Result = {
  questionId: string;
  correctAnswer: string | null;
  isCorrect: boolean;
  explanation: string | null;
};

type Conf = 'sure' | 'unsure' | 'guess';
type Subject = 'mixed' | 'english' | 'math';
type Status = 'setup' | 'loading' | 'running' | 'submitting' | 'done' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeOptions(raw: unknown): Option[] {
  if (Array.isArray(raw)) {
    return raw
      .filter(
        (o): o is { id: unknown; text: unknown } =>
          !!o && typeof o === 'object' && 'id' in o && 'text' in o
      )
      .map(o => ({ id: String(o.id), text: String(o.text) }));
  }
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    return (['A', 'B', 'C', 'D'] as const)
      .filter(k => k in rec)
      .map(k => ({ id: k, text: String(rec[k]) }));
  }
  return [];
}

function formatClock(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function scoreMessage(accuracy: number) {
  if (accuracy >= 0.85) return 'Excellent work — keep pushing for a perfect score.';
  if (accuracy >= 0.65) return 'Good effort. Focus on your weak spots below.';
  return 'Keep studying — every test makes you stronger.';
}

const SUBJECT_LABEL: Record<Subject, string> = {
  mixed: 'Mixed',
  english: 'Reading & Writing',
  math: 'Math',
};

const NO_MARKS: Set<number> = new Set();

// ─── Main component ───────────────────────────────────────────────────────────

export function MockRunner({ pro = false }: { pro?: boolean }) {
  const [status, setStatus] = useState<Status>('setup');
  const [subject, setSubject] = useState<Subject>('mixed');
  const [count, setCount] = useState(10);
  const [examMode, setExamMode] = useState(false);

  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [eliminated, setEliminated] = useState<Record<string, string[]>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [confidence, setConfidence] = useState<Record<string, Conf>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  // Highlights live here, not inside the reader, so they survive paging away
  // from a question and back.
  const [marks, setMarks] = useState<Record<string, Set<number>>>({});

  // One question on screen at a time — `index` while testing, `review` after.
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState<number | null>(null);
  const [elimMode, setElimMode] = useState(false);
  const [hideClock, setHideClock] = useState(false);
  const [dialog, setDialog] = useState<null | 'exit' | 'finish'>(null);

  // Reading-tool state — mirrors Practice's lifted state so the shared
  // toolbar (Annotate/More's Highlights list/Line reader) works the same way.
  const [readingTool, setReadingTool] = useState<Tool>('define');
  const [lineReaderOn, setLineReaderOn] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);

  const [spent, setSpent] = useState<Record<string, number>>({});
  const [startedAt, setStartedAt] = useState<number>(0);
  const [now, setNow] = useState<number>(0);

  const scored = status === 'done';
  const examTotal = count * 90; // ~1.5 min/question
  const current = questions[index] ?? null;
  const directionsText = current
    ? current.subjectSlug === 'math'
      ? MATH_DIRECTIONS
      : READING_DIRECTIONS
    : undefined;

  const elapsed =
    status === 'running' || status === 'submitting'
      ? Math.max(0, Math.floor((now - startedAt) / 1000))
      : 0;
  const remaining = examMode ? Math.max(0, examTotal - elapsed) : null;

  // ── per-question stopwatch ──
  // The effect's cleanup banks the time the moment you leave a question, so
  // paging back and forth accumulates rather than overwrites.
  const qStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (status !== 'running') return;
    const qid = questions[index]?.id;
    if (!qid) return;
    const enteredAt = Date.now();
    qStartRef.current = enteredAt;
    return () => {
      const delta = Date.now() - enteredAt;
      if (delta > 0) setSpent(s => ({ ...s, [qid]: (s[qid] ?? 0) + delta }));
    };
  }, [status, index, questions]);

  // ── lifecycle: load a test ──
  const start = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/mock/start?subject=${subject}&count=${count}`);
      const data = (await res.json()) as { questions?: RawQuestion[] };
      if (!res.ok || !data.questions || data.questions.length === 0) {
        setStatus('error');
        return;
      }
      const qs: MockQuestion[] = data.questions.map(q => ({
        ...q,
        options: normalizeOptions(q.options),
      }));
      setQuestions(qs);
      setAnswers({});
      setEliminated({});
      setFlagged(new Set());
      setConfidence({});
      setResults({});
      setMarks({});
      setSpent({});
      setIndex(0);
      setReview(null);
      setElimMode(false);
      setHideClock(false);
      setReadingTool('define');
      setLineReaderOn(false);
      setOpenMenu(null);
      setStartedAt(Date.now());
      setNow(Date.now());
      setStatus('running');
    } catch {
      setStatus('error');
    }
  }, [subject, count]);

  // ── submit + score ──
  const submitTest = useCallback(async () => {
    setDialog(null);
    setStatus('submitting');
    // The question on screen hasn't been banked by the effect cleanup yet.
    const liveId = questions[index]?.id;
    const live = qStartRef.current ? Date.now() - qStartRef.current : 0;
    const payload = questions.map(q => {
      const ms = (spent[q.id] ?? 0) + (q.id === liveId ? live : 0);
      return {
        questionId: q.id,
        selectedAnswer: answers[q.id] ?? null,
        timeTakenMs: ms > 0 ? ms : null,
      };
    });
    try {
      const res = await fetch('/api/mock/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });
      const data = (await res.json()) as { results?: Result[] };
      if (!res.ok || !data.results) {
        setStatus('running');
        return;
      }
      const map: Record<string, Result> = {};
      for (const r of data.results) map[r.questionId] = r;
      // `spent` for the question on screen is banked by the stopwatch effect's
      // cleanup the moment status leaves 'running' — don't add it twice here.
      setResults(map);
      setStatus('done');
      setReview(null);
      window.scrollTo({ top: 0 });
    } catch {
      setStatus('running');
    }
  }, [questions, answers, spent, index]);

  // ── ticking clock (+ exam auto-submit) ──
  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (examMode) {
        const el = Math.floor((n - startedAt) / 1000);
        if (examTotal - el <= 0) void submitTest();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [status, examMode, examTotal, startedAt, submitTest]);

  // ── interactions ──
  const select = useCallback(
    (qid: string, optId: string) => {
      if (status !== 'running') return;
      if ((eliminated[qid] ?? []).includes(optId)) return;
      setAnswers(a => ({ ...a, [qid]: optId }));
    },
    [status, eliminated]
  );

  const toggleElim = useCallback(
    (qid: string, optId: string) => {
      if (status !== 'running') return;
      setEliminated(e => {
        const cur = e[qid] ?? [];
        return {
          ...e,
          [qid]: cur.includes(optId) ? cur.filter(x => x !== optId) : [...cur, optId],
        };
      });
    },
    [status]
  );

  const toggleFlag = useCallback((qid: string) => {
    setFlagged(f => {
      const next = new Set(f);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }, []);

  const setConf = useCallback((qid: string, c: Conf) => {
    setConfidence(prev => ({ ...prev, [qid]: c }));
  }, []);

  const setMarksFor = useCallback((qid: string, next: Set<number>) => {
    setMarks(m => ({ ...m, [qid]: next }));
  }, []);

  const go = useCallback(
    (i: number) => {
      const max = Math.max(questions.length - 1, 0);
      setIndex(Math.min(Math.max(i, 0), max));
    },
    [questions.length]
  );

  const answeredCount = Object.keys(answers).length;
  const unanswered = questions.length - answeredCount;

  const finish = useCallback(() => {
    if (unanswered > 0) setDialog('finish');
    else void submitTest();
  }, [unanswered, submitTest]);

  // ── keyboard: A–D to answer, arrows to page, F to flag ──
  const live = status === 'running';
  useEffect(() => {
    if (!live || !current) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const q = current!;

      const letter = e.key.toUpperCase();
      let optId: string | undefined;
      if (letter >= 'A' && letter <= 'D') {
        optId = q.options.find(o => o.id === letter)?.id ?? q.options[letter.charCodeAt(0) - 65]?.id;
      } else if (e.key >= '1' && e.key <= '4') {
        optId = q.options[Number(e.key) - 1]?.id;
      }
      if (optId) {
        e.preventDefault();
        select(q.id, optId);
        return;
      }
      // Enter belongs to whatever button or choice already has focus.
      if (e.key === 'Enter' && (e.target as HTMLElement | null)?.closest('button, [role="button"]')) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (index < questions.length - 1) go(index + 1);
        else finish();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(index - 1);
      } else if (letter === 'F') {
        e.preventDefault();
        toggleFlag(q.id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, current, index, questions.length, select, go, toggleFlag, finish]);

  // ── review overlay: arrows page through the scored test ──
  useEffect(() => {
    if (review === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setReview(r => (r === null ? r : Math.min(r + 1, questions.length - 1)));
      else if (e.key === 'ArrowLeft') setReview(r => (r === null ? r : Math.max(r - 1, 0)));
      else if (e.key === 'Escape') setReview(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [review, questions.length]);

  // ── results derivations ──
  const correctCount = useMemo(
    () => Object.values(results).filter(r => r.isCorrect).length,
    [results]
  );
  const accuracy = scored && questions.length ? correctCount / questions.length : 0;

  const radarAxes = useMemo(() => {
    if (!scored) return [];
    const m = new Map<string, { ok: number; total: number }>();
    for (const q of questions) {
      const r = results[q.id];
      const e = m.get(q.category) ?? { ok: 0, total: 0 };
      e.total += 1;
      if (r?.isCorrect) e.ok += 1;
      m.set(q.category, e);
    }
    return [...m.entries()].map(([label, v]) => ({
      label,
      value: v.total ? v.ok / v.total : 0,
    }));
  }, [scored, questions, results]);

  // ═══ screens ═══

  // 1. setup
  if (status === 'setup' || status === 'loading' || status === 'error') {
    return (
      <div className="wrap py-5">
        <div className="app-head">
          <h1>Mock test</h1>
          <p>A timed set of questions, scored all at once — just like the real SAT.</p>
        </div>
        <Setup
          subject={subject}
          count={count}
          examMode={examMode}
          loading={status === 'loading'}
          error={status === 'error'}
          onSubject={setSubject}
          onCount={setCount}
          onExam={setExamMode}
          onStart={start}
        />
      </div>
    );
  }

  // 2. review overlay (after scoring, one question at a time)
  if (scored && review !== null) {
    const q = questions[review];
    const r = q ? results[q.id] ?? null : null;
    return (
      <ExamRoot>
        <ExamTopBar
          title="Review"
          subtitle={`${correctCount} / ${questions.length} correct`}
          exitLabel="Score report"
          onExit={() => setReview(null)}
          right={<span className="ex-pill">Answers revealed</span>}
        />
        {q && (
          <ExamStage
            key={q.id}
            header={
              <QuestionBar
                q={q}
                n={review + 1}
                total={questions.length}
                flagged={flagged.has(q.id)}
                onFlag={() => toggleFlag(q.id)}
                status={
                  <span className={`ex-status ${r?.isCorrect ? 'ok' : 'bad'}`}>
                    {r?.isCorrect ? '✓ Correct' : answers[q.id] ? '✗ Missed' : '— Skipped'}
                  </span>
                }
              />
            }
            questionLabel={q.passage ? 'Passage & question' : 'Question'}
            question={
              <QuestionSide
                q={q}
                pro={pro}
                marks={marks[q.id] ?? NO_MARKS}
                onMarksChange={next => setMarksFor(q.id, next)}
              />
            }
            choices={
              <>
                <ChoiceSide
                  q={q}
                  selected={answers[q.id] ?? null}
                  eliminated={[]}
                  result={r}
                  elimMode={false}
                  onSelect={() => {}}
                  onElim={() => {}}
                />
                {r && (
                  <div className="ex-review prx-anim">
                    <div className="prx-verdict">
                      <span className={`word ${r.isCorrect ? 'good' : 'bad'}`}>
                        {r.isCorrect ? 'Correct.' : answers[q.id] ? 'Not quite.' : 'Skipped.'}
                      </span>
                      <span className="sub">
                        {!r.isCorrect && `the key was ${r.correctAnswer} · `}
                        {formatClock(Math.round((spent[q.id] ?? 0) / 1000))}
                      </span>
                    </div>
                    {r.explanation && (
                      <div className="prx-expl">
                        <p className="prx-expl-label">Explanation</p>
                        <QuestionBody text={r.explanation} className="prx-expl-body" />
                      </div>
                    )}
                    <WhyPanel questionId={q.id} pro={pro} />
                  </div>
                )}
              </>
            }
          />
        )}
        <ExamFooter
          left={
            <span className="ex-score-chip">
              {correctCount}/{questions.length} · {pct(accuracy)}
            </span>
          }
          center={
            <ExamNavigator
              index={review}
              total={questions.length}
              onJump={setReview}
              bubbleClass={i => {
                const qq = questions[i];
                const rr = results[qq.id];
                return `${rr?.isCorrect ? 'ok' : 'bad'}${flagged.has(qq.id) ? ' flag' : ''}`;
              }}
              legend={
                <>
                  <span className="ex-lg"><i className="ex-lg-dot ok" /> Correct</span>
                  <span className="ex-lg"><i className="ex-lg-dot bad" /> Missed</span>
                  <span className="ex-lg"><i className="ex-lg-dot flag" /> Flagged</span>
                </>
              }
              action={
                <button className="prx-btn alt w-full" onClick={() => setReview(null)}>
                  Back to score report
                </button>
              }
            />
          }
          right={
            <div className="ex-pager">
              <button
                className="ex-page-btn"
                onClick={() => setReview(r2 => Math.max((r2 ?? 0) - 1, 0))}
                disabled={review === 0}
              >
                <span aria-hidden="true">‹</span> Back
              </button>
              <button
                className="ex-page-btn next"
                onClick={() =>
                  setReview(r2 =>
                    r2 !== null && r2 < questions.length - 1 ? r2 + 1 : null
                  )
                }
              >
                {review < questions.length - 1 ? 'Next' : 'Done'}{' '}
                <span aria-hidden="true">›</span>
              </button>
            </div>
          }
        />
      </ExamRoot>
    );
  }

  // 3. score report
  if (scored) {
    return (
      <div className="wrap py-5">
        <ResultsHeader
          correct={correctCount}
          total={questions.length}
          accuracy={accuracy}
          radarAxes={radarAxes}
          onRetake={() => setStatus('setup')}
          onReview={() => setReview(0)}
        />
        <div className="mk-review">
          <div className="mk-review-head">
            <p className="app-label">Review every question</p>
            <button className="prx-btn alt mk-review-all" onClick={() => setReview(0)}>
              Open review →
            </button>
          </div>
          <div className="mk-review-grid">
            {questions.map((q, i) => {
              const r = results[q.id];
              const secs = Math.round((spent[q.id] ?? 0) / 1000);
              return (
                <button
                  key={q.id}
                  className={`mk-rev-card${r?.isCorrect ? ' ok' : ' bad'}${flagged.has(q.id) ? ' flagged' : ''}`}
                  onClick={() => setReview(i)}
                >
                  <span className="mk-rev-n">Q{i + 1}</span>
                  <span className="mk-rev-cat">{q.category}</span>
                  <span className="mk-rev-mark">{r?.isCorrect ? '✓' : '✗'}</span>
                  <span className="mk-rev-time">{secs}s</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 4. live test — one question, full screen
  const clockTone: '' | 'warn' | 'danger' =
    remaining !== null && remaining <= 60 ? 'danger' : remaining !== null && remaining <= 300 ? 'warn' : '';

  return (
    <ExamRoot>
      <ExamTopBar
        title={`Mock test · ${SUBJECT_LABEL[subject]}`}
        subtitle={`${questions.length} questions${examMode ? ' · exam mode' : ''}`}
        directions={directionsText}
        onExit={() => setDialog('exit')}
        center={
          <ExamClock
            label={remaining !== null ? formatClock(remaining) : formatClock(elapsed)}
            tone={clockTone}
            hidden={hideClock}
            onToggle={() => setHideClock(h => !h)}
          />
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
              markCount={current ? (marks[current.id]?.size ?? 0) : 0}
              onClearMarks={() => current && setMarksFor(current.id, new Set())}
            />
            <FullscreenToggle />
            <button
              type="button"
              className={`ex-tool${elimMode ? ' on' : ''}`}
              onClick={() => setElimMode(m => !m)}
              aria-pressed={elimMode}
              title="Cross out answer choices"
            >
              <span className="ex-abc">ABC</span>
            </button>
            <span className="ex-pill">
              <strong>{answeredCount}</strong>/{questions.length} answered
            </span>
            <button
              type="button"
              className="prx-btn ex-finish"
              onClick={finish}
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? 'Scoring…' : 'Finish'}
            </button>
          </>
        }
      />

      {current && (
        <ExamStage
          key={current.id}
          overlay={<LineReaderOverlay active={lineReaderOn} />}
          header={
            <QuestionBar
              q={current}
              n={index + 1}
              total={questions.length}
              flagged={flagged.has(current.id)}
              onFlag={() => toggleFlag(current.id)}
              status={
                answers[current.id] ? (
                  <span className="ex-status done">● Answered</span>
                ) : (
                  <span className="ex-status">○ Awaiting answer</span>
                )
              }
            />
          }
          questionLabel={current.passage ? 'Passage & question' : 'Question'}
          question={
            <QuestionSide
              q={current}
              pro={pro}
              marks={marks[current.id] ?? NO_MARKS}
              onMarksChange={next => setMarksFor(current.id, next)}
              tool={readingTool}
              onToolChange={setReadingTool}
            />
          }
          choices={
            <>
              <ChoiceSide
                q={current}
                selected={answers[current.id] ?? null}
                eliminated={eliminated[current.id] ?? []}
                result={null}
                elimMode={elimMode}
                onSelect={select}
                onElim={toggleElim}
              />
              <div className="ex-conf">
                <span className="ex-conf-lbl">Confidence</span>
                {(['sure', 'unsure', 'guess'] as const).map(c => (
                  <button
                    key={c}
                    className={`mk-conf-btn ${c}${confidence[current.id] === c ? ' on' : ''}`}
                    onClick={() => setConf(current.id, c)}
                  >
                    {c === 'sure' ? 'Sure' : c === 'unsure' ? 'Unsure' : 'Guess'}
                  </button>
                ))}
              </div>
            </>
          }
        />
      )}

      <ExamFooter
        left={<span className="ex-hint">A–D to answer · ← → to move · F to flag</span>}
        center={
          <ExamNavigator
            index={index}
            total={questions.length}
            onJump={go}
            bubbleClass={i => {
              const qq = questions[i];
              return `${answers[qq.id] ? 'done' : ''}${flagged.has(qq.id) ? ' flag' : ''}`;
            }}
            legend={
              <>
                <span className="ex-lg"><i className="ex-lg-dot done" /> Answered</span>
                <span className="ex-lg"><i className="ex-lg-dot" /> Unanswered</span>
                <span className="ex-lg"><i className="ex-lg-dot flag" /> Flagged</span>
              </>
            }
            action={
              <button className="prx-btn w-full" onClick={finish} disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Scoring…' : 'Check answers'}
              </button>
            }
          />
        }
        right={
          <div className="ex-pager">
            <button className="ex-page-btn" onClick={() => go(index - 1)} disabled={index === 0}>
              <span aria-hidden="true">‹</span> Back
            </button>
            {index < questions.length - 1 ? (
              <button className="ex-page-btn next" onClick={() => go(index + 1)}>
                Next <span aria-hidden="true">›</span>
              </button>
            ) : (
              <button className="ex-page-btn next" onClick={finish} disabled={status === 'submitting'}>
                Finish <span aria-hidden="true">›</span>
              </button>
            )}
          </div>
        }
      />

      {dialog === 'exit' && (
        <ExamDialog
          title="Leave this test?"
          body={<p>Your answers won&apos;t be saved or scored. You can start a fresh test any time.</p>}
          confirmLabel="Leave test"
          tone="red"
          onConfirm={() => {
            setDialog(null);
            setStatus('setup');
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'finish' && (
        <ExamDialog
          title="Submit for scoring?"
          body={
            <p>
              <strong>{unanswered}</strong> question{unanswered === 1 ? '' : 's'} still
              unanswered. Unanswered questions are marked wrong.
            </p>
          }
          confirmLabel="Submit anyway"
          cancelLabel="Keep working"
          onConfirm={() => void submitTest()}
          onCancel={() => setDialog(null)}
        />
      )}
    </ExamRoot>
  );
}

// ─── The header strip above the two blocks ────────────────────────────────────

function QuestionBar({
  q,
  n,
  total,
  flagged,
  status,
  onFlag,
}: {
  q: MockQuestion;
  n: number;
  total: number;
  flagged: boolean;
  status: ReactNode;
  onFlag: () => void;
}) {
  return (
    <>
      <span
        className="ex-qbar-prog"
        style={{ width: `${(n / Math.max(total, 1)) * 100}%` }}
        aria-hidden="true"
      />
      <span className="ex-qnum">{n}</span>
      <span className="ex-qcount">
        Question <strong>{n}</strong> / {total}
      </span>
      <DiffDot difficulty={q.difficulty} />
      <span className="ex-qcat">{q.category}</span>
      <button
        type="button"
        className={`ex-mark${flagged ? ' on' : ''}`}
        onClick={onFlag}
        aria-pressed={flagged}
      >
        <span aria-hidden="true">🔖</span> {flagged ? 'Marked' : 'Mark for review'}
      </button>
      {status}
    </>
  );
}

// ─── Left block: the passage and the question it asks ─────────────────────────

function QuestionSide({
  q,
  pro,
  marks,
  onMarksChange,
  tool,
  onToolChange,
}: {
  q: MockQuestion;
  pro: boolean;
  marks: Set<number>;
  onMarksChange: (next: Set<number>) => void;
  tool?: Tool;
  onToolChange?: (next: Tool) => void;
}) {
  return (
    <>
      {q.passage && (
        <PassageReader
          text={q.passage}
          pro={pro}
          marks={marks}
          onMarksChange={onMarksChange}
          tool={tool}
          onToolChange={onToolChange}
        />
      )}
      <ChartFigure svg={q.chart_svg} />
      <QuestionBody text={q.question_text} tables={q.tables} className="ex-stem" />
    </>
  );
}

// ─── Right block: the answer choices ──────────────────────────────────────────

function ChoiceSide({
  q,
  selected,
  eliminated,
  result,
  elimMode,
  onSelect,
  onElim,
}: {
  q: MockQuestion;
  selected: string | null;
  eliminated: string[];
  result: Result | null;
  elimMode: boolean;
  onSelect: (qid: string, optId: string) => void;
  onElim: (qid: string, optId: string) => void;
}) {
  const scored = result !== null;

  if (q.question_type === 'grid_in') {
    return (
      <GridInInput
        value={selected ?? ''}
        onChange={v => onSelect(q.id, v)}
        disabled={scored}
        state={scored ? (result?.isCorrect ? 'key' : 'missed') : undefined}
      />
    );
  }

  return (
    <>
      <div className="ex-opts" role="group" aria-label="Answer choices">
        {q.options.map(opt => {
          const isElim = eliminated.includes(opt.id);
          const isSel = selected === opt.id;
          const isKey = scored && result?.correctAnswer === opt.id;
          const isMiss = scored && isSel && !result?.isCorrect;
          let cls = '';
          if (scored) {
            if (isKey) cls = ' key';
            else if (isMiss) cls = ' missed';
          } else if (isSel) cls = ' sel';
          if (isElim) cls += ' elim';

          return (
            <div
              key={opt.id}
              role="button"
              tabIndex={scored ? -1 : 0}
              className={`mk-opt${cls}`}
              onClick={() => !scored && onSelect(q.id, opt.id)}
              onKeyDown={e => {
                if (scored) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(q.id, opt.id);
                }
              }}
              aria-pressed={isSel}
            >
              <span className="mk-opt-bub">{opt.id}</span>
              <span className="mk-opt-text" dangerouslySetInnerHTML={{ __html: opt.text }} />
              {isKey && <span className="mk-opt-flag ok">✓</span>}
              {isMiss && <span className="mk-opt-flag err">✗</span>}
              {!scored && elimMode && (
                <button
                  className="mk-elim-btn show"
                  onClick={e => {
                    e.stopPropagation();
                    onElim(q.id, opt.id);
                  }}
                  aria-label={isElim ? 'Restore choice' : 'Eliminate choice'}
                  title="Cross out"
                >
                  {isElim ? '↺' : '✕'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function DiffDot({ difficulty }: { difficulty: string }) {
  const color =
    difficulty === 'easy' ? 'var(--ok)' : difficulty === 'hard' ? 'var(--err)' : 'var(--gold-d)';
  return (
    <span
      className="prx-diff"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {difficulty}
    </span>
  );
}

// ─── Setup screen ─────────────────────────────────────────────────────────────

function Setup({
  subject,
  count,
  examMode,
  loading,
  error,
  onSubject,
  onCount,
  onExam,
  onStart,
}: {
  subject: Subject;
  count: number;
  examMode: boolean;
  loading: boolean;
  error: boolean;
  onSubject: (s: Subject) => void;
  onCount: (n: number) => void;
  onExam: (b: boolean) => void;
  onStart: () => void;
}) {
  const subjects: { id: Subject; label: string }[] = [
    { id: 'mixed', label: 'Mixed' },
    { id: 'english', label: 'Reading & Writing' },
    { id: 'math', label: 'Math' },
  ];
  return (
    <div className="app-panel accent mk-setup">
      <div className="mk-set-group">
        <p className="app-label mb-2">Subject</p>
        <div className="mk-chips">
          {subjects.map(s => (
            <button
              key={s.id}
              className={`mk-choice${subject === s.id ? ' on' : ''}`}
              onClick={() => onSubject(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mk-set-group">
        <p className="app-label mb-2">Length</p>
        <div className="mk-chips">
          {[10, 20, 30].map(n => (
            <button
              key={n}
              className={`mk-choice${count === n ? ' on' : ''}`}
              onClick={() => onCount(n)}
            >
              {n} questions
            </button>
          ))}
        </div>
      </div>

      <label className="mk-exam">
        <input type="checkbox" checked={examMode} onChange={e => onExam(e.target.checked)} />
        <span>
          <strong>Exam mode</strong> — countdown timer ({Math.round((count * 90) / 60)} min), auto-submits at zero.
        </span>
      </label>

      {error && (
        <p className="mk-error">Couldn&apos;t load a test. Make sure questions are published, then try again.</p>
      )}

      <p className="mk-note">
        The test opens full screen — the sidebar and top bar step aside until you finish.
      </p>

      <button className="prx-btn mk-start" onClick={onStart} disabled={loading}>
        {loading ? 'Preparing…' : 'Start test →'}
      </button>
    </div>
  );
}

// ─── Results header (score band + radar) ──────────────────────────────────────

function ResultsHeader({
  correct,
  total,
  accuracy,
  radarAxes,
  onRetake,
  onReview,
}: {
  correct: number;
  total: number;
  accuracy: number;
  radarAxes: { label: string; value: number }[];
  onRetake: () => void;
  onReview: () => void;
}) {
  return (
    <div className="mk-results">
      <div className="an-hero prx-anim">
        <div className="an-hero-ring">
          <ScoreRing value={accuracy} />
        </div>
        <div className="an-hero-body">
          <p className="an-hero-eyebrow">Your score</p>
          <p className="an-hero-score">
            {correct}<span className="sep"> / </span>{total}
            <span className="unit"> correct</span>
          </p>
          <p className="an-hero-msg">{scoreMessage(accuracy)}</p>
          <div className="an-hero-bar">
            <div className="an-hero-bar-fill" style={{ width: `${Math.round(accuracy * 100)}%` }} />
          </div>
          <div className="an-hero-chips">
            <button className="an-hero-chip" onClick={onReview}>⌕ Review answers</button>
            <button className="an-hero-chip" onClick={onRetake}>↻ New test</button>
            <a className="an-hero-chip" href="/analytics">View analytics →</a>
          </div>
        </div>
      </div>

      {radarAxes.length >= 3 && (
        <div className="app-panel prx-anim" style={{ animationDelay: '0.1s' }}>
          <p className="app-label mb-3">Skills breakdown</p>
          <RadarChart axes={radarAxes} />
          <p className="an-foot-note">Accuracy by category — further out is stronger.</p>
        </div>
      )}
    </div>
  );
}
