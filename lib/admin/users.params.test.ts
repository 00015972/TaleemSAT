import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasActiveUsersFilters,
  parseUsersSearchParams,
  usersFiltersToSearchParams,
  USERS_SEARCH_MAX_LENGTH,
} from './users.params';

test('normalizes the default users workspace URL state', () => {
  assert.deepEqual(parseUsersSearchParams({}), {
    q: '',
    role: '',
    tier: '',
    segment: '',
    sort: 'newest',
    page: 1,
  });
});

test('accepts known filters and the first value from repeated params', () => {
  assert.deepEqual(
    parseUsersSearchParams({
      q: ['  learner@example.com  ', 'ignored'],
      role: 'admin',
      tier: 'elite',
      segment: 'recent-upgrade',
      sort: 'lowest-accuracy',
      page: '4',
    }),
    {
      q: 'learner@example.com',
      role: 'admin',
      tier: 'elite',
      segment: 'recent-upgrade',
      sort: 'lowest-accuracy',
      page: 4,
    }
  );
});

test('falls back safely for malformed enums and page values', () => {
  for (const page of ['0', '-3', 'NaN', '1.5', '']) {
    const parsed = parseUsersSearchParams({
      role: 'owner',
      tier: 'enterprise',
      segment: 'sleeping',
      sort: 'revenue',
      page,
    });
    assert.equal(parsed.role, '');
    assert.equal(parsed.tier, '');
    assert.equal(parsed.segment, '');
    assert.equal(parsed.sort, 'newest');
    assert.equal(parsed.page, 1);
  }
});

test('trims and bounds user search text', () => {
  const parsed = parseUsersSearchParams({ q: `  ${'x'.repeat(USERS_SEARCH_MAX_LENGTH + 40)}  ` });
  assert.equal(parsed.q.length, USERS_SEARCH_MAX_LENGTH);
});

test('serializes only meaningful filter state', () => {
  const filters = parseUsersSearchParams({ q: 'Amir', tier: 'pro', page: '3' });
  assert.equal(usersFiltersToSearchParams(filters).toString(), 'q=Amir&tier=pro');
  assert.equal(
    usersFiltersToSearchParams(filters, { includePage: true }).toString(),
    'q=Amir&tier=pro&page=3'
  );
  assert.equal(hasActiveUsersFilters(filters), true);
  assert.equal(hasActiveUsersFilters(parseUsersSearchParams({})), false);
});
