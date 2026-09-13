'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiEdit3,
  FiEye,
  FiGrid,
  FiLayers,
  FiSave,
} from 'react-icons/fi';
import {
  validateQuestion,
  ANSWER_KEYS,
  DIFFICULTIES,
  QUESTION_TYPES,
  type AnswerKey,
  type Difficulty,
  type QuestionOptions,
  type QuestionType,
} from '@/lib/admin/question-validation';
import { QuestionBody } from '@/components/reading/question-body';
import { ChartFigure } from '@/components/reading/chart-figure';

export type SubjectOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string; subjectId: string };

export type QuestionFormInitial = {
  subjectId: string;
  categoryId: string;
  questionText: string;
  passage: string;
  questionType: QuestionType;
  options: QuestionOptions;
  correctAnswer: string;
  /** Grid-in only: every accepted written form, e.g. ['3/2', '1.5']. */
  acceptedAnswers: string[];
  explanation: string;
  difficulty: string;
  status: string;
  tags: string[];
  /** Sanitized <table> markup, read-only here — see lib/import/table-sanitize.ts. */
  tables?: string[];
  /** Sanitized <svg> chart markup, read-only here — see lib/import/svg-sanitize.ts. */
  chartSvg?: string | null;
};

type StageId = 'foundation' | 'prompt' | 'answer' | 'review';

const EMPTY: QuestionFormInitial = {
  subjectId: '',
  categoryId: '',
  questionText: '',
  passage: '',
  questionType: 'mcq',
  options: { A: '', B: '', C: '', D: '' },
  correctAnswer: 'A',
  acceptedAnswers: [],
  explanation: '',
  difficulty: 'medium',
  status: 'draft',
  tags: [],
  tables: [],
  chartSvg: null,
};

const STAGES = [
  {
    id: 'foundation' as const,
    number: '01',
    title: 'Foundation',
    detail: 'Taxonomy & type',
    heading: 'Set the foundation',
    description: 'Classify the question before shaping its content.',
    icon: FiGrid,
  },
  {
    id: 'prompt' as const,
    number: '02',
    title: 'Prompt',
    detail: 'Passage & stem',
    heading: 'Write the prompt',
    description: 'Give students exactly the context they need—nothing more.',
    icon: FiEdit3,
  },
  {
    id: 'answer' as const,
    number: '03',
    title: 'Answer',
    detail: 'Key & rationale',
    heading: 'Build the answer',
    description: 'Define the response and explain why it is correct.',
    icon: FiBookOpen,
  },
  {
    id: 'review' as const,
    number: '04',
    title: 'Review',
    detail: 'Quality & publish',
    heading: 'Review and release',
    description: 'Resolve any quality checks, then save or publish.',
    icon: FiCheckCircle,
  },
] as const;

const STAGE_FIELDS: Record<StageId, string[]> = {
  foundation: ['subjectId', 'categoryId', 'difficulty', 'questionType'],
  prompt: ['passage', 'questionText'],
  answer: [
    'option_A',
    'option_B',
    'option_C',
    'option_D',
    'correctAnswer',
    'acceptedAnswers',
    'explanation',
  ],
  review: [],
};

const FIELD_LABELS: Record<string, string> = {
  subjectId: 'Choose a subject',
  categoryId: 'Choose a category',
  difficulty: 'Choose a valid difficulty',
  questionType: 'Choose a question type',
  passage: 'Expand or remove the reading passage',
  questionText: 'Complete the question text',
  option_A: 'Complete option A',
  option_B: 'Complete option B',
  option_C: 'Complete option C',
  option_D: 'Complete option D',
  correctAnswer: 'Choose the correct answer',
  acceptedAnswers: 'Add an accepted answer',
  explanation: 'Complete the explanation',
};

function stageForField(field: string): StageId {
  return (
    (Object.entries(STAGE_FIELDS).find(([, fields]) => fields.includes(field))?.[0] as
      | StageId
      | undefined) ?? 'review'
  );
}

