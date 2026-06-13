'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  validateQuestion,
  ANSWER_KEYS,
  DIFFICULTIES,
  type AnswerKey,
  type Difficulty,
  type QuestionOptions,
} from '@/lib/admin/question-validation';

export type SubjectOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string; subjectId: string };

export type QuestionFormInitial = {
  subjectId: string;
  categoryId: string;
  questionText: string;
  passage: string;
  options: QuestionOptions;
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  status: string;
  tags: string[];
};

const EMPTY: QuestionFormInitial = {
  subjectId: '',
  categoryId: '',
  questionText: '',
  passage: '',
  options: { A: '', B: '', C: '', D: '' },
  correctAnswer: 'A',
  explanation: '',
  difficulty: 'medium',
  status: 'draft',
  tags: [],
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

  const validation = useMemo(
    () => validateQuestion({ ...form, tags }),
    [form, tags]
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

    const payload = { ...form, status, tags };
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        <Field label="Question" error={fieldError('questionText')}>
          <textarea
            className="form-input"
            rows={3}
            value={form.questionText}
            onChange={e => set('questionText', e.target.value)}
            placeholder="The question stem the student reads…"
          />
        </Field>

        {/* Options — pencil in the key */}
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

        {/* Explanation */}
        <Field
          label="Explanation"
          hint="Required. Explain why the answer is correct (min 30 chars)."
          error={fieldError('explanation')}
        >
          <textarea
            className="form-input"
            rows={3}
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

      <p className="prx-stem">
        {form.questionText.trim() || (
          <span className="text-muted italic">Question text appears here…</span>
        )}
      </p>

      <div className="prx-opts">
        {ANSWER_KEYS.map(key => {
          const isKey = form.correctAnswer === key;
          return (
            <div
              key={key}
              className={`prx-opt${isKey ? ' key' : ''}`}
              style={{ cursor: 'default' }}
            >
              <span className="prx-opt-bub">
                <span>{key}</span>
              </span>
              <span className="prx-opt-text">
                {form.options[key].trim() || (
                  <span className="text-muted italic">Option {key}…</span>
                )}
              </span>
              {isKey && (
                <span className="prx-opt-flag" style={{ color: 'var(--ok)' }}>
                  ✓
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="prx-expl">
        <p className="prx-expl-label">Explanation</p>
        <p className="prx-expl-body">
          {form.explanation.trim() || (
            <span className="text-muted italic">
              Explanation appears here after answering…
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
