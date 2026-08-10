/**
 * Vision transcription for the question-import pipeline.
 *
 * A College Board PDF draws every formula as vector art, so the text layer
 * comes back with holes where the math belongs. This module sends a rendered
 * page image to a vision model and asks for the question back as text with
 * LaTeX in place of the missing expressions.
 *
 * Deliberately separate from lib/ai/client.ts: that one is tuned for short,
 * fast, text-only calls (15s, 1024 tokens). Transcribing a page with a long
 * rationale needs images, minutes, and far more output budget.
 */

const MODEL = process.env.VISION_MODEL ?? 'claude-sonnet-5';
const TIMEOUT_MS = 180_000;
const MAX_TOKENS = 8192;
const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export class VisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VisionError';
  }
}

export type TranscribedQuestion = {
  questionText: string;
  passage: string | null;
  questionType: 'mcq' | 'grid_in';
  options: { id: string; text: string }[];
  correctAnswer: string | null;
  acceptedAnswers: string[];
  explanation: string;
  /** True when the question depends on a graph, diagram, or table. */
  hasFigure: boolean;
  /** The model's own read on how cleanly it could transcribe the page. */
  confidence: 'high' | 'medium' | 'low';
  /** Anything a human reviewer should know — disagreements, unclear glyphs. */
  notes: string | null;
};

const SYSTEM_PROMPT = `You transcribe SAT questions from rendered pages of an official College Board question-bank PDF.

The page image is the source of truth. A text layer is also supplied, but every mathematical expression is missing from it — the PDF draws formulas as vector art. Wherever the text layer has a conspicuous gap, read the expression off the image and write it as LaTeX.

Rules:
- Write math as LaTeX delimited by single dollar signs: $x^2 + 3x - 4 = 0$. Never describe an expression in words when you can write it.
- Transcribe verbatim. Do not rephrase, simplify, correct, or shorten anything — including the rationale.
- questionText: the question as asked, without the answer choices.
- passage: for Reading & Writing questions, the stimulus text. null for Math.
- questionType: "mcq" when the page shows four lettered choices, "grid_in" when the student produces their own answer.
- options: for mcq, exactly four entries with ids "A","B","C","D". Empty array for grid_in.
- correctAnswer: for mcq, the letter. null for grid_in.
- acceptedAnswers: for grid_in, every accepted written form shown on the page (e.g. ["135/8","16.87","16.88"]). Empty array for mcq. If the page states only one form but others are clearly equivalent and acceptable (a fraction and its decimal), include them.
- explanation: the full "Rationale" text, with its math in LaTeX.
- hasFigure: true if answering requires a graph, diagram, table, or geometric figure printed on the page.
- confidence: "high" if every glyph was legible, "low" if you had to guess at any expression.
- notes: null when everything was clean. Otherwise say precisely what was unclear, or note any disagreement with the supplied answer key.

If an expected answer key is supplied and your reading of the page disagrees with it, keep your reading and explain the disagreement in notes.`;

type ImageInput = { base64: string; mediaType: string };

/**
 * Transcribe one question from its rendered page(s).
 *
 * @param images   Rendered pages for this question, in order.
 * @param textLayer Raw text pdfjs extracted — useful for the prose, holed for math.
 * @param hints    What the text layer already told us, so the model need not guess.
 */
export async function transcribeQuestion(
  images: ImageInput[],
  textLayer: string,
  hints: {
    questionId: string;
    domain: string | null;
    skill: string | null;
    difficulty: string | null;
    expectedAnswer: string | null;
  }
): Promise<TranscribedQuestion> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new VisionError('ANTHROPIC_API_KEY is not set');
  if (images.length === 0) throw new VisionError('No page images supplied');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const content: unknown[] = images.map(img => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
  }));

  content.push({
    type: 'text',
    text: [
      `Question ID: ${hints.questionId}`,
      hints.domain ? `Domain: ${hints.domain}` : null,
      hints.skill ? `Skill: ${hints.skill}` : null,
      hints.difficulty ? `Difficulty: ${hints.difficulty}` : null,
      hints.expectedAnswer
        ? `Answer key from the PDF text layer: ${hints.expectedAnswer}`
        : 'The answer is not present in the text layer — read it from the image.',
      '',
      'Text layer (math expressions are missing from it):',
      textLayer.slice(0, 12_000),
    ]
      .filter(Boolean)
      .join('\n'),
  });

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
        tools: [
          {
            name: 'emit_question',
            description: 'Emit the transcribed question.',
            input_schema: {
              type: 'object',
              properties: {
                questionText: { type: 'string' },
                passage: { type: ['string', 'null'] },
                questionType: { type: 'string', enum: ['mcq', 'grid_in'] },
                options: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { id: { type: 'string' }, text: { type: 'string' } },
                    required: ['id', 'text'],
                  },
                },
                correctAnswer: { type: ['string', 'null'] },
                acceptedAnswers: { type: 'array', items: { type: 'string' } },
                explanation: { type: 'string' },
                hasFigure: { type: 'boolean' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                notes: { type: ['string', 'null'] },
              },
              required: [
                'questionText',
                'questionType',
                'options',
                'acceptedAnswers',
                'explanation',
                'hasFigure',
                'confidence',
              ],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'emit_question' },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new VisionError(`Anthropic HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      content?: { type: string; input?: unknown }[];
    };
    const toolUse = data.content?.find(b => b.type === 'tool_use');
    if (!toolUse || typeof toolUse.input !== 'object' || toolUse.input === null) {
      throw new VisionError('Model returned no tool_use input');
    }

    return normalize(toolUse.input as Record<string, unknown>);
  } catch (err) {
    if (err instanceof VisionError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new VisionError('Vision request timed out');
    }
    throw new VisionError(err instanceof Error ? err.message : 'Vision request failed');
  } finally {
    clearTimeout(timer);
  }
}

/** Coerce the model's output into our shape; never trust it structurally. */
function normalize(raw: Record<string, unknown>): TranscribedQuestion {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const strOrNull = (v: unknown) => {
    const s = str(v);
    return s.length > 0 ? s : null;
  };

  const questionType = raw.questionType === 'grid_in' ? 'grid_in' : 'mcq';

  const options = Array.isArray(raw.options)
    ? raw.options
        .map(o => {
          const rec = o as Record<string, unknown>;
          return { id: str(rec?.id).toUpperCase(), text: str(rec?.text) };
        })
        .filter(o => o.id.length > 0)
    : [];

  const acceptedAnswers = Array.isArray(raw.acceptedAnswers)
    ? raw.acceptedAnswers.map(a => str(a)).filter(Boolean)
    : [];

  const correctRaw = str(raw.correctAnswer).toUpperCase();

  const confidence =
    raw.confidence === 'high' || raw.confidence === 'low' || raw.confidence === 'medium'
      ? raw.confidence
      : 'medium';

  return {
    questionText: str(raw.questionText),
    passage: strOrNull(raw.passage),
    questionType,
    options: questionType === 'mcq' ? options : [],
    correctAnswer: questionType === 'mcq' && /^[A-D]$/.test(correctRaw) ? correctRaw : null,
    acceptedAnswers: questionType === 'grid_in' ? acceptedAnswers : [],
    explanation: str(raw.explanation),
    hasFigure: raw.hasFigure === true,
    confidence,
    notes: strOrNull(raw.notes),
  };
}
