import { validateQuestion } from '@/lib/admin/question-validation';
import type { interpretAnswer, QuestionPages } from '@/lib/import/pdf-text';
import type { TranscribedQuestion } from '@/lib/ai/vision';

/**
 * Verification rules for extracted questions.
 *
 * Pure and free of any Trigger.dev or Supabase import, so the decision about
 * what is safe to import can be exercised directly in a test rather than only
 * by running a whole extraction job.
 */

export type ItemStatus = 'pending_review' | 'verification_failed';
export type Taxonomy = { topicId: string; categoryId: string; subjectId: string | null };

/**
 * Decide whether an extracted question is fit for review or needs flagging.
 *
 * Two independent readings of the answer exist — the PDF's own text layer and
 * the vision model's reading of the page. When both are present and disagree,
 * a human must look before this can ever become a question.
 */
export function reconcile(
  meta: QuestionPages['meta'],
  fromText: ReturnType<typeof interpretAnswer>,
  transcribed: TranscribedQuestion,
  taxonomy: Taxonomy | undefined
): {
  status: ItemStatus;
  issues: string[];
  verification: Record<string, unknown>;
} {
  const issues: string[] = [];

  if (!taxonomy) {
    issues.push(
      `Skill "${meta.skill ?? 'unknown'}" did not match any topic — set subject, category and topic by hand.`
    );
  }

  // Shape check, using the same rules the admin form and API enforce.
  const validation = validateQuestion({
    subjectId: taxonomy?.subjectId ?? '',
    categoryId: taxonomy?.categoryId ?? '',
    questionText: transcribed.questionText,
    passage: transcribed.passage,
    options: {
      A: transcribed.options.find(o => o.id === 'A')?.text ?? '',
      B: transcribed.options.find(o => o.id === 'B')?.text ?? '',
      C: transcribed.options.find(o => o.id === 'C')?.text ?? '',
      D: transcribed.options.find(o => o.id === 'D')?.text ?? '',
    },
    correctAnswer: transcribed.correctAnswer ?? '',
    explanation: transcribed.explanation,
    difficulty: meta.difficulty ?? '',
    status: 'draft',
    questionType: transcribed.questionType,
    acceptedAnswers: transcribed.acceptedAnswers,
  });
  issues.push(...validation.errors);

  // Cross-check the answer key against the model's reading.
  let answersAgree: boolean | null = null;
  if (!meta.correctAnswerRaw) {
    // The PDF drew its answer as vector art too, so the model's reading is the
    // only one we have. No second opinion means no verification — say so, and
    // let a human confirm rather than trusting a single unchecked source.
    issues.push(
      'The answer is not in the PDF text layer, so only the model read it — no cross-check was possible. Confirm the answer against the source page.'
    );
  } else {
    if (fromText.questionType !== transcribed.questionType) {
      answersAgree = false;
      issues.push(
        `Question type disagreement: text layer implies ${fromText.questionType}, model read ${transcribed.questionType}.`
      );
    } else if (fromText.questionType === 'mcq') {
      answersAgree = fromText.correctAnswer === transcribed.correctAnswer;
      if (!answersAgree) {
        issues.push(
          `Answer disagreement: PDF says ${fromText.correctAnswer}, model read ${transcribed.correctAnswer}.`
        );
      }
    } else {
      // Grid-in: the model may legitimately add equivalent forms, so require
      // only that the PDF's forms all survive.
      const modelSet = new Set(transcribed.acceptedAnswers.map(a => a.toLowerCase()));
      const missing = fromText.acceptedAnswers.filter(a => !modelSet.has(a.toLowerCase()));
      answersAgree = missing.length === 0;
      if (!answersAgree) {
        issues.push(`Model dropped accepted answer(s) the PDF lists: ${missing.join(', ')}.`);
      }
    }
  }

  if (transcribed.hasFigure) {
    issues.push(
      'Question depends on a figure. Attach a cropped image before publishing — the page render includes the rationale and cannot be shown to students.'
    );
  }
  if (transcribed.confidence === 'low') {
    issues.push('Model reported low confidence in this transcription.');
  }

  const verification = {
    questionId: meta.questionId,
    textLayerAnswer: meta.correctAnswerRaw,
    modelAnswer: transcribed.correctAnswer ?? transcribed.acceptedAnswers,
    answersAgree,
    confidence: transcribed.confidence,
    hasFigure: transcribed.hasFigure,
    modelNotes: transcribed.notes,
  };

  // Anything unresolved blocks the fast path; the reviewer still sees it all.
  const status: ItemStatus = issues.length > 0 ? 'verification_failed' : 'pending_review';
  return { status, issues, verification };
}
