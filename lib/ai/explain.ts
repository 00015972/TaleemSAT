import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';
import { generateJSON, AiError } from './client';

/**
 * AI "Why is this the answer?" deep explanations. The question content is the
 * same for every student, so each explanation is cached once per question in
 * `question_ai_explanations` and reused for everyone. This is a richer companion
 * to the author-written `explanation` field — it walks the reasoning and says
 * why each distractor is wrong.
 */

const SYSTEM_PROMPT = `You are a patient SAT tutor explaining why an answer is correct to a student who just saw the question.

You will receive the passage (if any), the question, the four options, the correct option letter, and the author's short explanation. Produce a clear, encouraging walkthrough.

Return JSON only, matching this schema exactly:
{
  "summary": "string — one sentence: the core reason the correct answer is right",
  "steps": ["string", ...] — 2 to 4 short steps showing how to reason to the answer,
  "distractors": [ { "option": "A|B|C|D", "why_wrong": "string — one short sentence" }, ... ] — cover the three WRONG options,
  "tip": "string — one transferable strategy for questions like this"
}

Rules:
- Be concrete and reference the passage/options, not generic advice.
- Keep each string short and plain. No markdown, no headers.
- Do NOT include the correct option in "distractors".`;

const DistractorSchema = z.object({
  option: z.string().min(1).max(2),
  why_wrong: z.string().min(1).max(300),
});

export const ExplanationSchema = z.object({
  summary: z.string().min(1).max(400),
  steps: z.array(z.string().min(1).max(400)).min(1).max(6),
  distractors: z.array(DistractorSchema).max(4).default([]),
  tip: z.string().min(1).max(400),
});

export type Explanation = z.infer<typeof ExplanationSchema>;

type QuestionForExplain = {
  id: string;
  passage: string | null;
  question_text: string;
  options: Json;
  correct_answer: string;
  explanation: string;
};

/** Return the cached AI explanation for a question, or null. */
export async function readCachedExplanation(
  admin: SupabaseClient<Database>,
  questionId: string
): Promise<Explanation | null> {
  const { data } = await admin
    .from('question_ai_explanations')
    .select('payload')
    .eq('question_id', questionId)
    .maybeSingle();
  if (!data) return null;
  const parsed = ExplanationSchema.safeParse(data.payload);
  return parsed.success ? parsed.data : null;
}

function optionsToText(options: Json): string {
  if (Array.isArray(options)) {
    return options
      .map(o =>
        o && typeof o === 'object' && 'id' in o && 'text' in o
          ? `${String((o as Record<string, unknown>).id)}. ${String((o as Record<string, unknown>).text)}`
          : ''
      )
      .filter(Boolean)
      .join('\n');
  }
  if (options && typeof options === 'object') {
    const rec = options as Record<string, unknown>;
    return ['A', 'B', 'C', 'D']
      .filter(k => k in rec)
      .map(k => `${k}. ${String(rec[k])}`)
      .join('\n');
  }
  return '';
}

/** Generate (or fetch cached) the AI walkthrough for a question, then store it. */
export async function getExplanation(
  admin: SupabaseClient<Database>,
  question: QuestionForExplain
): Promise<Explanation> {
  const cached = await readCachedExplanation(admin, question.id);
  if (cached) return cached;

  const userText = [
    question.passage ? `Passage:\n${question.passage}` : null,
    `Question:\n${question.question_text}`,
    `Options:\n${optionsToText(question.options)}`,
    `Correct answer: ${question.correct_answer}`,
    `Author's note: ${question.explanation}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const raw = await generateJSON(SYSTEM_PROMPT, userText);
  const parsed = ExplanationSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiError('Explanation failed schema validation');
  }

  await admin.from('question_ai_explanations').upsert(
    {
      question_id: question.id,
      payload: parsed.data as unknown as Json,
    },
    { onConflict: 'question_id' }
  );

  return parsed.data;
}
