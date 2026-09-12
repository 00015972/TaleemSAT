import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createKeyedLoader,
  getOrCreatePendingSubmission,
  isActiveQuestion,
  LatestRequestGate,
  SynchronousLock,
  type PendingPracticeSubmission,
} from './race-safety';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('latest request gate rejects stale navigation completions', () => {
  const gate = new LatestRequestGate();
  const first = gate.begin();
  const second = gate.begin();

  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
});

test('keyed loader shares an in-flight request and retries after settlement', async () => {
  const pending = deferred<string>();
  let calls = 0;
  const load = createKeyedLoader(async id => {
    calls += 1;
    return pending.promise.then(value => `${id}:${value}`);
  });

  const first = load('question-a');
  const second = load('question-a');
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);

  pending.resolve('ready');
  assert.equal(await first, 'question-a:ready');
  assert.equal(await second, 'question-a:ready');

  assert.equal(await load('question-a'), 'question-a:ready');
  assert.equal(calls, 2);
});

test('keyed loader also clears a rejected request', async () => {
  let calls = 0;
  const load = createKeyedLoader(async () => {
    calls += 1;
    if (calls === 1) throw new Error('offline');
    return 'recovered';
  });

  await assert.rejects(load('question-a'), /offline/);
  assert.equal(await load('question-a'), 'recovered');
  assert.equal(calls, 2);
});

test('synchronous lock excludes a second call before any render update', () => {
  const lock = new SynchronousLock();

  assert.equal(lock.acquire(), true);
  assert.equal(lock.acquire(), false);
  lock.release();
  assert.equal(lock.acquire(), true);
});

test('pending submission preserves its original replay payload', () => {
  const submissions = new Map<string, PendingPracticeSubmission>();
  let keys = 0;
  const createKey = () => `submission-${++keys}`;

  const first = getOrCreatePendingSubmission(
    submissions,
    { questionId: 'question-a', selectedAnswer: 'B', timeTakenMs: 1_250 },
    createKey
  );
  const retry = getOrCreatePendingSubmission(
    submissions,
    { questionId: 'question-a', selectedAnswer: 'B', timeTakenMs: 9_999 },
    createKey
  );
  const conflicting = getOrCreatePendingSubmission(
    submissions,
    { questionId: 'question-a', selectedAnswer: 'C', timeTakenMs: 1_250 },
    createKey
  );

  assert.deepEqual(first, {
    questionId: 'question-a',
    selectedAnswer: 'B',
    timeTakenMs: 1_250,
    submissionKey: 'submission-1',
  });
  assert.equal(retry, first);
  assert.equal(conflicting, null);
  assert.equal(keys, 1);
});

test('active question requires the displayed and manifest identifiers to match', () => {
  assert.equal(isActiveQuestion('question-a', 'question-a'), true);
  assert.equal(isActiveQuestion('question-a', 'question-b'), false);
  assert.equal(isActiveQuestion(null, 'question-a'), false);
});
