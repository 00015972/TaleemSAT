import assert from 'node:assert/strict';
import test from 'node:test';
import {
  gridInAnswerMatches,
  isValidGridInAnswer,
  MAX_GRID_IN_ANSWER_LENGTH,
  parseGridInAnswer,
} from './grid-in';

test('parses complete supported grid-in forms', () => {
  const cases: Array<[string, number]> = [
    ['3', 3],
    ['+3', 3],
    ['-3', -3],
    ['1.5', 1.5],
    ['.5', 0.5],
    ['5.', 5],
    [' 3/2 ', 1.5],
    ['6/4', 1.5],
    ['-3/2', -1.5],
    ['3/-2', -1.5],
  ];

  for (const [raw, expected] of cases) {
    assert.equal(parseGridInAnswer(raw), expected, raw);
    assert.equal(isValidGridInAnswer(raw), true, raw);
  }
});

test('rejects malformed, partial, unsupported, and non-finite forms', () => {
  const invalid = [
    '',
    '   ',
    '3abc',
    '3 cats',
    '3+7',
    '1 / 2',
    '1/0',
    '0/0',
    '1/2/3',
    '1.5/3',
    '1e3',
    '1,000',
    '50%',
    'NaN',
    'Infinity',
    '--3',
    '.',
    '-.',
    '1\n2',
    '9'.repeat(MAX_GRID_IN_ANSWER_LENGTH + 1),
  ];

  for (const raw of invalid) {
    assert.equal(parseGridInAnswer(raw), null, raw);
    assert.equal(isValidGridInAnswer(raw), false, raw);
  }
});

test('matches only numerically equivalent valid answers', () => {
  assert.equal(gridInAnswerMatches('6/4', ['3/2', '1.5']), true);
  assert.equal(gridInAnswerMatches('.5', ['1/2']), true);
  assert.equal(gridInAnswerMatches('-2', ['-4/2']), true);
  assert.equal(gridInAnswerMatches('3abc', ['3']), false);
  assert.equal(gridInAnswerMatches('3 cats', ['3']), false);
  assert.equal(gridInAnswerMatches('3+7', ['3']), false);
  assert.equal(gridInAnswerMatches('3abc', ['3abc']), false);
  assert.equal(gridInAnswerMatches('3', ['3abc', '3']), true);
  assert.equal(gridInAnswerMatches('3', ['3abc']), false);
});
