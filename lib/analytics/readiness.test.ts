import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReadinessSeries,
  computeFocusedDrillGain,
  computeReadiness,
  DAY_MS,
  type ReadinessAttempt,
} from './readiness';

const NOW = new Date('2026-09-08T12:00:00.000Z');
const CATEGORIES = ['algebra', 'advanced-math', 'transitions', 'geometry'];

function attempt(daysAgo: number, isCorrect: boolean, categorySlug = 'algebra'): ReadinessAttempt {
  return {
    isCorrect,
    categorySlug,
    createdAt: new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString(),
  };
}

test('returns no index when the student has no trailing evidence', () => {
  const result = computeReadiness([], CATEGORIES, NOW);
  assert.equal(result.value, null);
  assert.equal(result.confidence, 'low');
});

test('small-sample adjustment prevents one correct answer from looking ready', () => {
  const result = computeReadiness([attempt(1, true)], CATEGORIES, NOW);
  assert.ok(result.value !== null && result.value < 50);
  assert.equal(result.factors.momentum, 10);
});

test('uses neutral momentum without both comparison windows', () => {
  const result = computeReadiness([attempt(1, true), attempt(2, false)], CATEGORIES, NOW);
  assert.equal(result.momentumDelta, null);
  assert.equal(result.factors.momentum, 10);
});

test('clamps strongly positive and negative momentum', () => {
  const improving = [
    ...Array.from({ length: 10 }, (_, index) => attempt(index + 1, true)),
    ...Array.from({ length: 10 }, (_, index) => attempt(index + 15, false)),
  ];
  const declining = improving.map(item => ({
    ...item,
    isCorrect: !item.isCorrect,
  }));
  assert.equal(computeReadiness(improving, CATEGORIES, NOW).factors.momentum, 20);
  assert.equal(computeReadiness(declining, CATEGORIES, NOW).factors.momentum, 0);
});

test('coverage counts only categories with at least three recent attempts', () => {
  const attempts = [
    attempt(1, true, 'algebra'),
    attempt(2, true, 'algebra'),
    attempt(3, false, 'algebra'),
    attempt(1, true, 'transitions'),
    attempt(2, false, 'transitions'),
  ];
  const result = computeReadiness(attempts, CATEGORIES, NOW);
  assert.equal(result.reliableCategories, 1);
  assert.equal(result.factors.coverage, 5);
});

test('evidence caps at ten and high confidence needs breadth', () => {
  const attempts = Array.from({ length: 80 }, (_, index) =>
    attempt(index % 20, index % 4 !== 0, CATEGORIES[index % CATEGORIES.length])
  );
  const result = computeReadiness(attempts, CATEGORIES, NOW);
  assert.equal(result.factors.evidence, 10);
  assert.equal(result.confidence, 'medium');
});

test('historical series carries readiness through a day without attempts', () => {
  const attempts = [attempt(3, true), attempt(3, false), attempt(1, true)];
  const series = buildReadinessSeries(attempts, CATEGORIES, NOW, 4);
  assert.equal(series.length, 4);
  assert.equal(series[0].attemptsToday, 2);
  assert.equal(series[1].attemptsToday, 0);
  assert.notEqual(series[1].value, null);
});

test('focused drill impact is deterministic and never negative', () => {
  const attempts = Array.from({ length: 16 }, (_, index) =>
    attempt(index % 8, index % 3 !== 0, index % 2 ? 'algebra' : 'transitions')
  );
  const gain = computeFocusedDrillGain(attempts, CATEGORIES, 'transitions', NOW);
  assert.ok(gain !== null && gain >= 0);
});
