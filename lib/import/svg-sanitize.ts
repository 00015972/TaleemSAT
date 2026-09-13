/**
 * Allowlist sanitizer for inline `<svg>` chart markup pulled out of an
 * admin-uploaded HTML question bank (see lib/import/html-questions.ts).
 *
 * The source is semi-trusted at best — an admin ran a PDF through an AI chat
 * tool and pasted whatever it produced — and the output lands in every
 * student's browser via `dangerouslySetInnerHTML` (components/reading/chart-figure.tsx).
 * So this allowlists tags and attributes rather than blocking known-bad ones:
 * anything not explicitly recognized as a chart primitive is dropped, not
 * merely defanged. No `<script>`, `<foreignObject>`, `<style>`, `<image>`,
 * `<use>`, `<a>`, `href`/`xlink:href`, `on*` handlers, or `style` attributes
 * survive — chart SVGs from this pipeline never need any of them.
 *
 * Pure — no I/O — mirrors the rest of lib/import/*'s contract.
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

const ALLOWED_TAGS = new Set([
  'svg',
  'g',
  'defs',
  'title',
  'desc',
  'text',
  'tspan',
  'line',
  'rect',
  'circle',
  'ellipse',
  'polyline',
  'polygon',
  'path',
  'lineargradient',
  'radialgradient',
  'stop',
]);

const ALLOWED_ATTRS = new Set([
  'viewbox',
  'xmlns',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'dx',
  'dy',
  'points',
  'd',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'fill-opacity',
  'opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'font-size',
  'font-weight',
  'font-family',
  'font-style',
  'text-anchor',
  'transform',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientunits',
  'gradienttransform',
  'id',
  'preserveaspectratio',
]);

/** `fill`/`stroke`/`stop-color` accept a color keyword or function, never a `url(...)` reference. */
const COLOR_VALUE = /^(currentColor|none|transparent|#[0-9a-fA-F]{3,8}|rgba?\([\d.,%\s]+\)|[a-zA-Z]+)$/;

/** `transform` accepts only numeric rotate/translate/scale/matrix — no arbitrary expressions. */
const TRANSFORM_VALUE = /^(\s*(rotate|translate|scale|matrix)\(\s*-?[\d.,\s-]+\)\s*)+$/;

/** Everything else on the allowlist is geometry/typography — free-form but non-executable. */
const SAFE_GENERIC_VALUE = /^[a-zA-Z0-9\s.,#%\-_'"/:;]*$/;

/**
 * Sanitize one `<svg>...</svg>` (or `<figure><svg>...</svg></figure>`)
 * fragment down to safe chart primitives. Returns null if nothing survives
 * (e.g. the fragment didn't actually contain an `<svg>`, or parsing failed).
 */
export function sanitizeChartSvg(rawMarkup: string): string | null {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(rawMarkup, { xmlMode: true });
  } catch {
    return null;
  }

  const svg = $('svg').first();
  if (svg.length === 0) return null;

  sanitizeNode($, svg.get(0) as Element);

  const out = $.html(svg);
  return out.trim() || null;
}

function sanitizeNode($: cheerio.CheerioAPI, el: Element): void {
  const tag = el.name?.toLowerCase();

  if (!ALLOWED_TAGS.has(tag)) {
    $(el).remove();
    return;
  }

  const attribs = { ...el.attribs };
  for (const [name, value] of Object.entries(attribs)) {
    const key = name.toLowerCase();
    if (!ALLOWED_ATTRS.has(key)) {
      $(el).removeAttr(name);
      continue;
    }
    if (!isSafeAttrValue(key, value)) {
      $(el).removeAttr(name);
    }
  }

  // Recurse over a static copy — sanitizeNode may remove children as it goes.
  for (const child of [...el.children]) {
    if (child.type === 'tag') sanitizeNode($, child as Element);
    else if (child.type !== 'text') $(child).remove(); // drop comments, CDATA, etc.
  }
}

function isSafeAttrValue(attr: string, value: string): boolean {
  if (attr === 'fill' || attr === 'stroke' || attr === 'stop-color') {
    return COLOR_VALUE.test(value.trim());
  }
  if (attr === 'transform' || attr === 'gradienttransform') {
    return TRANSFORM_VALUE.test(value.trim());
  }
  return SAFE_GENERIC_VALUE.test(value);
}
