import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countPracticeHighlights,
  updatePracticeHighlights,
  type PracticeHighlights,
} from './highlights';

test('passage and stem word indices are stored independently', () => {
  const highlights = updatePracticeHighlights(
    {},
    [
      { region: 'passage', index: 0 },
      { region: 'stem', index: 0 },
    ],
    'yellow'
  );

  assert.deepEqual(highlights, {
    passage: { 0: 'yellow' },
    stem: { 0: 'yellow' },
  });
  assert.equal(countPracticeHighlights(highlights), 2);
});

test('updates do not mutate highlights kept for navigation history', () => {
  const current: PracticeHighlights = {
    passage: { 2: 'blue' },
    stem: { 4: 'pink' },
  };

  const next = updatePracticeHighlights(
    current,
    [{ region: 'stem', index: 4 }],
    'yellow'
  );

  assert.deepEqual(current, {
    passage: { 2: 'blue' },
    stem: { 4: 'pink' },
  });
  assert.deepEqual(next, {
    passage: { 2: 'blue' },
    stem: { 4: 'yellow' },
  });
});

test('erasing the last word removes only its empty region', () => {
  const next = updatePracticeHighlights(
    {
      passage: { 1: 'yellow' },
      stem: { 3: 'blue' },
    },
    [{ region: 'passage', index: 1 }],
    null
  );

  assert.deepEqual(next, { stem: { 3: 'blue' } });
  assert.equal(countPracticeHighlights(next), 1);
});
