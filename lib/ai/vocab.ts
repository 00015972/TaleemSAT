import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { normalizeWord, isAdvancedWord } from '@/lib/reading/common-words';
import { generateJSON, AiError } from './client';

export { normalizeWord, isAdvancedWord };

/**
 * On-hover vocabulary lookups for passage words. Translations are identical for
 * every student, so they live in the shared `vocab_cache` table keyed by the
 * normalized word — the first lookup pays for Groq, everyone after is a cache hit.
 */

const SYSTEM_PROMPT = `You are a bilingual SAT vocabulary tutor for Uzbek students learning English.

Given ONE English word (and optionally the sentence it appeared in), return a concise gloss aimed at a high-school SAT student.

Return JSON only, matching this schema exactly:
{
  "part_of_speech": "string — e.g. 'noun', 'verb', 'adjective'; empty string if unclear",
  "definition": "string — one short, plain-English definition (max ~12 words), fitting the context if a sentence was given",
  "uz": "string — the Uzbek (Latin script) translation, 1-3 words",
  "ru": "string — the Russian translation, 1-3 words"
}

Rules:
- Give the meaning AS USED in the context sentence when one is provided.
- Keep it short. No examples, no extra commentary, no markdown.
- uz must be Uzbek in Latin script (e.g. "ko'paymoq"), ru must be Cyrillic Russian.`;

export const VocabSchema = z.object({
  part_of_speech: z.string().max(40).default(''),
  definition: z.string().min(1).max(300),
  uz: z.string().min(1).max(120),
  ru: z.string().min(1).max(120),
});

export type VocabEntry = {
  word: string;
  display: string;
  partOfSpeech: string | null;
  definition: string;
  uz: string;
  ru: string;
};

function rowToEntry(row: {
  word: string;
  display: string;
  part_of_speech: string | null;
  definition: string;
  uz: string;
  ru: string;
}): VocabEntry {
  return {
    word: row.word,
    display: row.display,
    partOfSpeech: row.part_of_speech,
    definition: row.definition,
    uz: row.uz,
    ru: row.ru,
  };
}

/** Return the cached translation for a word, or null. */
export async function readCachedVocab(
  admin: SupabaseClient<Database>,
  word: string
): Promise<VocabEntry | null> {
  const { data } = await admin
    .from('vocab_cache')
    .select('word, display, part_of_speech, definition, uz, ru')
    .eq('word', word)
    .maybeSingle();
  return data ? rowToEntry(data) : null;
}

/**
 * Look a word up: serve from cache, else call Groq, validate, store, and return.
 * `display` is the original-cased token; `context` is the sentence it came from.
 */
export async function lookupVocab(
  admin: SupabaseClient<Database>,
  display: string,
  context: string | null
): Promise<VocabEntry> {
  const word = normalizeWord(display);
  if (!word || !isAdvancedWord(word)) {
    throw new AiError('Not a lookup-worthy word');
  }

  const cached = await readCachedVocab(admin, word);
  if (cached) return cached;

  const userText = context
    ? `Word: "${word}"\nSentence: "${context.slice(0, 400)}"`
    : `Word: "${word}"`;
  const raw = await generateJSON(SYSTEM_PROMPT, userText);
  const parsed = VocabSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiError('Vocab lookup failed schema validation');
  }

  const entry: VocabEntry = {
    word,
    display: display.slice(0, 60),
    partOfSpeech: parsed.data.part_of_speech || null,
    definition: parsed.data.definition,
    uz: parsed.data.uz,
    ru: parsed.data.ru,
  };

  // Upsert so concurrent first-lookups of the same word don't collide.
  await admin.from('vocab_cache').upsert(
    {
      word: entry.word,
      display: entry.display,
      part_of_speech: entry.partOfSpeech,
      definition: entry.definition,
      uz: entry.uz,
      ru: entry.ru,
    },
    { onConflict: 'word' }
  );

  return entry;
}
