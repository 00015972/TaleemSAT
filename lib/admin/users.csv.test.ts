import assert from 'node:assert/strict';
import test from 'node:test';

import { csvCell, usersToCsv } from './users.csv';
import type { UserDirectoryRow } from './users.types';

test('escapes quotes and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('A "quoted" name'), '"A ""quoted"" name"');
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell(null), '""');
});

test('exports stable user columns with a UTF-8 BOM', () => {
  const row: UserDirectoryRow = {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Amir Karimov',
    email: 'amir@example.test',
    role: 'student',
    tier: 'elite',
    subscriptionStatus: 'active',
    createdAt: '2026-06-11T10:00:00.000Z',
    lastActiveAt: '2026-09-13T10:00:00.000Z',
    attempts7d: 12,
    totalAttempts: 48,
    correctAttempts: 36,
    accuracy: 75,
    dailyActivity: [0, 2, 1, 3, 0, 4, 2],
  };
  const csv = usersToCsv([row]);
  assert.equal(csv.startsWith('\uFEFF"User ID"'), true);
  assert.match(csv, /"Amir Karimov","amir@example\.test"/);
  assert.match(csv, /"12","48","75"/);
});
