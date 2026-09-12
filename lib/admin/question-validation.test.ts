import assert from 'node:assert/strict';
import test from 'node:test';
import { validateQuestion, type QuestionInput } from './question-validation';

const base: QuestionInput = {
  subjectId: '11111111-1111-4111-8111-111111111111',
  categoryId: '22222222-2222-4222-8222-222222222222',
  questionText: 'What value satisfies the displayed equation?',
  passage: null,
  options: { A: '', B: '', C: '', D: '' },
  correctAnswer: '3/2',
  acceptedAnswers: ['3/2', '1.5'],
  explanation: 'Solving the equation gives three halves, which is also 1.5.',
  difficulty: 'medium',
  status: 'draft',
  questionType: 'grid_in',
};

test('accepts valid equivalent grid-in answer keys', () => {
  assert.equal(validateQuestion(base).ok, true);
  assert.equal(validateQuestion({ ...base, correctAnswer: '6/4' }).ok, true);
});

test('rejects malformed, duplicate, empty, and excessive accepted answers', () => {
  const cases: QuestionInput[] = [
    { ...base, acceptedAnswers: ['3abc'] },
    { ...base, acceptedAnswers: ['3/0'] },
    { ...base, acceptedAnswers: ['3/2', '3/2'] },
    { ...base, acceptedAnswers: ['3/2', ''] },
    { ...base, acceptedAnswers: Array.from({ length: 17 }, (_, index) => String(index + 1)) },
  ];

  for (const input of cases) {
    const result = validateQuestion(input);
    assert.equal(result.ok, false);
    assert.ok(result.fieldErrors.acceptedAnswers);
  }
});

test('rejects a malformed or unrelated canonical grid-in answer', () => {
  for (const correctAnswer of ['3abc', '2']) {
    const result = validateQuestion({ ...base, correctAnswer });
    assert.equal(result.ok, false);
    assert.ok(result.fieldErrors.correctAnswer);
  }
});
