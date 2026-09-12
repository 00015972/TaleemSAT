/**
 * Scores a student-produced-response (grid-in) answer against every accepted
 * written form (`questions.accepted_answers`) — e.g. an answer key of
 * ['3/2', '1.5'] accepts either written form, and a submission of "6/4" also
 * matches numerically even though it's neither literal string.
 *
 * Only complete supported numeric forms are accepted. Numeric-prefix parsing
 * is deliberately forbidden: `3abc`, `3 cats`, and `3+7` are not answers to
 * `3`. Fractions are compared numerically, so reducible forms still work.
 *
 * Pure — no I/O — used server-side by every scoring route (practice/mock)
 * so a submission can never be graded differently in two places.
 */

export const MAX_GRID_IN_ANSWER_LENGTH = 32;

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const FRACTION_PATTERN = /^([+-]?\d+)\/([+-]?\d+)$/;

export function parseGridInAnswer(raw: string): number | null {
  const s = raw.trim();
  if (!s || s.length > MAX_GRID_IN_ANSWER_LENGTH) return null;

  const fraction = s.match(FRACTION_PATTERN);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    const value = numerator / denominator;
    return denominator !== 0 && Number.isFinite(value) ? value : null;
  }

  if (!DECIMAL_PATTERN.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

export function isValidGridInAnswer(raw: string): boolean {
  return parseGridInAnswer(raw) !== null;
}

export function gridInAnswerMatches(submitted: string, acceptedAnswers: string[]): boolean {
  const value = (submitted ?? '').trim();
  if (!value) return false;

  const submittedNumber = parseGridInAnswer(value);
  if (submittedNumber === null) return false;

  for (const accepted of acceptedAnswers) {
    const form = (accepted ?? '').trim();
    if (!form) continue;
    const acceptedNumber = parseGridInAnswer(form);
    if (acceptedNumber !== null && Math.abs(submittedNumber - acceptedNumber) < 1e-9) {
      return true;
    }
  }
  return false;
}
