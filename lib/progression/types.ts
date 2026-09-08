export const DAILY_STREAK_GOAL = 5 as const;

export type DailyProgressState = {
  activityDate: string;
  newQuestions: number;
  xpEarned: number;
  streakEarned: boolean;
  goal: typeof DAILY_STREAK_GOAL;
};

export type ProgressionSnapshot = {
  timezone: string;
  today: DailyProgressState;
  weekXp: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
};

export type ProgressionAward = {
  attemptId: string;
  questionId: string;
  baseXp: number;
  bonusXp: number;
  xpAwarded: number;
  streakExtended: boolean;
};

export type ProgressionOutcome = {
  isFirstEver: boolean;
  baseXp: number;
  bonusXp: number;
  xpAwarded: number;
  streakExtended: boolean;
  snapshot: ProgressionSnapshot;
};

export type MockProgressionSummary = {
  newQuestions: number;
  xpAwarded: number;
  streakExtended: boolean;
  snapshot: ProgressionSnapshot;
};
