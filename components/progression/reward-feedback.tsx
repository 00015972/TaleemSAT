import { Flame, Sparkles, Trophy } from 'lucide-react';
import type { MockProgressionSummary, ProgressionOutcome } from '@/lib/progression/types';

export function QuestionRewardFeedback({ outcome }: { outcome: ProgressionOutcome | null }) {
  if (!outcome) return null;

  const { snapshot } = outcome;
  const progress = `${snapshot.today.newQuestions}/${snapshot.today.goal} new questions today`;

  return (
    <div
      className={`progress-reward${outcome.streakExtended ? ' is-streak' : ''}${
        outcome.isFirstEver ? '' : ' is-familiar'
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="progress-reward-icon" aria-hidden="true">
        {outcome.streakExtended ? <Flame /> : outcome.isFirstEver ? <Trophy /> : <Sparkles />}
      </span>
      <span className="progress-reward-copy">
        <strong>
          {outcome.streakExtended
            ? `Streak extended · ${snapshot.currentStreak} days`
            : outcome.isFirstEver
              ? `+${outcome.xpAwarded} XP`
              : 'Practice logged'}
        </strong>
        <small>
          {outcome.isFirstEver
            ? `${outcome.bonusXp > 0 ? '5 effort + 5 correct bonus' : '5 effort XP'} · ${progress}`
            : `No new XP — already attempted · ${progress}`}
        </small>
      </span>
    </div>
  );
}

export function MockRewardSummary({ summary }: { summary: MockProgressionSummary | null }) {
  if (!summary) return null;

  return (
    <div
      className={`progress-reward progress-reward-mock${summary.streakExtended ? ' is-streak' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="progress-reward-icon" aria-hidden="true">
        {summary.streakExtended ? <Flame /> : <Trophy />}
      </span>
      <span className="progress-reward-copy">
        <strong>
          {summary.xpAwarded > 0
            ? `+${summary.xpAwarded} XP from ${summary.newQuestions} new question${summary.newQuestions === 1 ? '' : 's'}`
            : 'No new XP this time'}
        </strong>
        <small>
          {summary.streakExtended
            ? `Streak extended to ${summary.snapshot.currentStreak} days`
            : `${summary.snapshot.today.newQuestions}/${summary.snapshot.today.goal} new questions today`}
        </small>
      </span>
    </div>
  );
}
