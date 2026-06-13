'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { id: string; text: string };

export type QODQuestion = {
  id: string;
  passage: string | null;
  question_text: string;
  options: Option[];
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
};

export type QOD = {
  id: string;
  scheduled_date: string;
  question: QODQuestion;
};

export type PriorAnswer = {
  selected_answer: string;
  is_correct: boolean;
  points_awarded: number;
};

type AnswerResult = {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  pointsAwarded: number;
  newPoints: number;
  newStreak: number;
};

type Phase =
  | { name: 'question' }
  | { name: 'selected'; selected: string }
  | { name: 'submitting'; selected: string }
  | { name: 'result'; selected: string; result: AnswerResult }
  | { name: 'already_answered'; answer: PriorAnswer };

// ─── Main component ───────────────────────────────────────────────────────────

export function QODShell({
  qod,
  priorAnswer,
}: {
  qod: QOD;
  priorAnswer: PriorAnswer | null;
}) {
  const [phase, setPhase] = useState<Phase>(
    priorAnswer ? { name: 'already_answered', answer: priorAnswer } : { name: 'question' }
  );

  // Re-picking another option is allowed any time before checking.
  const selectOption = useCallback((id: string) => {
    setPhase(p =>
      p.name === 'question' || p.name === 'selected'
        ? { name: 'selected', selected: id }
        : p
    );
  }, []);

  const submit = useCallback(async () => {
    if (phase.name !== 'selected') return;
    const { selected } = phase;
    setPhase({ name: 'submitting', selected });

    try {
      const res = await fetch('/api/qod/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qodId: qod.id, selectedAnswer: selected }),
      });
      const result = await res.json() as AnswerResult;
      setPhase({ name: 'result', selected, result });
    } catch {
      setPhase({ name: 'selected', selected });
    }
  }, [phase, qod.id]);

  // Answer with the keyboard: A–D (or 1–4) to choose, Enter to check.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (phase.name !== 'question' && phase.name !== 'selected') return;

      const letter = e.key.toUpperCase();
      const opts = qod.question.options;
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
        submit();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, qod.question.options, selectOption, submit]);

  const selected =
    phase.name === 'selected' || phase.name === 'submitting' || phase.name === 'result'
      ? phase.selected
      : phase.name === 'already_answered'
        ? phase.answer.selected_answer
        : null;

  const result = phase.name === 'result' ? phase.result : null;
  const prior = phase.name === 'already_answered' ? phase.answer : null;
  const scored = result !== null || prior !== null;
  const isInteractive = phase.name === 'question' || phase.name === 'selected';
  const isSubmitting = phase.name === 'submitting';

  // Glide the verdict into view when a long question pushes it below the fold.
  const verdictRef = useRef<HTMLDivElement | null>(null);
  const hasResult = result !== null;
  useEffect(() => {
    if (!hasResult) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    verdictRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [hasResult]);

  const dateLabel = new Date(qod.scheduled_date + 'T00:00:00').toLocaleDateString(
    'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }
  );

  const wasCorrect = result?.isCorrect ?? prior?.is_correct ?? false;

  return (
    <div className="max-w-2xl">
      <div className="prx-card">
        <div className="prx-card-head">
          <span className="prx-meta">
            <span className="prx-qnum">Today</span>
            {dateLabel}
            <DifficultyBadge difficulty={qod.question.difficulty} />
          </span>
          {scored ? (
            <span className={`qod-pill ${wasCorrect ? 'ok' : 'err'}`}>
              {wasCorrect
                ? `+${result?.pointsAwarded ?? prior?.points_awarded ?? 1} point earned`
                : 'Answered today'}
            </span>
          ) : (
            <span className="qod-pill gold">+1 point on the line</span>
          )}
        </div>

        {qod.question.passage && (
          <div className="prx-passage prx-anim">{qod.question.passage}</div>
        )}

        <p className="prx-stem prx-anim" style={{ animationDelay: '0.06s' }}>
          {qod.question.question_text}
        </p>

        <div className="prx-opts" role="group" aria-label="Answer choices">
          {qod.question.options.map((opt, i) => (
            <OptionButton
              key={opt.id}
              option={opt}
              index={i}
              selected={selected}
              correctAnswer={
                result?.correctAnswer ??
                (prior?.is_correct ? prior.selected_answer : null)
              }
              scored={scored}
              interactive={isInteractive}
              onSelect={selectOption}
            />
          ))}
        </div>

        {scored && (
          <div className="prx-anim" ref={verdictRef}>
            <div className="prx-verdict">
              <span className={`word ${wasCorrect ? 'good' : 'bad'}`}>
                {wasCorrect ? 'Correct.' : 'Not quite.'}
              </span>
              <span className="sub">
                {result
                  ? result.isCorrect
                    ? `+${result.pointsAwarded} point · ${result.newPoints} total · ${result.newStreak}-day streak`
                    : `the key was ${result.correctAnswer} · streak intact`
                  : wasCorrect
                    ? `+${prior!.points_awarded} point earned today`
                    : 'a fresh question lands tomorrow'}
              </span>
            </div>
            {result && (
              <div className="prx-expl">
                <p className="prx-expl-label">Explanation</p>
                <p className="prx-expl-body">{result.explanation}</p>
              </div>
            )}
            <p
              className="text-sm text-muted"
              style={{ marginTop: '0.9rem', fontFamily: 'var(--serif-body)', fontStyle: 'italic' }}
            >
              Come back tomorrow for the next one.
            </p>
          </div>
        )}

        {!scored && (
          <div className="prx-actions">
            <button
              onClick={submit}
              disabled={phase.name !== 'selected' || isSubmitting}
              className="prx-btn"
            >
              {isSubmitting ? 'Checking…' : 'Check answer'}
            </button>
            <span className="prx-kbd-hint">A–D to choose · Enter to check</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Option button ────────────────────────────────────────────────────────────

function OptionButton({
  option,
  index,
  selected,
  correctAnswer,
  scored,
  interactive,
  onSelect,
}: {
  option: Option;
  index: number;
  selected: string | null;
  correctAnswer: string | null;
  scored: boolean;
  interactive: boolean;
  onSelect: (id: string) => void;
}) {
  const isSelected = selected === option.id;
  const isKey = scored && correctAnswer === option.id;
  const isMiss = scored && isSelected && !isKey;

  let state = '';
  if (scored) {
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
      {isKey && (
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