function initialStage(initial?: QuestionFormInitial): StageId {
  if (!initial) return 'foundation';
  const validation = validateQuestion(initial);
  const firstInvalidField = Object.keys(validation.fieldErrors)[0];
  return firstInvalidField ? stageForField(firstInvalidField) : 'foundation';
}

export function QuestionForm({
  mode,
  questionId,
  subjects,
  categories,
  initial,
}: {
  mode: 'create' | 'edit';
  questionId?: string;
  subjects: SubjectOption[];
  categories: CategoryOption[];
  initial?: QuestionFormInitial;
}) {
  const router = useRouter();
  const [form, setForm] = useState<QuestionFormInitial>(initial ?? EMPTY);
  const [activeStage, setActiveStage] = useState<StageId>(() => initialStage(initial));
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(', '));
  const [acceptedInput, setAcceptedInput] = useState(
    (initial?.acceptedAnswers ?? []).join(', ')
  );
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null);
  const [serverError, setServerError] = useState('');
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  const tags = useMemo(
    () =>
      tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean),
    [tagsInput]
  );

  const acceptedAnswers = useMemo(
    () =>
      acceptedInput
        .split(',')
        .map(answer => answer.trim())
        .filter(Boolean),
    [acceptedInput]
  );

  const validation = useMemo(
    () =>
      validateQuestion({
        ...form,
        tags,
        acceptedAnswers,
        correctAnswer:
          form.questionType === 'grid_in' ? (acceptedAnswers[0] ?? '') : form.correctAnswer,
      }),
    [form, tags, acceptedAnswers]
  );

  const visibleCategories = categories.filter(category => category.subjectId === form.subjectId);
  const activeIndex = STAGES.findIndex(stage => stage.id === activeStage);
  const active = STAGES[activeIndex];
  const validationItems = Object.entries(validation.fieldErrors).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  );

  useEffect(() => {
    if (!focusTarget) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(focusTarget)?.focus();
      setFocusTarget(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeStage, focusTarget]);

  function set<K extends keyof QuestionFormInitial>(
    field: K,
    value: QuestionFormInitial[K]
  ) {
    setForm(previous => ({ ...previous, [field]: value }));
    if (serverError) setServerError('');
  }

  function setOption(key: AnswerKey, value: string) {
    setForm(previous => ({
      ...previous,
      options: { ...previous.options, [key]: value },
    }));
    if (serverError) setServerError('');
  }

  function fieldError(field: string): string | undefined {
    return submitted ? validation.fieldErrors[field] : undefined;
  }

  function stageHasError(stage: StageId) {
    return STAGE_FIELDS[stage].some(field => validation.fieldErrors[field]);
  }

  function stageIsComplete(stage: StageId) {
    if (stage === 'foundation') {
      return Boolean(form.subjectId && form.categoryId && form.difficulty && form.questionType);
    }
    if (stage === 'prompt') {
      const passage = form.passage.trim();
      return form.questionText.trim().length >= 10 && (!passage || passage.length >= 50);
    }
    if (stage === 'answer') {
      const responseComplete =
        form.questionType === 'grid_in'
          ? acceptedAnswers.length > 0
          : ANSWER_KEYS.every(key => form.options[key].trim()) &&
            ANSWER_KEYS.includes(form.correctAnswer as AnswerKey);
      return responseComplete && form.explanation.trim().length >= 30;
    }
    return validation.ok;
  }

  function goToStage(stage: StageId, field?: string) {
    setActiveStage(stage);
    if (field) setFocusTarget(field);
  }

  function moveStage(direction: -1 | 1) {
    const next = STAGES[activeIndex + direction];
    if (next) setActiveStage(next.id);
  }

  async function save(status: 'draft' | 'published') {
    setSubmitted(true);
    setServerError('');

    const payload = {
      subjectId: form.subjectId,
      categoryId: form.categoryId,
      questionText: form.questionText,
      passage: form.passage,
      questionType: form.questionType,
      options: form.options,
      status,
      difficulty: form.difficulty,
      explanation: form.explanation,
      tags,
      acceptedAnswers,
      correctAnswer:
        form.questionType === 'grid_in' ? (acceptedAnswers[0] ?? '') : form.correctAnswer,
    };
    const result = validateQuestion(payload);
    if (!result.ok) {
      const firstInvalidField = Object.keys(result.fieldErrors)[0];
      if (firstInvalidField) goToStage(stageForField(firstInvalidField), firstInvalidField);
      setServerError('Please resolve the highlighted quality checks before saving.');
      return;
    }

    setSaving(status);
    const url =
      mode === 'create' ? '/api/admin/questions' : `/api/admin/questions/${questionId}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setServerError(data?.errors?.[0] ?? 'Failed to save. Please try again.');
        setSaving(null);
        return;
      }
      router.push('/admin/questions');
      router.refresh();
    } catch {
      setServerError('Network error. Your entries are still here—please try again.');
      setSaving(null);
    }
  }

  return (
    <div className="question-studio">
      <div className="question-studio-ambient" aria-hidden="true">
        <span />
        <span />
      </div>

      <div className="question-studio-workspace">
        <nav className="question-studio-rail question-studio-enter" aria-label="Question authoring stages">
          <div className="question-studio-rail-head">
            <FiLayers aria-hidden="true" />
            <span>Authoring path</span>
          </div>
          <ol>
            {STAGES.map((stage, index) => {
              const Icon = stage.icon;
              const isActive = stage.id === activeStage;
              const hasError = submitted && stageHasError(stage.id);
              const isComplete = !hasError && stageIsComplete(stage.id);
              return (
                <li
                  key={stage.id}
                  className={`${isActive ? 'is-active ' : ''}${hasError ? 'has-error ' : ''}${isComplete ? 'is-complete' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => goToStage(stage.id)}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`${stage.number}. ${stage.title}${hasError ? ', needs attention' : isComplete ? ', complete' : ''}`}
                  >
                    <span className="question-studio-step-marker" aria-hidden="true">
                      {hasError ? (
                        <FiAlertCircle />
                      ) : isComplete && !isActive ? (
                        <FiCheck />
                      ) : (
                        <Icon />
                      )}
                    </span>
                    <span className="question-studio-step-copy">
                      <small>{stage.number}</small>
                      <strong>{stage.title}</strong>
                      <em>{stage.detail}</em>
                    </span>
                  </button>
                  {index < STAGES.length - 1 && <span className="question-studio-connector" aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
          <div className="question-studio-rail-note">
            <span aria-hidden="true" />
            <p>
              <strong>{mode === 'create' ? 'New draft' : 'Editing question'}</strong>
              Changes remain unsaved until you complete a save action.
            </p>
          </div>
        </nav>

        <main className="question-studio-editor question-studio-enter">
          <header className="question-studio-stage-head">
            <div>
              <p>Step {active.number} of 04</p>
              <h2>{active.heading}</h2>
              <span>{active.description}</span>
            </div>
            <div className="question-studio-progress" aria-label={`${activeIndex + 1} of 4 stages`}>
              <span style={{ width: `${((activeIndex + 1) / STAGES.length) * 100}%` }} />
            </div>
          </header>

          <div key={activeStage} className="question-studio-stage">
            {activeStage === 'foundation' && (
              <FoundationStage
                form={form}
                subjects={subjects}
                categories={visibleCategories}
                set={set}
                tagsInput={tagsInput}
                setTagsInput={value => {
                  setTagsInput(value);
                  if (serverError) setServerError('');
                }}
                fieldError={fieldError}
              />
            )}

            {activeStage === 'prompt' && (
              <PromptStage form={form} set={set} fieldError={fieldError} />
            )}

            {activeStage === 'answer' && (
              <AnswerStage
                form={form}
                set={set}
                setOption={setOption}
                acceptedInput={acceptedInput}
                setAcceptedInput={value => {
                  setAcceptedInput(value);
                  if (serverError) setServerError('');
                }}
                fieldError={fieldError}
              />
            )}

            {activeStage === 'review' && (
              <ReviewStage
                mode={mode}
                validationItems={validationItems}
                submitted={submitted}
                serverError={serverError}
                saving={saving}
                goToField={(field, stage) => goToStage(stage, field)}
                save={save}
              />
            )}
          </div>

          {activeStage !== 'review' && (
            <footer className="question-studio-stage-actions">
              {activeIndex > 0 ? (
                <button type="button" className="question-studio-back" onClick={() => moveStage(-1)}>
                  <FiArrowLeft aria-hidden="true" />
                  Back
                </button>
              ) : (
                <span />
              )}
              <button type="button" className="question-studio-next" onClick={() => moveStage(1)}>
                Continue to {STAGES[activeIndex + 1]?.title.toLowerCase()}
                <FiArrowRight aria-hidden="true" />
              </button>
            </footer>
          )}
        </main>

        <aside className="question-studio-preview question-studio-enter">
          <PreviewHeader difficulty={form.difficulty} />
          <QuestionPreview form={form} />
          <p className="question-studio-preview-note">
            <FiEye aria-hidden="true" />
            Synced with every change
          </p>
        </aside>
      </div>

      <details className="question-studio-mobile-preview">
        <summary>
          <FiEye aria-hidden="true" />
          Open student preview
          <span>{form.difficulty}</span>
        </summary>
        <div>
          <PreviewHeader difficulty={form.difficulty} />
          <QuestionPreview form={form} />
        </div>
      </details>
    </div>
  );
}

