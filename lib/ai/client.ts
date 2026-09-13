import 'server-only';

/**
 * AI inference client — backed by Anthropic's Claude Haiku.
 * The rest of the app talks to AI only through `generateJSON()`.
 * JSON output is forced via a single-tool tool_choice, since Claude has no
 * native response_format flag — the tool's `input` is the parsed JSON.
 * To swap providers, reimplement just this file.
 */

const MODEL = 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = 15_000;
const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

/**
 * Send a system prompt + user payload and return parsed JSON.
 * Forces JSON output via a forced tool call. Throws AiError on any failure.
 */
export async function generateJSON(
  systemPrompt: string,
  userText: string
): Promise<unknown> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError('ANTHROPIC_API_KEY is not set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
        max_tokens: 1024,
        temperature: 0.4,
        system: systemPrompt,
        messages: [{ role: 'user', content: userText }],
        tools: [
          {
            name: 'emit_result',
            description:
              'Emit the final result as JSON matching the schema described in the system prompt.',
            input_schema: { type: 'object' },
          },
        ],
        tool_choice: { type: 'tool', name: 'emit_result' },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AiError(`Anthropic HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      content?: { type: string; input?: unknown }[];
    };
    const toolUse = data.content?.find(block => block.type === 'tool_use');
    if (!toolUse || typeof toolUse.input !== 'object' || toolUse.input === null) {
      throw new AiError('Anthropic returned no tool_use input');
    }

    return toolUse.input;
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiError('Anthropic request timed out');
    }
    throw new AiError(err instanceof Error ? err.message : 'Anthropic request failed');
  } finally {
    clearTimeout(timer);
  }
}
