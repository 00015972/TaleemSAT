export const FALLBACK_TIMEZONE = 'Asia/Tashkent';

export function isValidTimeZone(value: string): boolean {
  if (!value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: string | null | undefined): string {
  const candidate = value?.trim() ?? '';
  return isValidTimeZone(candidate) ? candidate : FALLBACK_TIMEZONE;
}

export function localDateAt(date: Date, timeZone: string): string {
  const normalized = normalizeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalized,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (kind: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === kind)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Invalid ISO date: ${isoDate}`);
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return shifted.toISOString().slice(0, 10);
}

export function mondayWeekStart(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ISO date: ${isoDate}`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return shiftIsoDate(isoDate, -daysSinceMonday);
}
