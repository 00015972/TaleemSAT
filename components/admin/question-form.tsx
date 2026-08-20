'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { GridInInput } from '@/components/reading/grid-in-input';
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
  /** Sanitized <table> markup, read-only here — see lib/import/table-sanitize.ts.
   * There's no table editor; `questionText`'s `[[table:N]]` tokens just need
   * to survive editing so the preview (and the live question) keep the table. */
  tables?: string[];
  /** Sanitized <svg> chart markup, read-only here — see lib/import/svg-sanitize.ts. */
  chartSvg?: string | null;
};

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
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(', '));
  const [acceptedInput, setAcceptedInput] = useState((initial?.acceptedAnswers ?? []).join(', '));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null);
  const [serverError, setServerError] = useState('');

  const tags = useMemo(
    () =>
      tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
    [tagsInput]
  );

  const acceptedAnswers = useMemo(
    () =>
      acceptedInput
        .split(',')
        .map(a => a.trim())
        .filter(Boolean),
    [acceptedInput]
  );

  const validation = useMemo(
    () => validateQuestion({ ...form, tags, acceptedAnswers }),
    [form, tags, acceptedAnswers]
  );

  const visibleCategories = categories.filter(c => c.subjectId === form.subjectId);

  function set<K extends keyof QuestionFormInitial>(
    field: K,
    value: QuestionFormInitial[K]
  ) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function setOption(key: AnswerKey, value: string) {
    setForm(prev => ({ ...prev, options: { ...prev.options, [key]: value } }));
  }

  function fieldError(field: string): string | undefined {
    return submitted ? validation.fieldErrors[field] : undefined;
  }

  async function save(status: 'draft' | 'published') {
    setSubmitted(true);
    setServerError('');

    const payload = {
      ...form,
      status,
      tags,
      acceptedAnswers,
      // A grid-in question has no lettered key — the canonical correct_answer
      // the DB requires is just the first accepted written form.
      correctAnswer: form.questionType === 'grid_in' ? (acceptedAnswers[0] ?? '') : form.correctAnswer,
    };
    const result = validateQuestion(payload);
    if (!result.ok) {
      setServerError('Please fix the highlighted fields before saving.');
      return;
    }

    setSaving(status);
    const url =
      mode === 'create'
        ? '/api/admin/questions'
        : `/api/admin/questions/${questionId}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerError(
          data?.errors?.[0] ?? 'Failed to save. Please try again.'
        );
        setSaving(null);
        return;
      }
      router.push('/admin/questions');
      router.refresh();
    } catch {
      setServerError('Network error. Please try again.');
      setSaving(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-8">
      {/* ─── Form ─── */}
      <div className="flex flex-col gap-4">
        {/* Subject + Category */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject" error={fieldError('subjectId')}>
            <select
              className="form-input"
              value={form.subjectId}
              onChange={e => {
                set('subjectId', e.target.value);
                set('categoryId', ''); // reset cascade
              }}
            >
              <option value="">Select…</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category" error={fieldError('categoryId')}>
            <select
              className="form-input"
              value={form.categoryId}
              disabled={!form.subjectId}
              onChange={e => set('categoryId', e.target.value)}
            >
              <option value="">Select…</option>
              {visibleCategories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Passage */}
        <Field
          label="Passage (optional)"
          hint="Include only if the question references a reading passage (min 50 chars)."
          error={fieldError('passage')}
        >
          <textarea
            className="form-input"
            rows={3}
            value={form.passage}
            onChange={e => set('passage', e.target.value)}
            placeholder="Optional reading passage…"
          />
        </Field>

        {/* Question text */}
        <Field
          label="Question"
          hint={
            form.tables && form.tables.length > 0
              ? `Includes ${form.tables.length === 1 ? 'a table' : `${form.tables.length} tables`} — keep the [[table:N]] marker${form.tables.length === 1 ? '' : 's'} in place; only edit the surrounding text.`
              : undefined
          }
          error={fieldError('questionText')}
        >
          <textarea
            className="form-input"
            rows={8}
            value={form.questionText}
            onChange={e => set('questionText', e.target.value)}
            placeholder="The question stem the student reads…"
          />
        </Field>

        {/* Question type */}
        <Field label="Question type">
          <div className="flex gap-2">
            {QUESTION_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('questionType', t)}
                aria-pressed={form.questionType === t}
                className="adm-btn secondary sm"
                style={
                  form.questionType === t
                    ? {
                        background: 'var(--green)',
                        color: '#fff',
                        borderColor: 'var(--green)',
                      }
                    : undefined
                }
              >
                {t === 'mcq' ? 'Multiple choice' : 'Grid-in (typed answer)'}
              </button>
            ))}
          </div>
        </Field>

        {/* Options — pencil in the key — or accepted answers for a grid-in */}
        {form.questionType === 'mcq' ? (
          <div className="flex flex-col gap-2">
            <span className="adm-section-label" style={{ marginBottom: 0 }}>
              Answer options
            </span>
            {ANSWER_KEYS.map(key => {
              const isKey = form.correctAnswer === key;
              return (
                <div key={key} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => set('correctAnswer', key)}
                    title="Mark as the answer key"
                    aria-pressed={isKey}
                    className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center transition-all"
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      ...(isKey
                        ? {
                            background: 'var(--green)',
                            color: '#fff',
                            border: '1.6px solid var(--gold)',
                            boxShadow:
                              '0 0 0 2px color-mix(in srgb, var(--gold) 50%, transparent)',
                          }
                        : {
                            background: 'transparent',
                            color: 'var(--muted)',
                            border: '1.6px solid var(--muted-l)',
                          }),
                    }}
                  >
                    {key}
                  </button>
                  <input
                    className="form-input flex-1"
                    value={form.options[key]}
                    onChange={e => setOption(key, e.target.value)}
                    placeholder={`Option ${key}`}
                  />
                </div>
              );
            })}
            {fieldError('option_A') ||
            fieldError('option_B') ||
            fieldError('option_C') ||
            fieldError('option_D') ? (
              <p className="text-xs" style={{ color: 'var(--err)' }}>
                All four options must be filled in.
              </p>
            ) : null}
            <p className="text-xs text-muted">
              Click a bubble to set the answer key (currently{' '}
              <strong>{form.correctAnswer}</strong>).
            </p>
          </div>
        ) : (
          <Field
            label="Accepted answers"
            hint='Comma-separated — every equivalent written form the answer key accepts, e.g. "3/2, 1.5". The first one is stored as the canonical answer.'
            error={fieldError('acceptedAnswers')}
          >
            <input
              className="form-input"
              value={acceptedInput}
              onChange={e => setAcceptedInput(e.target.value)}
              placeholder="e.g. 3/2, 1.5"
            />
          </Field>
        )}

        {/* Explanation */}
        <Field
          label="Explanation"
          hint="Required. Explain why the answer is correct (min 30 chars)."
          error={fieldError('explanation')}
        >
          <textarea
            className="form-input"
            rows={6}
            value={form.explanation}
            onChange={e => set('explanation', e.target.value)}
            placeholder="Why is the correct answer correct?"
          />
        </Field>

        {/* Difficulty + Tags */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Difficulty" error={fieldError('difficulty')}>
            <select
              className="form-input"
              value={form.difficulty}
              onChange={e => set('difficulty', e.target.value as Difficulty)}
            >
              {DIFFICULTIES.map(d => (
                <option key={d} value={d}>
                  {d[0].toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tags" hint="Comma-separated.">
            <input
              className="form-input"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="e.g. quadratic, factoring"
            />
          </Field>
        </div>

        {/* Errors + actions */}
        {serverError && <div className="adm-alert err">{serverError}</div>}
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={() => save('draft')}
            disabled={saving !== null}
            className="adm-btn secondary"
          >
            {saving === 'draft' ? 'Saving…' : 'Save as draft'}
          </button>
          <button
            type="button"
            onClick={() => save('published')}
            disabled={saving !== null}
            className="adm-btn"
          >
            {saving === 'published' ? 'Publishing…' : 'Save & publish'}
          </button>
        </div>
      </div>

      {/* ─── Live preview — exactly what the student sees ─── */}
      <div className="lg:sticky lg:top-20 self-start w-full">
        <span className="adm-section-label">Student preview</span>
        <QuestionPreview form={form} />
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-txt">{label}</span>
      {children}
      {error ? (
        <span className="text-xs" style={{ color: 'var(--err)' }}>
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

// Rendered with the real .prx-* classes so the preview IS the student card.
function QuestionPreview({ form }: { form: QuestionFormInitial }) {
  return (
    <div className="prx-card">
      <div className="prx-card-head">
        <span className="prx-meta">
          <span className="prx-qnum">Q</span>
          Preview
          <span
            className="prx-diff"
            style={{
              background: 'color-mix(in srgb, var(--gold-d) 14%, transparent)',
              color: 'var(--gold-d)',
            }}
          >
            {form.difficulty}
          </span>
        </span>
      </div>

      {form.passage.trim() && <div className="prx-passage">{form.passage}</div>}

      <ChartFigure svg={form.chartSvg} />

      {form.questionText.trim() ? (
        <QuestionBody text={form.questionText} tables={form.tables} className="prx-stem" />
      ) : (
        <p className="prx-stem">
          <span className="text-muted italic">Question text appears here…</span>
        </p>
      )}

      {form.questionType === 'mcq' ? (
        <div className="prx-opts">
          {ANSWER_KEYS.map(key => {
            const isKey = form.correctAnswer === key;
            const text = form.options[key].trim();
            return (
              <div
                key={key}
                className={`prx-opt${isKey ? ' key' : ''}`}
                style={{ cursor: 'default' }}
              >
                <span className="prx-opt-bub">
                  <span>{key}</span>
                </span>
                {text ? (
                  <span className="prx-opt-text" dangerouslySetInnerHTML={{ __html: text }} />
                ) : (
                  <span className="prx-opt-text">
                    <span className="text-muted italic">Option {key}…</span>
                  </span>
                )}
                {isKey && (
                  <span className="prx-opt-flag" style={{ color: 'var(--ok)' }}>
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <GridInInput value="" onChange={() => {}} disabled />
      )}

      <div className="prx-expl">
        <p className="prx-expl-label">Explanation</p>
        {form.explanation.trim() ? (
          <QuestionBody text={form.explanation} className="prx-expl-body" />
        ) : (
          <p className="prx-expl-body">
            <span className="text-muted italic">
              Explanation appears here after answering…
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
