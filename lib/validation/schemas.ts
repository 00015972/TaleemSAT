import { z } from 'zod';
import {
  isValidGridInAnswer,
  MAX_GRID_IN_ANSWER_LENGTH,
} from '@/lib/grading/grid-in';

export const MAX_TIME_TAKEN_MS = 86_400_000;
export const MAX_ACCEPTED_ANSWERS = 16;
export const MAX_BULK_IDS = 200;
export const MAX_MOCK_ANSWERS = 40;

export const uuidSchema = z.string().uuid();

const uniqueStrings = (values: string[]) => new Set(values).size === values.length;

const boundedText = (max: number) => z.string().max(max);
const answerKeySchema = z.enum(['A', 'B', 'C', 'D']);
const gridInResponseSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_GRID_IN_ANSWER_LENGTH)
  .refine(isValidGridInAnswer, 'Expected a complete integer, decimal, or fraction.');

export const studentAnswerSchema = z.union([answerKeySchema, gridInResponseSchema]);

export const timeTakenMsSchema = z
  .number()
  .finite()
  .int()
  .min(0)
  .max(MAX_TIME_TAKEN_MS);

export const practiceAnswerSchema = z.strictObject({
  sessionId: uuidSchema,
  submissionId: uuidSchema,
  selectedAnswer: studentAnswerSchema,
  timeTakenMs: timeTakenMsSchema.nullable().optional(),
});

const mockAnswerSchema = z.strictObject({
  submissionId: uuidSchema,
  selectedAnswer: studentAnswerSchema.nullable(),
  timeTakenMs: timeTakenMsSchema.nullable().optional(),
});

export const mockSubmissionSchema = z.strictObject({
  sessionId: uuidSchema,
  answers: z
    .array(mockAnswerSchema)
    .max(MAX_MOCK_ANSWERS)
    .refine(
      answers => uniqueStrings(answers.map(answer => answer.submissionId)),
      'Submission IDs must be unique.'
    ),
});

function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export const profileUpdateSchema = z.strictObject({
  fullName: z.string().trim().max(100),
  targetSatScore: z.number().int().min(400).max(1600).nullable(),
  examDate: z
    .string()
    .refine(isIsoCalendarDate, 'Expected an ISO calendar date.')
    .nullable(),
  marketingOptIn: z.boolean(),
});

export const timezoneUpdateSchema = z.strictObject({
  timezone: z.string().trim().min(1).max(100),
});

const questionOptionsSchema = z.strictObject({
  A: boundedText(20_000),
  B: boundedText(20_000),
  C: boundedText(20_000),
  D: boundedText(20_000),
});

const acceptedAnswersSchema = z
  .array(z.string().trim().min(1).max(MAX_GRID_IN_ANSWER_LENGTH))
  .max(MAX_ACCEPTED_ANSWERS)
  .refine(uniqueStrings, 'Accepted answers must be unique.');

const tagsSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(32)
  .refine(uniqueStrings, 'Tags must be unique.');

export const questionInputSchema = z.strictObject({
  subjectId: uuidSchema,
  categoryId: uuidSchema,
  questionText: boundedText(100_000),
  passage: boundedText(250_000).nullable().optional(),
  options: questionOptionsSchema,
  correctAnswer: z.string().trim().max(MAX_GRID_IN_ANSWER_LENGTH),
  explanation: boundedText(100_000),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  status: z.enum(['draft', 'published', 'archived']),
  tags: tagsSchema.optional(),
  questionType: z.enum(['mcq', 'grid_in']).optional(),
  acceptedAnswers: acceptedAnswersSchema.optional(),
});

export const bulkQuestionActionSchema = z.strictObject({
  ids: z
    .array(uuidSchema)
    .min(1)
    .max(MAX_BULK_IDS)
    .refine(uniqueStrings, 'Question IDs must be unique.'),
  action: z.enum(['publish', 'archive', 'delete']),
});

export const adminUserUpdateSchema = z
  .strictObject({
    role: z.enum(['student', 'admin']).optional(),
    tier: z.enum(['free', 'pro', 'elite']).optional(),
  })
  .refine(body => body.role !== undefined || body.tier !== undefined, 'No update supplied.');

const importOptionSchema = z.strictObject({
  id: answerKeySchema,
  text: boundedText(20_000),
});

export const importItemUpdateSchema = z
  .strictObject({
    questionText: boundedText(100_000).optional(),
    passage: boundedText(250_000).nullable().optional(),
    options: z
      .array(importOptionSchema)
      .max(4)
      .refine(options => uniqueStrings(options.map(option => option.id)), 'Option IDs must be unique.')
      .optional(),
    correctAnswer: z.string().trim().max(MAX_GRID_IN_ANSWER_LENGTH).nullable().optional(),
    acceptedAnswers: acceptedAnswersSchema.optional(),
    explanation: boundedText(100_000).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    questionType: z.enum(['mcq', 'grid_in']).optional(),
    questionImageUrl: z.string().url().max(2_048).nullable().optional(),
    topicId: uuidSchema.nullable().optional(),
    status: z.enum(['pending_review', 'rejected']).optional(),
  })
  .refine(body => Object.keys(body).length > 0, 'No update supplied.');

export const importPromotionSchema = z.strictObject({
  itemIds: z
    .array(uuidSchema)
    .min(1)
    .max(MAX_BULK_IDS)
    .refine(uniqueStrings, 'Item IDs must be unique.'),
});
