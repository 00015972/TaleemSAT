import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminUserNoteSchema,
  adminUserUpdateSchema,
  bulkQuestionActionSchema,
  importItemUpdateSchema,
  importPromotionSchema,
  MAX_MOCK_ANSWERS,
  mockSubmissionSchema,
  practiceAnswerSchema,
  profileUpdateSchema,
  questionInputSchema,
  timezoneUpdateSchema,
  uuidSchema,
} from './schemas';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const SUBMISSION_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_ID = '44444444-4444-4444-8444-444444444444';

test('practice answers require bounded UUID, answer, timing, and exact keys', () => {
  assert.equal(practiceAnswerSchema.safeParse({
    sessionId: SESSION_ID,
    submissionId: SUBMISSION_ID,
    selectedAnswer: '6/4',
    timeTakenMs: 1250,
  }).success, true);

  const invalid = [
    { sessionId: 'session-1', submissionId: SUBMISSION_ID, selectedAnswer: 'A' },
    { sessionId: SESSION_ID, submissionId: SUBMISSION_ID, selectedAnswer: 'E' },
    { sessionId: SESSION_ID, submissionId: SUBMISSION_ID, selectedAnswer: '3abc' },
    { sessionId: SESSION_ID, submissionId: SUBMISSION_ID, selectedAnswer: null },
    { sessionId: SESSION_ID, submissionId: SUBMISSION_ID, selectedAnswer: 'A', timeTakenMs: -1 },
    { sessionId: SESSION_ID, submissionId: SUBMISSION_ID, selectedAnswer: 'A', timeTakenMs: Infinity },
    { sessionId: SESSION_ID, submissionId: SUBMISSION_ID, selectedAnswer: 'A', recordAttempt: true },
    { sessionId: SESSION_ID, submissionId: SUBMISSION_ID, selectedAnswer: 'A', questionId: ID_A },
    { sessionId: SESSION_ID, selectedAnswer: 'A' },
    { submissionId: SUBMISSION_ID, selectedAnswer: 'A' },
  ];
  for (const value of invalid) assert.equal(practiceAnswerSchema.safeParse(value).success, false);
});

test('mock submissions are bounded, unique, and permit unanswered entries', () => {
  assert.equal(mockSubmissionSchema.safeParse({
    sessionId: SESSION_ID,
    answers: [
      { submissionId: SUBMISSION_ID, selectedAnswer: null, timeTakenMs: null },
      { submissionId: ID_B, selectedAnswer: '.5', timeTakenMs: 0 },
    ],
  }).success, true);

  assert.equal(mockSubmissionSchema.safeParse({
    sessionId: SESSION_ID,
    answers: [
      { submissionId: SUBMISSION_ID, selectedAnswer: 'A' },
      { submissionId: SUBMISSION_ID, selectedAnswer: 'B' },
    ],
  }).success, false);

  assert.equal(mockSubmissionSchema.safeParse({
    sessionId: SESSION_ID,
    answers: Array.from({ length: MAX_MOCK_ANSWERS + 1 }, (_, index) => ({
      submissionId: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
      selectedAnswer: 'A',
    })),
  }).success, false);
});

test('profile and timezone schemas validate bounded normalized values', () => {
  const profile = profileUpdateSchema.parse({
    fullName: '  Student Name  ',
    targetSatScore: 1450,
    examDate: '2026-12-05',
    marketingOptIn: false,
  });
  assert.equal(profile.fullName, 'Student Name');

  for (const value of [
    { ...profile, targetSatScore: 399 },
    { ...profile, targetSatScore: 1601 },
    { ...profile, examDate: '2026-02-30' },
    { ...profile, examDate: '' },
    { ...profile, marketingOptIn: 'false' },
  ]) {
    assert.equal(profileUpdateSchema.safeParse(value).success, false);
  }

  assert.equal(timezoneUpdateSchema.parse({ timezone: ' Asia/Tashkent ' }).timezone, 'Asia/Tashkent');
  assert.equal(timezoneUpdateSchema.safeParse({ timezone: '' }).success, false);
});

test('question and admin schemas reject malformed IDs, arrays, and enums', () => {
  const question = {
    subjectId: ID_A,
    categoryId: ID_B,
    questionText: 'A sufficiently long question?',
    passage: null,
    options: { A: 'One', B: 'Two', C: 'Three', D: 'Four' },
    correctAnswer: 'A',
    explanation: 'A sufficiently detailed explanation for this question.',
    difficulty: 'medium',
    status: 'draft',
    tags: ['algebra'],
    questionType: 'mcq',
    acceptedAnswers: [],
  };
  assert.equal(questionInputSchema.safeParse(question).success, true);
  assert.equal(questionInputSchema.safeParse({ ...question, subjectId: 'bad' }).success, false);
  assert.equal(questionInputSchema.safeParse({ ...question, difficulty: 'extreme' }).success, false);
  assert.equal(questionInputSchema.safeParse({ ...question, tags: ['same', 'same'] }).success, false);
  assert.equal(questionInputSchema.safeParse({ ...question, extra: true }).success, false);

  assert.equal(bulkQuestionActionSchema.safeParse({ ids: [ID_A, ID_B], action: 'archive' }).success, true);
  assert.equal(bulkQuestionActionSchema.safeParse({ ids: [ID_A, ID_A], action: 'archive' }).success, false);
  assert.equal(adminUserUpdateSchema.safeParse({ role: 'admin' }).success, true);
  assert.equal(adminUserUpdateSchema.safeParse({}).success, false);
  assert.equal(adminUserNoteSchema.parse({ body: '  Follow up next week.  ' }).body, 'Follow up next week.');
  assert.equal(adminUserNoteSchema.safeParse({ body: '   ' }).success, false);
  assert.equal(adminUserNoteSchema.safeParse({ body: 'x'.repeat(2_001) }).success, false);
  assert.equal(uuidSchema.safeParse('not-a-uuid').success, false);
});

test('import schemas bound edits and promotions', () => {
  assert.equal(importItemUpdateSchema.safeParse({
    correctAnswer: null,
    acceptedAnswers: ['3/2', '1.5'],
    options: [],
  }).success, true);
  assert.equal(importItemUpdateSchema.safeParse({}).success, false);
  assert.equal(importItemUpdateSchema.safeParse({
    options: [
      { id: 'A', text: 'one' },
      { id: 'A', text: 'duplicate' },
    ],
  }).success, false);
  assert.equal(importPromotionSchema.safeParse({ itemIds: [ID_A] }).success, true);
  assert.equal(importPromotionSchema.safeParse({ itemIds: [ID_A, ID_A] }).success, false);
});
