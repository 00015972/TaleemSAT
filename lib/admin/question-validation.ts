/**
 * Shared question validation — used by the admin question form (instant
 * feedback), the create/update API routes, and the CSV importer. Pure: no I/O.
 *
 * Rules from docs/08-admin-panel.md:
 *  - all 4 options non-empty
 *  - correct_answer ∈ A/B/C/D
 *  - question_text ≥ 10 chars
 *  - explanation ≥ 30 chars (we never publish thin explanations)
 *  - if passage present, ≥ 50 chars (otherwise fold it into question_text)
 *  - difficulty ∈ easy/medium/hard
 *  - status ∈ draft/published/archived
 */

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const STATUSES = ['draft', 'published', 'archived'] as const;
export const ANSWER_KEYS = ['A', 'B', 'C', 'D'] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
export type QuestionStatus = (typeof STATUSES)[number];
export type AnswerKey = (typeof ANSWER_KEYS)[number];

export type QuestionOptions = { A: string; B: string; C: string; D: string };

export type QuestionInput = {
  subjectId: string;
  categoryId: string;
  questionText: string;
  passage?: string | null;
  options: QuestionOptions;
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  status: string;
  tags?: string[];
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

  for (const key of ANSWER_KEYS) {
    const val = (input.options?.[key] ?? '').trim();
    if (!val) add(`option_${key}`, `Option ${key} cannot be empty.`);
  }

  if (!ANSWER_KEYS.includes(input.correctAnswer as AnswerKey)) {
    add('correctAnswer', 'Correct answer must be A, B, C, or D.');
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
