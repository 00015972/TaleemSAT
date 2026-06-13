'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { id: string; text: string };

type Question = {
  id: string;
  passage: string | null;
  question_text: string;
  options: Option[];
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
};

type AnswerResult = {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
};

type Phase =
  | { name: 'idle' }
  | { name: 'loading' }
  | { name: 'question'; question: Question }
  | { name: 'selected'; question: Question; selected: string }
  | { name: 'submitting'; question: Question; selected: string }
  | { name: 'result'; question: Question; selected: string; result: AnswerResult }
  | { name: 'empty' };

export type Category = {
  id: string;
  slug: string;
  name: string;
  subject_slug: string;
  subject_name: string;
};

// ─── Main component ───────────────────────────────────────────────────────────

export function PracticeShell({ categories }: { categories: Category[] }) {
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  // The session sheet: one entry per scored question this visit.
  const [sheet, setSheet] = useState<boolean[]>([]);

  const fetchQuestion = useCallback(
    async (categorySlug: string, exclude: string[]) => {
      setPhase({ name: 'loading' });
      try {
        const params = new URLSearchParams({ categorySlug });
        if (exclude.length > 0) params.set('exclude', exclude.join(','));
        const res = await fetch(`/api/practice/question?${params}`);
        const data = await res.json() as { question?: Question; error?: string };
        if (!res.ok || !data.question) {
          setPhase({ name: 'empty' });
          return;
        }
        setSeenIds(prev => [...prev, data.question!.id]);
        setStartTime(Date.now());
        setPhase({ name: 'question', question: data.question });
      } catch {
        setPhase({ name: 'empty' });
      }
    },
    []
  );

  function selectCategory(slug: string) {
    setActiveCategorySlug(slug);
    setSeenIds([]);
    fetchQuestion(slug, []);
  }

  // Allow re-picking another option any time before the answer is checked.
  const selectOption = useCallback((optionId: string) => {
    setPhase(p =>
      p.name === 'question' || p.name === 'selected'
        ? { name: 'selected', question: p.question, selected: optionId }
        : p
    );
  }, []);

  const submitAnswer = useCallback(async () => {
    if (phase.name !== 'selected') return;
    const { question, selected } = phase;
    const timeTakenMs = startTime ? Date.now() - startTime : null;

    setPhase({ name: 'submitting', question, selected });

    try {
      const res = await fetch('/api/practice/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, selectedAnswer: selected, timeTakenMs }),
      });
      const result = await res.json() as AnswerResult;
      setSheet(prev => [...prev, result.isCorrect]);
      setPhase({ name: 'result', question, selected, result });
    } catch {
      // Revert to selected state so user can retry
      setPhase({ name: 'selected', question, selected });
    }
  }, [phase, startTime]);

  const nextQuestion = useCallback(() => {
    if (!activeCategorySlug) return;
    fetchQuestion(activeCategorySlug, seenIds);
  }, [activeCategorySlug, seenIds, fetchQuestion]);

  // Answer with the keyboard: A–D (or 1–4) to choose, Enter to check / continue.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (phase.name === 'question' || phase.name === 'selected') {
        const letter = e.key.toUpperCase();
        const opts = phase.question.options;
        let id: string | undefined;
        if (letter >= 'A' && letter <= 'D') {
          id = opts.find(o => o.id === letter)?.id ?? opts[letter.charCodeAt(0) - 65]?.id;
        } else if (e.key >= '1' && e.key <= '4') {
          id = opts[Number(e.key) - 1]?.id;
        }
        if (id) {
          e.preventDefault();
          selectOption(id);
          return;
        }
        if (e.key === 'Enter' && phase.name === 'selected') {
          e.preventDefault();
          submitAnswer();
        }
      } else if (phase.name === 'result' && e.key === 'Enter') {
        e.preventDefault();
        nextQuestion();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, selectOption, submitAnswer, nextQuestion]);

  const english = categories.filter(c => c.subject_slug === 'english');
  const math = categories.filter(c => c.subject_slug === 'math');
  const activeCategory = categories.find(c => c.slug === activeCategorySlug) ?? null;

  const onQuestion =
    phase.name === 'question' ||
    phase.name === 'selected' ||
    phase.name === 'submitting' ||
    phase.name === 'result';

  return (
    <div className="prx-layout">
      {/* Category picker */}
      <aside>
        <CategoryGroup
          label="Reading & Writing"
          categories={english}
          active={activeCategorySlug}
          onSelect={selectCategory}
        />
        <CategoryGroup
          label="Math"
          categories={math}
          active={activeCategorySlug}
          onSelect={selectCategory}
          className="prx-group-gap"
        />
      </aside>

      {/* Question area */}
      <div className="min-w-0">
        {(sheet.length > 0 || onQuestion) && (
          <SessionRail sheet={sheet} live={onQuestion && phase.name !== 'result'} />
        )}

        {phase.name === 'idle' && <IdleState />}
        {phase.name === 'loading' && <LoadingSkeleton />}
        {phase.name === 'empty' && (
          <EmptyState onReset={() => activeCategorySlug && selectCategory(activeCategorySlug)} />
        )}
        {onQuestion && (
          <QuestionCard
            key={(phase as Extract<Phase, { name: 'question' }>).question.id}
            phase={phase as Extract<Phase, { name: 'question' | 'selected' | 'submitting' | 'result' }>}
            seq={sheet.length + (phase.name === 'result' ? 0 : 1)}
            categoryName={activeCategory?.name ?? ''}
            onSelect={selectOption}
            onSubmit={submitAnswer}
            onNext={nextQuestion}
          />
        )}
      </div>
    </div>
  );
}