function FoundationStage({
  form,
  subjects,
  categories,
  set,
  tagsInput,
  setTagsInput,
  fieldError,
}: {
  form: QuestionFormInitial;
  subjects: SubjectOption[];
  categories: CategoryOption[];
  set: <K extends keyof QuestionFormInitial>(field: K, value: QuestionFormInitial[K]) => void;
  tagsInput: string;
  setTagsInput: (value: string) => void;
  fieldError: (field: string) => string | undefined;
}) {
  return (
    <div className="question-studio-fields">
      <div className="question-studio-field-grid">
        <Field label="Subject" htmlFor="subjectId" error={fieldError('subjectId')} required>
          <select
            id="subjectId"
            className="question-studio-control"
            value={form.subjectId}
            onChange={event => {
              set('subjectId', event.target.value);
              set('categoryId', '');
            }}
          >
            <option value="">Select subject…</option>
            {subjects.map(subject => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category" htmlFor="categoryId" error={fieldError('categoryId')} required>
          <select
            id="categoryId"
            className="question-studio-control"
            value={form.categoryId}
            disabled={!form.subjectId}
            onChange={event => set('categoryId', event.target.value)}
          >
            <option value="">{form.subjectId ? 'Select category…' : 'Choose a subject first'}</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Difficulty" error={fieldError('difficulty')} required>
        <div className="question-studio-segment" id="difficulty" role="group" aria-label="Difficulty" tabIndex={-1}>
          {DIFFICULTIES.map(difficulty => (
            <button
              key={difficulty}
              type="button"
              onClick={() => set('difficulty', difficulty as Difficulty)}
              aria-pressed={form.difficulty === difficulty}
              className={form.difficulty === difficulty ? 'is-selected' : undefined}
            >
              <span aria-hidden="true" />
              {difficulty[0].toUpperCase() + difficulty.slice(1)}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="Tags"
        htmlFor="tags"
        hint="Comma-separated labels make the question easier to find later."
      >
        <input
          id="tags"
          className="question-studio-control"
          value={tagsInput}
          onChange={event => setTagsInput(event.target.value)}
          placeholder="e.g. quadratic, factoring"
        />
      </Field>

      <Field label="Question type" error={fieldError('questionType')} required>
        <div className="question-studio-type-grid" id="questionType" role="group" aria-label="Question type" tabIndex={-1}>
          {QUESTION_TYPES.map(type => {
            const isSelected = form.questionType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => set('questionType', type)}
                aria-pressed={isSelected}
                className={isSelected ? 'is-selected' : undefined}
              >
                <span className="question-studio-type-icon" aria-hidden="true">
                  {type === 'mcq' ? <FiGrid /> : <FiEdit3 />}
                </span>
                <span>
                  <strong>{type === 'mcq' ? 'Multiple choice' : 'Grid-in answer'}</strong>
                  <small>
                    {type === 'mcq'
                      ? 'Four choices with one answer key'
                      : 'One or more accepted written forms'}
                  </small>
                </span>
                <FiCheck className="question-studio-type-check" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

function PromptStage({
  form,
  set,
  fieldError,
}: {
  form: QuestionFormInitial;
  set: <K extends keyof QuestionFormInitial>(field: K, value: QuestionFormInitial[K]) => void;
  fieldError: (field: string) => string | undefined;
}) {
  return (
    <div className="question-studio-fields">
      <Field
        label="Reading passage"
        htmlFor="passage"
        hint="Optional. Use only when the question references a passage of at least 50 characters."
        error={fieldError('passage')}
        badge="Optional"
      >
        <textarea
          id="passage"
          className="question-studio-control question-studio-passage"
          rows={5}
          value={form.passage}
          onChange={event => set('passage', event.target.value)}
          placeholder="Paste the reading passage here…"
        />
      </Field>

      <Field
        label="Question text"
        htmlFor="questionText"
        hint={
          form.tables && form.tables.length > 0
            ? `Includes ${form.tables.length === 1 ? 'a table' : `${form.tables.length} tables`}. Keep the [[table:N]] marker${form.tables.length === 1 ? '' : 's'} in place.`
            : 'Write the complete stem exactly as the student should read it.'
        }
        error={fieldError('questionText')}
        required
      >
        <textarea
          id="questionText"
          className="question-studio-control question-studio-question"
          rows={10}
          value={form.questionText}
          onChange={event => set('questionText', event.target.value)}
          placeholder="What should the student solve or determine?"
        />
      </Field>
    </div>
  );
}

function AnswerStage({
  form,
  set,
  setOption,
  acceptedInput,
  setAcceptedInput,
  fieldError,
}: {
  form: QuestionFormInitial;
  set: <K extends keyof QuestionFormInitial>(field: K, value: QuestionFormInitial[K]) => void;
  setOption: (key: AnswerKey, value: string) => void;
  acceptedInput: string;
  setAcceptedInput: (value: string) => void;
  fieldError: (field: string) => string | undefined;
}) {
  const optionsError = ANSWER_KEYS.some(key => fieldError(`option_${key}`));

  return (
    <div className="question-studio-fields">
      {form.questionType === 'mcq' ? (
        <fieldset className={`question-studio-options${optionsError ? ' has-error' : ''}`}>
          <legend>Answer options</legend>
          <p>Select a letter to mark the correct answer.</p>
          <div className="question-studio-option-list">
            {ANSWER_KEYS.map(key => {
              const isKey = form.correctAnswer === key;
              return (
                <div key={key} className={`question-studio-option${isKey ? ' is-key' : ''}`}>
                  <button
                    type="button"
                    className="question-studio-answer-key"
                    onClick={() => set('correctAnswer', key)}
                    title={`Mark option ${key} as the correct answer`}
                    aria-label={`Option ${key}${isKey ? ', correct answer' : ', mark as correct answer'}`}
                    aria-pressed={isKey}
                  >
                    {key}
                  </button>
                  <input
                    id={`option_${key}`}
                    className="question-studio-control"
                    value={form.options[key]}
                    onChange={event => setOption(key, event.target.value)}
                    placeholder={`Write option ${key}`}
                    aria-label={`Option ${key}`}
                    aria-invalid={Boolean(fieldError(`option_${key}`))}
                  />
                  {isKey && (
                    <span className="question-studio-key-label">
                      <FiCheck aria-hidden="true" />
                      Answer key
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {optionsError && <span className="question-studio-error">All four options must be filled in.</span>}
        </fieldset>
      ) : (
        <Field
          label="Accepted answers"
          htmlFor="acceptedAnswers"
          hint='List every equivalent written form, separated by commas—for example, "3/2, 1.5".'
          error={fieldError('acceptedAnswers')}
          required
        >
          <input
            id="acceptedAnswers"
            className="question-studio-control"
            value={acceptedInput}
            onChange={event => setAcceptedInput(event.target.value)}
            placeholder="e.g. 3/2, 1.5"
          />
        </Field>
      )}

      <Field
        label="Explanation"
        htmlFor="explanation"
        hint="Required. Explain why the answer is correct in at least 30 characters."
        error={fieldError('explanation')}
        required
      >
        <textarea
          id="explanation"
          className="question-studio-control question-studio-explanation"
          rows={7}
          value={form.explanation}
          onChange={event => set('explanation', event.target.value)}
          placeholder="Walk the student through the reasoning…"
        />
      </Field>
    </div>
  );
}

function ReviewStage({
  mode,
  validationItems,
  submitted,
  serverError,
  saving,
  goToField,
  save,
}: {
  mode: 'create' | 'edit';
  validationItems: [string, string][];
  submitted: boolean;
  serverError: string;
  saving: 'draft' | 'published' | null;
  goToField: (field: string, stage: StageId) => void;
  save: (status: 'draft' | 'published') => void;
}) {
  const ready = validationItems.length === 0;

  return (
    <div className="question-studio-review">
      <div className={`question-studio-quality ${ready ? 'is-ready' : 'needs-work'}`}>
        <span className="question-studio-quality-icon" aria-hidden="true">
          {ready ? <FiCheckCircle /> : <FiAlertCircle />}
        </span>
        <div>
          <p>{ready ? 'Quality check complete' : `${validationItems.length} quality check${validationItems.length === 1 ? '' : 's'} remaining`}</p>
          <h3>{ready ? 'This question is ready to save.' : 'A few details need attention.'}</h3>
          <span>
            {ready
              ? 'Review the student preview once more, then choose how to save it.'
              : 'Choose an item below to return directly to the field.'}
          </span>
        </div>
      </div>

      {!ready && (
        <div className="question-studio-issue-list">
          {validationItems.map(([field, message]) => {
            const stage = stageForField(field);
            return (
              <button key={field} type="button" onClick={() => goToField(field, stage)}>
                <span>
                  <small>{STAGES.find(item => item.id === stage)?.title}</small>
                  <strong>{FIELD_LABELS[field] ?? message}</strong>
                </span>
                <FiArrowRight aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      {serverError && (
        <div className="question-studio-save-error" role="alert">
          <FiAlertCircle aria-hidden="true" />
          <div>
            <strong>Question needs attention</strong>
            <p>{serverError}</p>
          </div>
        </div>
      )}

      <div className="question-studio-save-panel">
        <div>
          <p>Choose a destination</p>
          <h3>{mode === 'create' ? 'Save the new question' : 'Update this question'}</h3>
          <span>A draft stays private. Publishing makes it available to students.</span>
        </div>
        <div className="question-studio-save-actions">
          <button
            type="button"
            className="question-studio-save-draft"
            onClick={() => save('draft')}
            disabled={saving !== null}
          >
            <FiSave aria-hidden="true" />
            {saving === 'draft' ? 'Saving…' : 'Save as draft'}
          </button>
          <button
            type="button"
            className="question-studio-publish"
            onClick={() => save('published')}
            disabled={saving !== null}
          >
            <FiCheckCircle aria-hidden="true" />
            {saving === 'published' ? 'Publishing…' : 'Save & publish'}
          </button>
        </div>
      </div>

      {!submitted && !ready && (
        <p className="question-studio-review-footnote">
          Checks update live as you complete each stage. Saving will focus the first unresolved field.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  badge,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  badge?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`question-studio-field${error ? ' has-error' : ''}`}>
      {htmlFor ? (
        <label className="question-studio-label" htmlFor={htmlFor}>
          <strong>{label}</strong>
          {required && <small>Required</small>}
          {badge && <em>{badge}</em>}
        </label>
      ) : (
        <span className="question-studio-label">
          <strong>{label}</strong>
          {required && <small>Required</small>}
          {badge && <em>{badge}</em>}
        </span>
      )}
      {children}
      {error ? (
        <span className="question-studio-error">
          <FiAlertCircle aria-hidden="true" />
          {error}
        </span>
      ) : hint ? (
        <span className="question-studio-hint">{hint}</span>
      ) : null}
    </div>
  );
}

function PreviewHeader({ difficulty }: { difficulty: string }) {
  return (
    <header className="question-studio-preview-head">
      <div>
        <span className="question-studio-preview-q">Q</span>
        <span>
          <strong>Student preview</strong>
          <small>What learners will see</small>
        </span>
      </div>
      <span className="question-studio-live">
        <i aria-hidden="true" />
        Live
      </span>
      <span className={`question-studio-difficulty is-${difficulty}`}>{difficulty}</span>
    </header>
  );
}

function QuestionPreview({ form }: { form: QuestionFormInitial }) {
  return (
    <div className="question-studio-assessment">
      <div className="question-studio-assessment-meta">
        <span>Question preview</span>
        <span>{form.questionType === 'mcq' ? 'Multiple choice' : 'Student-produced response'}</span>
      </div>

      {form.passage.trim() && (
        <section className="question-studio-assessment-passage">
          <span>Reading passage</span>
          <p>{form.passage}</p>
        </section>
      )}

      <ChartFigure svg={form.chartSvg} />

      <section className="question-studio-assessment-question">
        <span className="question-studio-assessment-number">1</span>
        {form.questionText.trim() ? (
          <QuestionBody
            text={form.questionText}
            tables={form.tables}
            className="question-studio-assessment-stem"
          />
        ) : (
          <p className="question-studio-assessment-stem is-placeholder">
            Your question will take shape here…
          </p>
        )}
      </section>

      {form.questionType === 'mcq' ? (
        <div className="question-studio-assessment-options" key={form.correctAnswer}>
          {ANSWER_KEYS.map(key => {
            const isKey = form.correctAnswer === key;
            const text = form.options[key].trim();
            return (
              <div
                key={key}
                className={`question-studio-assessment-option${isKey ? ' is-key' : ''}`}
              >
                <span className="question-studio-assessment-marker" aria-hidden="true">
                  {key}
                </span>
                {text ? (
                  <span
                    className="question-studio-assessment-option-text"
                    dangerouslySetInnerHTML={{ __html: text }}
                  />
                ) : (
                  <span className="question-studio-assessment-option-text is-placeholder">
                    Option {key}
                  </span>
                )}
                {isKey && (
                  <span className="question-studio-assessment-key">
                    <FiCheck aria-hidden="true" />
                    <span className="sr-only">Correct answer</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="question-studio-assessment-gridin">
          <label htmlFor="question-studio-preview-gridin">Student answer</label>
          <input
            id="question-studio-preview-gridin"
            type="text"
            value=""
            placeholder="Enter your answer"
            readOnly
            disabled
          />
          <p>A fraction like 3/2 or a decimal like 1.5 are both accepted.</p>
        </div>
      )}

      <section className="question-studio-assessment-explanation">
        <span>Explanation</span>
        {form.explanation.trim() ? (
          <QuestionBody
            text={form.explanation}
            className="question-studio-assessment-explanation-body"
          />
        ) : (
          <p className="question-studio-assessment-explanation-body is-placeholder">
            The rationale appears here after answering.
          </p>
        )}
      </section>
    </div>
  );
}
