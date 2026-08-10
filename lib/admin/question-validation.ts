/**
 * Shared question validation — used by the admin question form (instant
 * feedback), the create/update API routes, the CSV importer, and the
 * import pipeline's promotion step. Pure: no I/O.
 *
 * Rules from docs/08-admin-panel.md:
 *  - question_text ≥ 10 chars
 *  - explanation ≥ 30 chars (we never publish thin explanations)
 *  - if passage present, ≥ 50 chars (otherwise fold it into question_text)
 *  - difficulty ∈ easy/medium/hard
 *  - status ∈ draft/published/archived
 *
 * Shape rules depend on question_type, mirroring the real Digital SAT:
 *  - mcq: all 4 options non-empty, correct_answer ∈ A/B/C/D
 *  - grid_in (student-produced response): no options; at least one accepted
 *    answer, since a grid-in has several equally-valid written forms
 *    (e.g. 3/2 and 1.5).
 */

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const STATUSES = ['draft', 'published', 'archived'] as const;
export const ANSWER_KEYS = ['A', 'B', 'C', 'D'] as const;
export const QUESTION_TYPES = ['mcq', 'grid_in'] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
export type QuestionStatus = (typeof STATUSES)[number];
export type AnswerKey = (typeof ANSWER_KEYS)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type QuestionOptions = { A: string; B: string; C: string; D: string };

export type QuestionInput = {
  subjectId: string;
  categoryId: string;
  questionText: string;
  passage?: string | null;
  /** Ignored when questionType is 'grid_in'. */
  options: QuestionOptions;
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  status: string;
  tags?: string[];
  /** Defaults to 'mcq' so existing callers keep their current behaviour. */
  questionType?: string;
  /** Grid-in only: every accepted written form of the answer. */
  acceptedAnswers?: string[];
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  /** field-keyed errors for inline form display */
  fieldErrors: Partial<Record<string, string>>;
};

export function validateQuestion(input: QuestionInput): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: Partial<Record<string, string>> = {};

  const add = (field: string, message: string) => {
    errors.push(message);
    if (!fieldErrors[field]) fieldErrors[field] = message;
  };

  if (!input.subjectId) add('subjectId', 'Subject is required.');
  if (!input.categoryId) add('categoryId', 'Category is required.');

  const questionText = (input.questionText ?? '').trim();
  if (questionText.length < 10) {
    add('questionText', 'Question text must be at least 10 characters.');
  }

  const questionType = (input.questionType ?? 'mcq') as QuestionType;
  if (!QUESTION_TYPES.includes(questionType)) {
    add('questionType', 'Question type must be mcq or grid_in.');
  }

  if (questionType === 'grid_in') {
    // Student-produced response: the student types a value, so there are no
    // options — but every accepted form of the answer must be listed.
    const accepted = (input.acceptedAnswers ?? []).map(a => (a ?? '').trim()).filter(Boolean);
    if (accepted.length === 0) {
      add(
        'acceptedAnswers',
        'Grid-in questions need at least one accepted answer (e.g. "3/2", "1.5").'
      );
    }
  } else {
    for (const key of ANSWER_KEYS) {
      const val = (input.options?.[key] ?? '').trim();
      if (!val) add(`option_${key}`, `Option ${key} cannot be empty.`);
    }

    if (!ANSWER_KEYS.includes(input.correctAnswer as AnswerKey)) {
      add('correctAnswer', 'Correct answer must be A, B, C, or D.');
    }
  }

  const explanation = (input.explanation ?? '').trim();
  if (explanation.length < 30) {
    add('explanation', 'Explanation must be at least 30 characters.');
  }

  const passage = (input.passage ?? '').trim();
  if (passage && passage.length < 50) {
    add(
      'passage',
      'Passage must be at least 50 characters — otherwise include it in the question text.'
    );
  }

  if (!DIFFICULTIES.includes(input.difficulty as Difficulty)) {
    add('difficulty', 'Difficulty must be easy, medium, or hard.');
  }

  if (!STATUSES.includes(input.status as QuestionStatus)) {
    add('status', 'Status must be draft, published, or archived.');
  }

  return { ok: errors.length === 0, errors, fieldErrors };
}
