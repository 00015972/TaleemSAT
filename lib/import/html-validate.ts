import { validateQuestion } from '@/lib/admin/question-validation';
import type { ParsedQuestion } from './html-questions';

export type ItemStatus = 'pending_review' | 'verification_failed';
export type Taxonomy = { topicId: string; categoryId: string; subjectId: string | null };

/**
 * Verification rules for the HTML import path.
 *
 * There is no second AI reading to cross-check against — everything the HTML
 * explicitly tagged either parsed cleanly or surfaces as a specific,
 * actionable issue. "Reconciliation" is therefore structural: did the source
 * itself supply a usable answer key, options, and taxonomy. Any issue blocks
 * the fast path and routes the item to a human.
 *
 * Pure — no I/O.
 */
export function validateHtmlItem(
  q: ParsedQuestion,
  taxonomy: Taxonomy | undefined
): {
  status: ItemStatus;
  issues: string[];
  verification: Record<string, unknown>;
} {
  const issues: string[] = [...q.structuralFlags];

  if (!taxonomy) {
    issues.push(
      `Skill "${q.skill ?? 'unknown'}" did not match any topic — set subject, category and topic by hand.`
    );
  }

  const validation = validateQuestion({
    subjectId: taxonomy?.subjectId ?? '',
    categoryId: taxonomy?.categoryId ?? '',
    questionText: q.questionText,
    passage: q.passage,
    options: {
      A: q.options.find(o => o.id === 'A')?.text ?? '',
      B: q.options.find(o => o.id === 'B')?.text ?? '',
      C: q.options.find(o => o.id === 'C')?.text ?? '',
      D: q.options.find(o => o.id === 'D')?.text ?? '',
    },
    correctAnswer: q.correctAnswer ?? '',
    explanation: q.explanation,
    difficulty: q.difficulty ?? '',
    status: 'draft',
    questionType: q.questionType,
    acceptedAnswers: q.acceptedAnswers,
  });
  issues.push(...validation.errors);

  if (q.figureDataUrls.length > 0) {
    // Only a pasted raster image needs this — it's an opaque crop the parser
    // can't verify. A chart_svg is real inspectable markup (already validated
    // structurally and rendered right in this review card), so it doesn't
    // need the same manual confirmation gate.
    issues.push(
      'Question includes an embedded figure — confirm the attached image is correct and necessary before publishing.'
    );
  }
  if (q.hasComplexTable) {
    issues.push(
      'Table has merged cells, is nested, or its rows don’t line up with its headers — verify it renders correctly before publishing.'
    );
  }

  const verification = {
    sourceQid: q.sourceQid,
    badges: {
      assessment: q.assessment,
      subject: q.subjectBadge,
      domain: q.domain,
      skill: q.skill,
    },
    hasFigure: q.hasFigure,
    hasComplexTable: q.hasComplexTable,
    structuralFlags: q.structuralFlags,
  };

  const status: ItemStatus = issues.length > 0 ? 'verification_failed' : 'pending_review';
  return { status, issues, verification };
}
