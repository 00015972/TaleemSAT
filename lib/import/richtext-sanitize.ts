/**
 * Allowlist sanitizer for inline rich-text markup inside a question's prose —
 * a `<p>` in `.question-body`/`.rationale`/`.passage`, or a `<span
 * class="option-text">` (see lib/import/html-questions.ts). SAT Math source
 * HTML marks up formulas with `<b>`/`<i>` emphasis, `<sup>`/`<sub>`, and real
 * MathML (`<math><msqrt>...`) rather than LaTeX, so — unlike the plain-text
 * `.text()` extraction the Reading & Writing path used — this preserves that
 * markup as sanitized HTML for the browser's native MathML renderer.
 *
 * An answer option can also embed a whole `<table>` (a table-shaped choice)
 * or `<svg>` (a graph-shaped choice) directly in its text — those delegate to
 * the existing table/svg sanitizers and splice the result inline.
 *
 * Mirrors the threat model of svg-sanitize.ts/table-sanitize.ts: the source
 * is semi-trusted (an admin ran a PDF through an AI chat tool) and the output
 * reaches every student's browser via `dangerouslySetInnerHTML`. Genuinely
 * dangerous tags (script, style, iframe, ...) are dropped with their entire
 * subtree; anything merely unrecognized (a stray `<div>`, `<font>`, ...) is
 * unwrapped so its text survives — losing a wrapper tag should never mean
 * losing real question content.
 *
 * Pure — no I/O — mirrors the rest of lib/import/*'s contract.
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { sanitizeChartSvg } from './svg-sanitize';
import { sanitizeTableHtml } from './table-sanitize';

const INLINE_TAGS = new Set(['b', 'strong', 'i', 'em', 'sup', 'sub', 'br', 'u']);
const LIST_TAGS = new Set(['ol', 'ul', 'li']);

const MATHML_TAGS = new Set([
  'math',
  'mrow',
  'mi',
  'mn',
  'mo',
  'mtext',
  'mspace',
  'mfrac',
  'msqrt',
  'mroot',
  'msup',
  'msub',
  'msubsup',
  'munder',
  'mover',
  'munderover',
  'mtable',
  'mtr',
  'mtd',
  'mth',
  'mfenced',
  'mpadded',
  'mstyle',
  'menclose',
  'semantics',
  'annotation',
]);

const ALLOWED_TAGS = new Set([...INLINE_TAGS, ...LIST_TAGS, ...MATHML_TAGS]);

// Genuinely executable/dangerous — drop the whole subtree, not just the tag.
const DANGEROUS_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
  'button',
  'input',
  'select',
  'textarea',
  'audio',
  'video',
  'noscript',
]);

// A small, safe attribute allowlist — MathML's presentation attributes are
// all enumerated keywords or plain numbers/strings, never URLs or code.
const ALLOWED_ATTRS = new Set([
  'mathvariant',
  'displaystyle',
  'columnalign',
  'rowalign',
  'stretchy',
  'symmetric',
  'largeop',
  'movablelimits',
  'accent',
  'accentunder',
  'separators',
  'open',
  'close',
  'notation',
  'scriptlevel',
]);
const SAFE_ATTR_VALUE = /^[a-zA-Z0-9\s.,#%\-_'"/:;()]*$/;

/**
 * Sanitize an HTML fragment (the inner markup of a `<p>` or
 * `<span class="option-text">`) down to safe inline/MathML/list markup, with
 * any embedded `<table>`/`<svg>` sanitized via their own dedicated allowlists
 * and spliced back in place. Returns '' if nothing survives.
 */
export function sanitizeRichText(rawInnerHtml: string): string {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(`<div id="root">${rawInnerHtml}</div>`);
  } catch {
    return '';
  }

  const root = $('#root').get(0) as Element;
  sanitizeChildren($, root);

  return ($('#root').html() ?? '').trim();
}

function sanitizeChildren($: cheerio.CheerioAPI, parent: Element): void {
  for (const child of [...parent.children]) {
    if (child.type === 'text') continue;
    if (child.type !== 'tag') {
      $(child).remove(); // comments, CDATA, etc.
      continue;
    }

    const el = child as Element;
    const tag = el.name?.toLowerCase();

    if (DANGEROUS_TAGS.has(tag)) {
      $(el).remove();
      continue;
    }

    if (tag === 'table') {
      const sanitized = sanitizeTableHtml($.html(el));
      if (sanitized) $(el).replaceWith(sanitized);
      else $(el).remove();
      continue;
    }

    if (tag === 'svg') {
      const sanitized = sanitizeChartSvg($.html(el));
      if (sanitized) $(el).replaceWith(sanitized);
      else $(el).remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      // Unrecognized formatting wrapper — keep its content, drop the tag.
      sanitizeChildren($, el);
      $(el).replaceWith($(el).contents());
      continue;
    }

    sanitizeAttrs($, el);
    sanitizeChildren($, el);
  }
}

const TABLE_TOKEN = /^\[\[table:\d+\]\]$/;

/**
 * Sanitize a full `question_text`/`explanation` value — blocks joined by
 * blank lines (components/reading/question-body.tsx's contract) — rather
 * than one paragraph's markup. A `[[table:N]]` token block passes through
 * unchanged (it isn't markup, just a placeholder the renderer swaps back
 * out); every other block is run through {@link sanitizeRichText}.
 *
 * This is the sanitization boundary for hand-edited content: the HTML import
 * path (lib/import/html-questions.ts) already sanitizes block-by-block as it
 * builds this string, but an admin free-typing into the question form or the
 * import-review editor bypasses that parser entirely, so every write route
 * that persists these fields must run the result through this first.
 */
export function sanitizeQuestionTextBlocks(text: string): string {
  return (text ?? '')
    .split('\n\n')
    .map(block => (TABLE_TOKEN.test(block.trim()) ? block.trim() : sanitizeRichText(block)))
    .filter(Boolean)
    .join('\n\n');
}

function sanitizeAttrs($: cheerio.CheerioAPI, el: Element): void {
  const attribs = { ...el.attribs };
  for (const [name, value] of Object.entries(attribs)) {
    const key = name.toLowerCase();
    if (!ALLOWED_ATTRS.has(key) || !SAFE_ATTR_VALUE.test(value)) {
      $(el).removeAttr(name);
    }
  }
}