// ─── Session rail ─────────────────────────────────────────────────────────────

function SessionRail({ sheet, live }: { sheet: boolean[]; live: boolean }) {
  const correct = sheet.filter(Boolean).length;
  return (
    <div className="prx-rail">
      <span className="prx-rail-label">Session sheet</span>
      <div className="prx-rail-bubs">
        {sheet.map((hit, i) => (
          <span
            key={i}
            className={`prx-rail-bub ${hit ? 'hit' : 'miss'}`}
            title={`Q${i + 1}: ${hit ? 'correct' : 'missed'}`}
          />
        ))}
        {live && <span className="prx-rail-bub now" title="Current question" />}
      </div>
      {sheet.length > 0 && (
        <span className="prx-rail-stat">
          {correct}/{sheet.length} correct
        </span>
      )}
    </div>
  );
}

// ─── Category picker ──────────────────────────────────────────────────────────

function CategoryGroup({
  label,
  categories,
  active,
  onSelect,
  className = '',
}: {
  label: string;
  categories: Category[];
  active: string | null;
  onSelect: (slug: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="eyebrow mb-2">{label}</p>
      <ul className="prx-cat-list">
        {categories.map(cat => (
          <li key={cat.slug}>
            <button
              onClick={() => onSelect(cat.slug)}
              className={`prx-cat${active === cat.slug ? ' on' : ''}`}
            >
              <span className="mark" />
              {cat.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  phase,
  seq,
  categoryName,
  onSelect,
  onSubmit,
  onNext,
}: {
  phase: Extract<Phase, { name: 'question' | 'selected' | 'submitting' | 'result' }>;
  seq: number;
  categoryName: string;
  onSelect: (id: string) => void;
  onSubmit: () => void;
  onNext: () => void;
}) {
  const { question } = phase;
  const selected =
    phase.name === 'selected' || phase.name === 'submitting' || phase.name === 'result'
      ? phase.selected
      : null;
  const result = phase.name === 'result' ? phase.result : null;
  const isSubmitting = phase.name === 'submitting';
  const isInteractive = phase.name === 'question' || phase.name === 'selected';

  // The card is keyed by question id in the shell, so all local state —
  // including this stopwatch — resets by remount on every new question.
  const secs = useElapsed(isInteractive || isSubmitting);

  // If a long question pushes the verdict below the fold, glide it into view.
  // `nearest` is a no-op when everything already fits on screen.
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const hasResult = result !== null;
  useEffect(() => {
    if (!hasResult) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    actionsRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [hasResult]);

  return (
    <div className="prx-card">
      <div>
        <div className="prx-card-head">
          <span className="prx-meta">
            <span className="prx-qnum">Q{seq}</span>
            {categoryName}
            <DifficultyBadge difficulty={question.difficulty} />
          </span>
          <span className="prx-timer">{formatClock(secs)}</span>
        </div>

        {question.passage && (
          <div className="prx-passage prx-anim">{question.passage}</div>
        )}

        <p className="prx-stem prx-anim" style={{ animationDelay: '0.06s' }}>
          {question.question_text}
        </p>

        <div className="prx-opts" role="group" aria-label="Answer choices">
          {question.options.map((opt, i) => (
            <OptionButton
              key={opt.id}
              option={opt}
              index={i}
              selected={selected}
              result={result}
              interactive={isInteractive}
              onSelect={onSelect}
            />
          ))}
        </div>

        {result && (
          <div className="prx-anim">
            <div className="prx-verdict">
              <span className={`word ${result.isCorrect ? 'good' : 'bad'}`}>
                {result.isCorrect ? 'Correct.' : 'Not quite.'}
              </span>
              <span className="sub">
                {result.isCorrect
                  ? `answered in ${formatClock(secs)}`
                  : `the key was ${result.correctAnswer} · ${formatClock(secs)}`}
              </span>
            </div>
            <div className="prx-expl">
              <p className="prx-expl-label">Explanation</p>
              <p className="prx-expl-body">{result.explanation}</p>
            </div>
          </div>
        )}

        <div className="prx-actions" ref={actionsRef}>
          {!result ? (
            <button
              onClick={onSubmit}
              disabled={!selected || isSubmitting}
              className="prx-btn"
            >
              {isSubmitting ? 'Checking…' : 'Check answer'}
            </button>
          ) : (
            <button onClick={onNext} className="prx-btn">
              Next question →
            </button>
          )}
          <span className="prx-kbd-hint">
            {!result ? 'A–D to choose · Enter to check' : 'Enter for the next one'}
          </span>
        </div>
      </div>
    </div>
  );
}

// Per-question stopwatch: ticks while answering, freezes once scored.
function useElapsed(running: boolean) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  return secs;
}

function formatClock(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Option button ────────────────────────────────────────────────────────────

function OptionButton({
  option,
  index,
  selected,
  result,
  interactive,
  onSelect,
}: {
  option: Option;
  index: number;
  selected: string | null;
  result: AnswerResult | null;
  interactive: boolean;
  onSelect: (id: string) => void;
}) {
  const isSelected = selected === option.id;
  const isKey = result?.correctAnswer === option.id;
  const isMiss = isSelected && result !== null && !result.isCorrect;

  let state = '';
  if (result) {
    if (isKey) state = ' key';
    else if (isMiss) state = ' missed';
  } else if (isSelected) {
    state = ' sel';
  }

  return (
    <button
      onClick={() => interactive && onSelect(option.id)}
      disabled={!interactive}
      className={`prx-opt prx-anim${state}`}
      style={{ animationDelay: `${0.12 + index * 0.05}s` }}
      aria-pressed={isSelected}
    >
      <span className="prx-opt-bub">
        <span>{option.id}</span>
      </span>
      <span className="prx-opt-text">{option.text}</span>
      {isKey && result && (
        <span className="prx-opt-flag" style={{ color: 'var(--ok)' }}>✓</span>
      )}
      {isMiss && (
        <span className="prx-opt-flag" style={{ color: 'var(--err)' }}>✗</span>
      )}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DifficultyBadge({ difficulty }: { difficulty: string }) {
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

function IdleState() {
  return (
    <div className="prx-empty">
      <div className="prx-idle-bubs" aria-hidden="true">
        {['A', 'B', 'C', 'D'].map(l => (
          <span key={l} className="prx-idle-bub">{l}</span>
        ))}
      </div>
      <p className="prx-empty-title">Your sheet is blank.</p>
      <p className="prx-empty-sub">Choose a category to open your first question.</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div
      className="prx-card flex flex-col gap-4 animate-pulse"
      aria-label="Loading question"
    >
      <div className="h-4 w-32 rounded" style={{ background: 'var(--border)' }} />
      <div className="h-20 rounded" style={{ background: 'var(--bg)' }} />
      <div className="h-5 w-3/4 rounded" style={{ background: 'var(--border)' }} />
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-12 rounded" style={{ background: 'var(--bg)' }} />
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="prx-empty">
      <div className="prx-idle-bubs" aria-hidden="true">
        {['A', 'B', 'C', 'D'].map(l => (
          <span key={l} className="prx-idle-bub done">{l}</span>
        ))}
      </div>
      <p className="prx-empty-title">Category cleared.</p>
      <p className="prx-empty-sub mb-4">
        You&apos;ve answered every question here. New ones are added regularly.
      </p>
      <button onClick={onReset} className="prx-btn">
        Practice again from the start
      </button>
    </div>
  );
}
