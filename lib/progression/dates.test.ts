import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FALLBACK_TIMEZONE,
  isValidTimeZone,
  localDateAt,
  mondayWeekStart,
  normalizeTimeZone,
  shiftIsoDate,
} from './dates';

test('validates IANA zones and falls back safely', () => {
  assert.equal(isValidTimeZone('Asia/Tashkent'), true);
  assert.equal(isValidTimeZone('Not/A_Zone'), false);
  assert.equal(normalizeTimeZone('Not/A_Zone'), FALLBACK_TIMEZONE);
  assert.equal(normalizeTimeZone(null), FALLBACK_TIMEZONE);
});

test('maps UTC instants to the saved local calendar date', () => {
  const instant = new Date('2026-09-08T19:30:00.000Z');
  assert.equal(localDateAt(instant, 'UTC'), '2026-09-08');
  assert.equal(localDateAt(instant, 'Asia/Tashkent'), '2026-09-09');
  assert.equal(localDateAt(new Date('2026-09-08T03:00:00.000Z'), 'America/New_York'), '2026-09-07');
});

test('shifts ISO dates across month, year, and leap-day boundaries', () => {
  assert.equal(shiftIsoDate('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftIsoDate('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftIsoDate('2028-02-29', 1), '2028-03-01');
});

test('uses Monday as the local week boundary', () => {
  assert.equal(mondayWeekStart('2026-09-07'), '2026-09-07');
  assert.equal(mondayWeekStart('2026-09-13'), '2026-09-07');
  assert.equal(mondayWeekStart('2026-09-14'), '2026-09-14');
});
