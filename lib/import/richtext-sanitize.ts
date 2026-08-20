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
 * Plain-text rendering of one rich-text fragment, MathML-aware: a naive
 * `.text()` on `<msqrt><mi>x</mi></msqrt>` returns just "x" — silently
 * dropping the square root — which is exactly wrong for a context (the AI
 * "why is this the answer" prompt, lib/ai/explain.ts) that needs to actually
 * reason about the math. `<mfrac>` becomes "(a/b)", `<msup>` becomes "a^b",
 * etc. — good enough for a model to read, not meant for display.
 */
export function htmlFragmentToPlainText(html: string): string {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(`<div id="root">${html}</div>`);
  } catch {
    return html;
  }
  const root = $('#root').get(0) as Element;
  return collapseWhitespace(textWithMath($, root));
}

/** Same contract as {@link sanitizeQuestionTextBlocks}, but to plain text. */
export function blocksToPlainText(text: string): string {
  return (text ?? '')
    .split('\n\n')
    .map(block => (TABLE_TOKEN.test(block.trim()) ? '[table]' : htmlFragmentToPlainText(block)))
    .filter(Boolean)
    .join('\n\n');
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Walks non-math markup for its text, switching to {@link mathToText} at each `<math>` boundary. */
function textWithMath($: cheerio.CheerioAPI, el: Element): string {
  let out = '';
  for (const child of el.children) {
    if (child.type === 'text') {
      out += (child as unknown as { data: string }).data;
    } else if (child.type === 'tag') {
      const node = child as Element;
      out += node.name?.toLowerCase() === 'math' ? ` ${mathToText($, node)} ` : textWithMath($, node);
    }
  }
  return out;
}

/** Recursively renders one MathML subtree to a linear, model-readable approximation. */
function mathToText($: cheerio.CheerioAPI, el: Element): string {
  const tag = el.name?.toLowerCase();
  const kids = el.children.filter((c): c is Element => c.type === 'tag');
  const of = (e: Element) => mathToText($, e);

  switch (tag) {
    case 'math':
    case 'mrow':
    case 'mstyle':
    case 'mpadded':
    case 'semantics':
      return kids.map(of).join('');
    case 'mi':
    case 'mn':
    case 'mo':
    case 'mtext':
      return $(el).text();
    case 'mfrac':
      return `(${kids[0] ? of(kids[0]) : ''}/${kids[1] ? of(kids[1]) : ''})`;
    case 'msqrt':
      return `sqrt(${kids.map(of).join('')})`;
    case 'mroot':
      return `root${kids[1] ? of(kids[1]) : ''}(${kids[0] ? of(kids[0]) : ''})`;
    case 'msup':
      return `${kids[0] ? of(kids[0]) : ''}^${kids[1] ? of(kids[1]) : ''}`;
    case 'msub':
      return `${kids[0] ? of(kids[0]) : ''}_${kids[1] ? of(kids[1]) : ''}`;
    case 'msubsup':
      return `${kids[0] ? of(kids[0]) : ''}_${kids[1] ? of(kids[1]) : ''}^${kids[2] ? of(kids[2]) : ''}`;
    case 'mfenced': {
      const open = el.attribs?.open ?? '(';
      const close = el.attribs?.close ?? ')';
      return `${open}${kids.map(of).join(', ')}${close}`;
    }
    case 'annotation':
      return '';
    default:
      return kids.map(of).join('');
  }
}

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
