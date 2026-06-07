'use client';

import { useState } from 'react';

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

  function selectOption(id: string) {
    if (phase.name !== 'question') return;
    setPhase({ name: 'selected', selected: id });
  }

  async function submit() {
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
  }

  const selected =
    phase.name === 'selected' || phase.name === 'submitting' || phase.name === 'result'
      ? phase.selected
      : phase.name === 'already_answered'
        ? phase.answer.selected_answer
        : null;

  const result = phase.name === 'result' ? phase.result : null;

  const alreadyAnswered =
    phase.name === 'already_answered'
      ? phase.answer
      : result
        ? {
            selected_answer: result.correctAnswer,
            is_correct: result.isCorrect,
            points_awarded: result.pointsAwarded,
          }
        : null;

  const isInteractive = phase.name === 'question' || phase.name === 'selected';
  const isSubmitting = phase.name === 'submitting';

  const dateLabel = new Date(qod.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="eyebrow mb-1">Question of the Day</div>
          <p className="text-sm text-muted">{dateLabel}</p>
        </div>
        {!alreadyAnswered && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-s text-sm font-semibold"
            style={{ background: 'color-mix(in srgb, var(--gold) 15%, transparent)', color: 'var(--gold)' }}
          >
            <span>+1 point on the line</span>
          </div>
        )}
        {alreadyAnswered && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-s text-sm font-semibold"
            style={{
              background: alreadyAnswered.is_correct
                ? 'color-mix(in srgb, var(--ok) 12%, transparent)'
                : 'color-mix(in srgb, var(--err) 10%, transparent)',
              color: alreadyAnswered.is_correct ? 'var(--ok)' : 'var(--err)',
            }}
          >
            {alreadyAnswered.is_correct ? `+${alreadyAnswered.points_awarded} point earned` : 'Answered today'}
          </div>
        )}
      </div>

      {/* Card */}
      <div
        className="rounded-l p-6 flex flex-col gap-5"
        style={{ background: 'var(--surf)', border: '1px solid var(--border)' }}
      >
        <DifficultyBadge difficulty={qod.question.difficulty} />

        {/* Passage */}
        {qod.question.passage && (
          <div
            className="rounded p-4 text-sm leading-relaxed font-serif-body max-h-48 overflow-y-auto"
            style={{ background: 'var(--bg)', borderLeft: '3px solid var(--gold)', color: 'var(--txt)' }}
          >
            {qod.question.passage}
          </div>
        )}

        {/* Question */}
        <p className="text-base font-medium leading-relaxed text-txt">
          {qod.question.question_text}
        </p>

        {/* Options */}
        <div className="flex flex-col gap-2">
          {qod.question.options.map(opt => (
            <OptionButton
              key={opt.id}
              option={opt}
              selected={selected}
              result={phase.name === 'result' ? phase.result : null}
              priorAnswer={phase.name === 'already_answered' ? phase.answer : null}
              interactive={isInteractive}
              onSelect={selectOption}
            />
          ))}
        </div>

        {/* Result banner */}
        {phase.name === 'result' && (
          <ResultBanner result={phase.result} />
        )}

        {/* Already answered banner */}
        {phase.name === 'already_answered' && (
          <AlreadyAnsweredBanner answer={phase.answer} />
        )}

        {/* Explanation — shown after answering */}
        {phase.name === 'result' && (
          <ExplanationBox explanation={phase.result.explanation} />
        )}

        {/* Submit button */}
        {isInteractive && (
          <button
            onClick={submit}
            disabled={phase.name !== 'selected' || isSubmitting}
            className="self-start rounded px-5 py-2.5 text-sm font-semibold disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--green)', color: '#fff' }}
          >
            {isSubmitting ? 'Checking…' : 'Submit answer'}
          </button>
        )}

        {phase.name === 'submitting' && (
          <button
            disabled
            className="self-start rounded px-5 py-2.5 text-sm font-semibold opacity-50"
            style={{ background: 'var(--green)', color: '#fff' }}
          >
            Checking…
          </button>
        )}

        {/* Come back tomorrow (already answered) */}
        {phase.name === 'already_answered' && (
          <p className="text-sm text-muted text-center pt-2">
            Come back tomorrow for the next question!
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionButton({
  option,
  selected,
  result,
  priorAnswer,
  interactive,
  onSelect,
}: {
  option: Option;
  selected: string | null;
  result: AnswerResult | null;
  priorAnswer: PriorAnswer | null;
  interactive: boolean;
  onSelect: (id: string) => void;
}) {
  const isSelected = selected === option.id;
  const correctAnswer = result?.correctAnswer ?? (priorAnswer?.is_correct ? priorAnswer.selected_answer : null);
  const hasResult = !!result || !!priorAnswer;

  const isCorrectOption = hasResult && correctAnswer === option.id;
  const isWrongPick = hasResult && isSelected && !isCorrectOption;

  let bg = 'var(--bg)';
  let border = 'var(--border)';
  let letterBg = 'var(--surf)';
  let letterColor = 'var(--txt-soft)';

  if (isCorrectOption) {
    bg = 'color-mix(in srgb, var(--ok) 10%, transparent)';
    border = 'var(--ok)';
    letterBg = 'var(--ok)';
    letterColor = '#fff';
  } else if (isWrongPick) {
    bg = 'color-mix(in srgb, var(--err) 10%, transparent)';
    border = 'var(--err)';
    letterBg = 'var(--err)';
    letterColor = '#fff';
  } else if (isSelected && !hasResult) {
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
      <span className="text-txt">{option.text}</span>
      {isCorrectOption && <span className="ml-auto shrink-0" style={{ color: 'var(--ok)' }}>✓</span>}
      {isWrongPick && <span className="ml-auto shrink-0" style={{ color: 'var(--err)' }}>✗</span>}
    </button>
  );
}

function ResultBanner({ result }: { result: AnswerResult }) {
  return (
    <div
      className="rounded px-4 py-3"
      style={{
        background: result.isCorrect
          ? 'color-mix(in srgb, var(--ok) 12%, transparent)'
          : 'color-mix(in srgb, var(--err) 10%, transparent)',
        border: `1px solid ${result.isCorrect ? 'color-mix(in srgb, var(--ok) 30%, transparent)' : 'color-mix(in srgb, var(--err) 25%, transparent)'}`,
      }}
    >
      {result.isCorrect ? (
        <p className="text-sm font-semibold" style={{ color: 'var(--ok)' }}>
          ✓ Correct! +{result.pointsAwarded} point earned.{' '}
          <span className="font-normal" style={{ color: 'var(--txt-soft)' }}>
            Total: {result.newPoints} points · {result.newStreak}-day streak 🔥
          </span>
        </p>
      ) : (
        <p className="text-sm font-semibold" style={{ color: 'var(--err)' }}>
          ✗ Not today — but tomorrow is a fresh chance.
        </p>
      )}
    </div>
  );
}

function AlreadyAnsweredBanner({ answer }: { answer: PriorAnswer }) {
  return (
    <div
      className="rounded px-4 py-3 text-sm"
      style={{
        background: answer.is_correct
          ? 'color-mix(in srgb, var(--ok) 10%, transparent)'
          : 'color-mix(in srgb, var(--border) 50%, transparent)',
        color: answer.is_correct ? 'var(--ok)' : 'var(--txt-soft)',
      }}
    >
      {answer.is_correct
        ? `You answered correctly and earned ${answer.points_awarded} point.`
        : "You answered today's question. Better luck tomorrow!"}
    </div>
  );
}

function ExplanationBox({ explanation }: { explanation: string }) {
  return (
    <div
      className="rounded p-4 text-sm leading-relaxed"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
    >
      <p className="eyebrow mb-2">Explanation</p>
      <p className="font-serif-body text-txt">{explanation}</p>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const color =
    difficulty === 'easy' ? 'var(--ok)' : difficulty === 'hard' ? 'var(--err)' : 'var(--gold)';
  return (
    <span
      className="inline-block px-2 py-0.5 text-xs font-semibold rounded-s capitalize"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      {difficulty}
    </span>
  );
}
