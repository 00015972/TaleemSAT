/**
 * Scores a student-produced-response (grid-in) answer against every accepted
 * written form (`questions.accepted_answers`) — e.g. an answer key of
 * ['3/2', '1.5'] accepts either written form, and a submission of "6/4" also
 * matches numerically even though it's neither literal string.
 *
 * Mirrors the Digital SAT's own grid-in rules: an exact (case-insensitive,
 * whitespace-trimmed) string match always counts, and otherwise numeric
 * equivalence is checked — with "a/b" read as a fraction, not a decimal.
 *
 * Pure — no I/O — used server-side by every scoring route (practice/mock)
 * so a submission can never be graded differently in two places.
 */

function parseAnswerNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  const fraction = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const num = parseFloat(fraction[1]);
    const den = parseFloat(fraction[2]);
    if (den !== 0 && !isNaN(num) && !isNaN(den)) return num / den;
    return null;
  }

  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

export function gridInAnswerMatches(submitted: string, acceptedAnswers: string[]): boolean {
  const value = (submitted ?? '').trim();
  if (!value) return false;

  const submittedNumber = parseAnswerNumber(value);

  for (const accepted of acceptedAnswers) {
    const form = (accepted ?? '').trim();
    if (!form) continue;
    if (value.toLowerCase() === form.toLowerCase()) return true;

    const acceptedNumber = parseAnswerNumber(form);
    if (submittedNumber !== null && acceptedNumber !== null && Math.abs(submittedNumber - acceptedNumber) < 1e-9) {
      return true;
    }
  }
  return false;
}
