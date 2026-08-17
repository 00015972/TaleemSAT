/**
 * Allowlist sanitizer for `<table>` markup pulled out of an admin-uploaded
 * HTML question bank (see lib/import/html-questions.ts).
 *
 * Mirrors lib/import/svg-sanitize.ts's threat model: the source is
 * semi-trusted at best — an admin ran a PDF through an AI chat tool and
 * pasted whatever it produced — and the output lands in every student's
 * browser via `dangerouslySetInnerHTML` (components/reading/table-figure.tsx).
 * So this allowlists structural table tags plus a small set of inline text
 * tags; everything else is unwrapped (text kept, tag dropped) or removed
 * outright for attributes/comments/scripts.
 *
 * Pure — no I/O — mirrors the rest of lib/import/*'s contract.
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

const STRUCTURAL_TAGS = new Set([
  'table',
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
]);
const INLINE_TAGS = new Set(['strong', 'em', 'b', 'i', 'sup', 'sub', 'br', 'span']);
const ALLOWED_TAGS = new Set([...STRUCTURAL_TAGS, ...INLINE_TAGS]);

const POSITIVE_INT = /^[1-9]\d*$/;
const SCOPE_VALUES = new Set(['col', 'row', 'colgroup', 'rowgroup']);

/**
 * Sanitize one `<table>...</table>` fragment down to safe structural and
 * inline-text markup. Returns null if nothing survives (e.g. the fragment
 * didn't actually contain a `<table>`, or parsing failed).
 */
export function sanitizeTableHtml(rawMarkup: string): string | null {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(rawMarkup);
  } catch {
    return null;
  }

  const table = $('table').first();
  if (table.length === 0) return null;

  const el = table.get(0) as Element;
  sanitizeAttrs($, el);
  sanitizeChildren($, el);

  const out = $.html(table);
  return out.trim() || null;
}

/** Strips every attribute except a small allowlist of layout-relevant ones. */
function sanitizeAttrs($: cheerio.CheerioAPI, el: Element): void {
  const tag = el.name?.toLowerCase();
  const attribs = { ...el.attribs };
  for (const [name, value] of Object.entries(attribs)) {
    const key = name.toLowerCase();
    const val = value.trim();
    const allowed =
      (tag === 'td' || tag === 'th') && (key === 'colspan' || key === 'rowspan')
        ? POSITIVE_INT.test(val)
        : tag === 'th' && key === 'scope'
          ? SCOPE_VALUES.has(val.toLowerCase())
          : false;
    if (!allowed) $(el).removeAttr(name);
  }
}

/**
 * Walk an element's children. Allowlisted tags keep their (sanitized)
 * structure; anything else is unwrapped so its text/children survive without
 * the disallowed wrapper — losing a stray `<div>` around a cell's text would
 * silently drop real table data, which is worse than just stripping the tag.
 */
function sanitizeChildren($: cheerio.CheerioAPI, parent: Element): void {
  for (const child of [...parent.children]) {
    if (child.type === 'text') continue;
    if (child.type !== 'tag') {
      $(child).remove(); // comments, CDATA, etc.
      continue;
    }
    const el = child as Element;
    const tag = el.name?.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      sanitizeChildren($, el);
      $(el).replaceWith($(el).contents());
      continue;
    }
    sanitizeAttrs($, el);
    sanitizeChildren($, el);
  }
}
