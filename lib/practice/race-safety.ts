export type PendingPracticeSubmission = {
  sessionId: string;
  submissionId: string;
  questionId: string;
  selectedAnswer: string;
  timeTakenMs: number | null;
};

export function createKeyedLoader<T>(load: (id: string) => Promise<T>) {
  const inFlight = new Map<string, Promise<T>>();

  return (id: string): Promise<T> => {
    const existing = inFlight.get(id);
    if (existing) return existing;

    const request = Promise.resolve()
      .then(() => load(id))
      .finally(() => {
        if (inFlight.get(id) === request) inFlight.delete(id);
      });

    inFlight.set(id, request);
    return request;
  };
}

export class LatestRequestGate {
  private latest = 0;

  begin(): number {
    this.latest += 1;
    return this.latest;
  }

  isCurrent(requestId: number): boolean {
    return requestId === this.latest;
  }
}

export class SynchronousLock {
  private locked = false;

  acquire(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  release(): void {
    this.locked = false;
  }
}

export function isActiveQuestion(
  displayedQuestionId: string | null | undefined,
  activeManifestId: string | null | undefined
): boolean {
  return displayedQuestionId !== undefined
    && displayedQuestionId !== null
    && displayedQuestionId === activeManifestId;
}

export function getOrCreatePendingSubmission(
  submissions: Map<string, PendingPracticeSubmission>,
  input: PendingPracticeSubmission
): PendingPracticeSubmission | null {
  const existing = submissions.get(input.questionId);
  if (existing) {
    return existing.sessionId === input.sessionId
      && existing.submissionId === input.submissionId
      && existing.selectedAnswer === input.selectedAnswer
      ? existing
      : null;
  }

  const submission = { ...input };
  submissions.set(input.questionId, submission);
  return submission;
}
