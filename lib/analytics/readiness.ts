export const DAY_MS = 24 * 60 * 60 * 1000;

export type ReadinessAttempt = {
  isCorrect: boolean;
  createdAt: string;
  categorySlug: string | null;
};

export type ReadinessConfidence = 'low' | 'medium' | 'high';

export type ReadinessFactors = {
  accuracy: number;
  momentum: number;
  coverage: number;
  evidence: number;
};

export type ReadinessSnapshot = {
  value: number | null;
  confidence: ReadinessConfidence;
  factors: ReadinessFactors;
  attempts: number;
  correct: number;
  accuracy: number | null;
  recent14Accuracy: number | null;
  previous14Accuracy: number | null;
  momentumDelta: number | null;
  reliableCategories: number;
  availableCategories: number;
  activeDays7: number;
};

export type ReadinessPoint = ReadinessSnapshot & {
  date: string;
  attemptsToday: number;
};

const EMPTY_FACTORS: ReadinessFactors = {
  accuracy: 0,
  momentum: 0,
  coverage: 0,
  evidence: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function accuracyOf(attempts: ReadinessAttempt[]) {
  if (attempts.length === 0) return null;
  return attempts.filter(attempt => attempt.isCorrect).length / attempts.length;
}

function inWindow(attempt: ReadinessAttempt, end: number, days: number) {
  const timestamp = new Date(attempt.createdAt).getTime();
  return timestamp <= end && timestamp > end - days * DAY_MS;
}

function utcDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function computeReadiness(
  attempts: ReadinessAttempt[],
  availableCategorySlugs: string[],
  asOf: Date = new Date()
): ReadinessSnapshot {
  const end = asOf.getTime();
  const trailing = attempts.filter(attempt => inWindow(attempt, end, 30));
  const recent14 = attempts.filter(attempt => inWindow(attempt, end, 14));
  const previous14 = attempts.filter(attempt => {
    const timestamp = new Date(attempt.createdAt).getTime();
    return timestamp <= end - 14 * DAY_MS && timestamp > end - 28 * DAY_MS;
  });

  const available = [...new Set(availableCategorySlugs.filter(Boolean))];
  const counts = new Map<string, number>();
  for (const attempt of trailing) {
    if (!attempt.categorySlug || !available.includes(attempt.categorySlug)) continue;
    counts.set(attempt.categorySlug, (counts.get(attempt.categorySlug) ?? 0) + 1);
  }
  const reliableCategories = [...counts.values()].filter(count => count >= 3).length;
  const activeDays7 = new Set(
    attempts
      .filter(attempt => inWindow(attempt, end, 7))
      .map(attempt => attempt.createdAt.slice(0, 10))
  ).size;

  if (trailing.length === 0) {
    return {
      value: null,
      confidence: 'low',
      factors: EMPTY_FACTORS,
      attempts: 0,
      correct: 0,
      accuracy: null,
      recent14Accuracy: accuracyOf(recent14),
      previous14Accuracy: accuracyOf(previous14),
      momentumDelta: null,
      reliableCategories,
      availableCategories: available.length,
      activeDays7,
    };
  }

  const correct = trailing.filter(attempt => attempt.isCorrect).length;
  const adjustedAccuracy = (correct + 6) / (trailing.length + 10);
  const accuracyPoints = adjustedAccuracy * 50;

  const recent14Accuracy = accuracyOf(recent14);
  const previous14Accuracy = accuracyOf(previous14);
  const momentumDelta =
    recent14Accuracy === null || previous14Accuracy === null
      ? null
      : recent14Accuracy - previous14Accuracy;
  const momentumPoints =
    momentumDelta === null
      ? 10
      : 10 + clamp(Math.round(momentumDelta * 100), -10, 10);

  const coveragePoints = available.length
    ? (reliableCategories / available.length) * 20
    : 0;
  const evidencePoints = Math.min(trailing.length / 60, 1) * 10;
  const value = Math.round(
    clamp(accuracyPoints + momentumPoints + coveragePoints + evidencePoints, 0, 100)
  );

  const confidence: ReadinessConfidence =
    trailing.length >= 60 && reliableCategories >= 6
      ? 'high'
      : trailing.length >= 20 && reliableCategories >= 3
        ? 'medium'
        : 'low';

  return {
    value,
    confidence,
    factors: {
      accuracy: accuracyPoints,
      momentum: momentumPoints,
      coverage: coveragePoints,
      evidence: evidencePoints,
    },
    attempts: trailing.length,
    correct,
    accuracy: trailing.length ? correct / trailing.length : null,
    recent14Accuracy,
    previous14Accuracy,
    momentumDelta,
    reliableCategories,
    availableCategories: available.length,
    activeDays7,
  };
}

export function buildReadinessSeries(
  attempts: ReadinessAttempt[],
  availableCategorySlugs: string[],
  asOf: Date = new Date(),
  days = 30
): ReadinessPoint[] {
  const end = new Date(asOf);
  end.setUTCHours(23, 59, 59, 999);

  return Array.from({ length: days }, (_, index) => {
    const pointEnd = end.getTime() - (days - 1 - index) * DAY_MS;
    const snapshot = computeReadiness(
      attempts,
      availableCategorySlugs,
      new Date(pointEnd)
    );
    const date = utcDate(pointEnd);
    const attemptsToday = attempts.filter(attempt => attempt.createdAt.slice(0, 10) === date).length;
    return { ...snapshot, date, attemptsToday };
  });
}

export function computeFocusedDrillGain(
  attempts: ReadinessAttempt[],
  availableCategorySlugs: string[],
  categorySlug: string | null,
  asOf: Date = new Date()
) {
  if (!categorySlug) return null;
  const current = computeReadiness(attempts, availableCategorySlugs, asOf);
  if (current.value === null) return null;

  const hypothetical: ReadinessAttempt[] = Array.from({ length: 12 }, (_, index) => ({
    isCorrect: index < 9,
    createdAt: new Date(asOf.getTime() + index * 1000).toISOString(),
    categorySlug,
  }));
  const futureAsOf = new Date(asOf.getTime() + 12_000);
  const projected = computeReadiness(
    [...attempts, ...hypothetical],
    availableCategorySlugs,
    futureAsOf
  );

  return projected.value === null ? null : Math.max(0, projected.value - current.value);
}
