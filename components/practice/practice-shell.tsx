'use client';

import { useState, useCallback } from 'react';

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

  function selectOption(optionId: string) {
    if (phase.name !== 'question') return;
    setPhase({ name: 'selected', question: phase.question, selected: optionId });
  }

  async function submitAnswer() {
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
      setPhase({ name: 'result', question, selected, result });
    } catch {
      // Revert to selected state so user can retry
      setPhase({ name: 'selected', question, selected });
    }
  }

  function nextQuestion() {
    if (!activeCategorySlug) return;
    fetchQuestion(activeCategorySlug, seenIds);
  }

  const english = categories.filter(c => c.subject_slug === 'english');
  const math = categories.filter(c => c.subject_slug === 'math');

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Category picker */}
      <aside className="md:w-56 shrink-0">
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
          className="mt-4"
        />
      </aside>

      {/* Question area */}
      <div className="flex-1 min-w-0">
        {phase.name === 'idle' && <IdleState />}
        {phase.name === 'loading' && <LoadingSkeleton />}
        {phase.name === 'empty' && <EmptyState onReset={() => activeCategorySlug && selectCategory(activeCategorySlug)} />}
        {(phase.name === 'question' ||
          phase.name === 'selected' ||
          phase.name === 'submitting' ||
          phase.name === 'result') && (
          <QuestionCard
            phase={phase}
            onSelect={selectOption}
            onSubmit={submitAnswer}
            onNext={nextQuestion}
          />
        )}
      </div>
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
      <ul className="flex flex-col gap-1">
        {categories.map(cat => (
          <li key={cat.slug}>
            <button
              onClick={() => onSelect(cat.slug)}
              className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
              style={{
                background: active === cat.slug ? 'var(--green)' : 'var(--surf)',
                color: active === cat.slug ? '#fff' : 'var(--txt)',
                border: '1px solid var(--border)',
                fontWeight: active === cat.slug ? 600 : 400,
              }}
            >
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
  onSelect,
  onSubmit,
  onNext,
}: {
  phase: Extract<Phase, { name: 'question' | 'selected' | 'submitting' | 'result' }>;
  onSelect: (id: string) => void;
  onSubmit: () => void;
  onNext: () => void;
}) {
  const question =
    phase.name === 'question'
      ? phase.question
      : phase.name === 'selected' || phase.name === 'submitting'
        ? phase.question
        : phase.question;

  const selected =
    phase.name === 'selected' || phase.name === 'submitting' || phase.name === 'result'
      ? phase.selected
      : null;

  const result = phase.name === 'result' ? phase.result : null;
  const isSubmitting = phase.name === 'submitting';
  const isInteractive = phase.name === 'question' || phase.name === 'selected';

  return (
    <div
      className="rounded-l p-6 flex flex-col gap-5"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      {/* Difficulty + tags */}
      <div className="flex items-center gap-2">
        <DifficultyBadge difficulty={question.difficulty} />
        {question.tags.slice(0, 2).map(tag => (
          <span
            key={tag}
            className="px-2 py-0.5 text-xs rounded-s"
            style={{ background: 'var(--bg)', color: 'var(--txt-soft)', border: '1px solid var(--border)' }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Passage */}
      {question.passage && (
        <div
          className="rounded p-4 text-sm leading-relaxed font-serif-body max-h-40 overflow-y-auto"
          style={{ background: 'var(--bg)', borderLeft: '3px solid var(--gold)', color: 'var(--txt)' }}
        >
          {question.passage}
        </div>
      )}

      {/* Question text */}
      <p className="text-base font-medium leading-relaxed" style={{ color: 'var(--txt)' }}>
        {question.question_text}
      </p>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {question.options.map(opt => (
          <OptionButton
            key={opt.id}
            option={opt}
            selected={selected}
            result={result}
            interactive={isInteractive}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Result banner */}
      {result && (
        <ResultBanner isCorrect={result.isCorrect} />
      )}

      {/* Explanation */}
      {result && (
        <div
          className="rounded p-4 text-sm leading-relaxed"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--txt)' }}
        >
          <p className="eyebrow mb-2">Explanation</p>
          <p className="font-serif-body">{result.explanation}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {!result && (
          <button
            onClick={onSubmit}
            disabled={!selected || isSubmitting}
            className="rounded px-5 py-2.5 text-sm font-semibold disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--green)', color: '#fff' }}
          >
            {isSubmitting ? 'Checking…' : 'Submit'}
          </button>
        )}
        {result && (
          <button
            onClick={onNext}
            className="rounded px-5 py-2.5 text-sm font-semibold"
            style={{ background: 'var(--green)', color: '#fff' }}
          >
            Next question →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Option button ────────────────────────────────────────────────────────────

function OptionButton({
  option,
  selected,
  result,
  interactive,
  onSelect,
}: {
  option: Option;
  selected: string | null;
  result: AnswerResult | null;
  interactive: boolean;
  onSelect: (id: string) => void;
}) {
  const isSelected = selected === option.id;
  const isCorrect = result?.correctAnswer === option.id;
  const isWrong = isSelected && result && !result.isCorrect;

  let bg = 'var(--bg)';
  let border = 'var(--border)';
  const textColor = 'var(--txt)';
  let letterBg = 'var(--surf)';
  let letterColor = 'var(--txt-soft)';

  if (isCorrect && result) {
    bg = 'color-mix(in srgb, var(--ok) 10%, transparent)';
    border = 'var(--ok)';
    letterBg = 'var(--ok)';
    letterColor = '#fff';
  } else if (isWrong) {
    bg = 'color-mix(in srgb, var(--err) 10%, transparent)';
    border = 'var(--err)';
    letterBg = 'var(--err)';
    letterColor = '#fff';
  } else if (isSelected && !result) {
    bg = 'color-mix(in srgb, var(--green) 8%, transparent)';
    border = 'var(--green)';
    letterBg = 'var(--green)';
    letterColor = '#fff';
  }

  return (
    <button
      onClick={() => interactive && onSelect(option.id)}
      disabled={!interactive}
      className="w-full text-left flex items-start gap-3 rounded px-4 py-3 text-sm transition-colors disabled:cursor-default"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <span
        className="shrink-0 w-6 h-6 rounded-s flex items-center justify-center text-xs font-bold mt-0.5"
        style={{ background: letterBg, color: letterColor }}
      >
        {option.id}
      </span>
      <span style={{ color: textColor }}>{option.text}</span>
      {isCorrect && result && (
        <span className="ml-auto shrink-0 text-base" style={{ color: 'var(--ok)' }}>✓</span>
      )}
      {isWrong && (
        <span className="ml-auto shrink-0 text-base" style={{ color: 'var(--err)' }}>✗</span>
      )}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ResultBanner({ isCorrect }: { isCorrect: boolean }) {
  return (
    <div
      className="rounded px-4 py-3 text-sm font-semibold"
      style={{
        background: isCorrect
          ? 'color-mix(in srgb, var(--ok) 12%, transparent)'
          : 'color-mix(in srgb, var(--err) 10%, transparent)',
        color: isCorrect ? 'var(--ok)' : 'var(--err)',
        border: `1px solid ${isCorrect ? 'color-mix(in srgb, var(--ok) 30%, transparent)' : 'color-mix(in srgb, var(--err) 25%, transparent)'}`,
      }}
    >
      {isCorrect ? '✓ Correct! Well done.' : '✗ Not quite — read the explanation below.'}
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const color =
    difficulty === 'easy' ? 'var(--ok)' : difficulty === 'hard' ? 'var(--err)' : 'var(--gold)';
  return (
    <span
      className="px-2 py-0.5 text-xs font-semibold rounded-s capitalize"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      {difficulty}
    </span>
  );
}

function IdleState() {
  return (
    <div
      className="rounded-l p-12 text-center"
      style={{ background: 'var(--surf)', border: '1px dashed var(--border)' }}
    >
      <p className="text-2xl mb-3">📖</p>
      <p className="text-sm font-medium text-txt mb-1">Pick a category to start practicing</p>
      <p className="text-xs text-muted">Select any topic from the left to load your first question.</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div
      className="rounded-l p-6 flex flex-col gap-4 animate-pulse"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <div className="h-4 w-24 rounded" style={{ background: 'var(--border)' }} />
      <div className="h-20 rounded" style={{ background: 'var(--bg)' }} />
      <div className="h-5 w-3/4 rounded" style={{ background: 'var(--border)' }} />
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-11 rounded" style={{ background: 'var(--bg)' }} />
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div
      className="rounded-l p-12 text-center"
      style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
    >
      <p className="text-2xl mb-3">🎉</p>
      <p className="text-sm font-medium text-txt mb-1">
        You&apos;ve practiced all questions in this category!
      </p>
      <p className="text-xs text-muted mb-4">New questions are added regularly.</p>
      <button
        onClick={onReset}
        className="px-4 py-2 text-sm font-semibold rounded"
        style={{ background: 'var(--green)', color: '#fff' }}
      >
        Practice again from the start
      </button>
    </div>
  );
}
