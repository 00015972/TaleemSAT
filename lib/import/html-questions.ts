/**
 * Parse a hand-converted, semantic HTML question-bank export into the same
 * shape the PDF pipeline's vision pass produces (see lib/ai/vision.ts), so
 * both sources feed the same staging/review/promote code unchanged.
 *
 * Unlike the PDF path, every field here is explicitly tagged in the source —
 * the correct answer via `class="option correct"`, taxonomy via badges, math
 * as literal LaTeX text — so this module never calls a model. It is a pure
 * DOM walk. The exact contract it expects is documented in
 * docs/15-html-import-schema.md; anything that deviates from it degrades to
 * a structural flag on that question rather than a thrown error, so one
 * malformed `<article>` never sinks the rest of the file.
 *
 * Pure — no I/O — mirrors lib/import/pdf-text.ts's contract.
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { normalizeWhitespace } from './pdf-text';
import { sanitizeChartSvg } from './svg-sanitize';

export type ParsedQuestion = {
  /** College Board's own ID pulled from the .qid span, e.g. "0147b080". */
  sourceQid: string;
  questionNumber: number | null;
  /** badge[0] — expected "SAT". */
  assessment: string | null;
  /** badge[1] — "Reading and Writing" | "Math". */
  subjectBadge: string | null;
  /** badge[2]. */
  domain: string | null;
  /** badge[3] — fed straight into topicSlugForSkill(). */
  skill: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  passage: string | null;
  questionText: string;
  questionType: 'mcq' | 'grid_in';
  options: { id: string; text: string }[];
  correctAnswer: string | null;
  acceptedAnswers: string[];
  explanation: string;
  /** True when the question body contains an <img>/<svg>/<figure> figure. */
  hasFigure: boolean;
  /** True when a table has merged cells, is nested, or its rows don't line up with its headers. */
  hasComplexTable: boolean;
  /** Raw `data:` URIs of any embedded figures — decoding/upload is the caller's job; this module has no I/O. */
  figureDataUrls: string[];
  /** Sanitized inline `<svg>` chart markup — a code-generated chart rather than a pasted image. */
  chartSvgs: string[];
  /** Human-readable, parser-level issues — folded into validation `issues[]` by the caller. */
  structuralFlags: string[];
};

export function parseQuestionBankHtml(html: string): {
  questions: ParsedQuestion[];
  parseErrors: string[];
} {
  const $ = cheerio.load(html);
  const articles = $('article.question');

  if (articles.length === 0) {
    return {
      questions: [],
      parseErrors: [
        'No <article class="question"> elements found — see docs/15-html-import-schema.md for the expected shape.',
      ],
    };
  }

  const questions: ParsedQuestion[] = [];
  articles.each((i, el) => {
    questions.push(parseOne($, $(el), i));
  });

  return { questions, parseErrors: [] };
}

const DIFFICULTY_MAP: Record<string, 'easy' | 'medium' | 'hard'> = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
};

function parseOne(
  $: cheerio.CheerioAPI,
  article: cheerio.Cheerio<Element>,
  index: number
): ParsedQuestion {
  const flags: string[] = [];

  const qidText = article.find('.qid').first().text();
  const qidMatch = qidText.match(/ID:\s*([A-Za-z0-9-]+)/i);
  const sourceQid =
    qidMatch?.[1] ?? article.attr('id')?.replace(/^q-/, '') ?? `unknown-${index}`;

  const numberMatch = article.find('.question-header h2').first().text().match(/(\d+)/);
  const questionNumber = numberMatch ? parseInt(numberMatch[1], 10) : null;

  const badges = article
    .find('.badges .badge')
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get();
  if (badges.length !== 5) {
    flags.push(
      `Expected 5 badges (Assessment/Subject/Domain/Skill/Difficulty), found ${badges.length}.`
    );
  }
  const [assessment, subjectBadge, domain, skill, difficultyRaw] = badges;
  const difficulty = difficultyRaw ? (DIFFICULTY_MAP[difficultyRaw.toLowerCase()] ?? null) : null;
  if (difficultyRaw && !difficulty) {
    flags.push(`Unrecognized difficulty badge "${difficultyRaw}" — expected Easy/Medium/Hard.`);
  }

  const passageEl = article.find('.passage').first();
  const passage = passageEl.length > 0 ? flattenParagraphs($, passageEl) || null : null;

  const bodyEl = article.find('.question-body').first();
  let questionText = '';
  let hasFigure = false;
  let hasComplexTable = false;
  const figureDataUrls: string[] = [];
  const chartSvgs: string[] = [];

  if (bodyEl.length === 0) {
    flags.push('Missing .question-body — question text is empty.');
  } else {
    const body = flattenBody($, bodyEl);
    questionText = body.text;
    hasFigure = body.hasFigure;
    hasComplexTable = body.hasComplexTable;
    figureDataUrls.push(...body.figureDataUrls);
    chartSvgs.push(...body.chartSvgs);
    if (body.svgSanitizeFailed) {
      flags.push('Embedded <svg> chart could not be sanitized — could not attach it automatically.');
    }
  }
  if (!questionText) flags.push('Question body produced no text.');

  const optionsList = article.find('ul.options').first();
  const gridInBlock = article.find('.grid-in-answer').first();

  let questionType: 'mcq' | 'grid_in' = 'mcq';
  let options: { id: string; text: string }[] = [];
  let correctAnswer: string | null = null;
  let acceptedAnswers: string[] = [];

  if (gridInBlock.length > 0 && optionsList.length === 0) {
    questionType = 'grid_in';
    const correctValue = normalizeWhitespace(
      gridInBlock.find('.correct-value').first().text()
    );
    const acceptedRaw = gridInBlock.find('.accepted-forms').first().text();
    acceptedAnswers = acceptedRaw
      .split(',')
      .map(a => normalizeWhitespace(a))
      .filter(Boolean);
    if (acceptedAnswers.length === 0 && correctValue) acceptedAnswers = [correctValue];
    if (acceptedAnswers.length === 0) flags.push('Grid-in question has no accepted answers.');
  } else {
    if (optionsList.length === 0) {
      flags.push('Missing ul.options — no answer choices found.');
    }
    const items = optionsList.find('li.option');
    if (items.length !== 4) {
      flags.push(`Expected 4 answer options, found ${items.length}.`);
    }
    let correctCount = 0;
    options = items
      .map((_, li) => {
        const $li = $(li);
        const id = normalizeWhitespace($li.find('.option-letter').first().text()).toUpperCase();
        const text = normalizeWhitespace($li.find('.option-text').first().text());
        if ($li.hasClass('correct')) {
          correctCount++;
          correctAnswer = id;
        }
        return { id, text };
      })
      .get();
    if (correctCount === 0) {
      flags.push('No option marked class="option correct" — correct answer unknown.');
    }
    if (correctCount > 1) {
      flags.push(`${correctCount} options marked correct — expected exactly 1.`);
    }
  }

  const rationaleEl = article.find('.rationale').first();
  const explanation = rationaleEl.length > 0 ? flattenParagraphs($, rationaleEl) : '';
  if (!explanation) flags.push('Missing or empty .rationale — no explanation found.');

  return {
    sourceQid,
    questionNumber,
    assessment: assessment ?? null,
    subjectBadge: subjectBadge ?? null,
    domain: domain ?? null,
    skill: skill ?? null,
    difficulty,
    passage,
    questionText,
    questionType,
    options,
    correctAnswer,
    acceptedAnswers,
    explanation,
    hasFigure,
    hasComplexTable,
    figureDataUrls,
    chartSvgs,
    structuralFlags: flags,
  };
}

/** Join every direct/nested <p> inside a container into normalized paragraphs. */
function flattenParagraphs($: cheerio.CheerioAPI, container: cheerio.Cheerio<Element>): string {
  const paragraphs = container
    .find('p')
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  if (paragraphs.length > 0) return paragraphs.join('\n\n');

  // No <p> children — fall back to the container's own text rather than
  // silently returning empty (a reviewer written straight into a <div>
  // shouldn't disappear just because it skipped the <p> convention).
  return normalizeWhitespace(container.text());
}

/**
 * Walk a .question-body's direct children in document order, turning
 * <p>/<table>/<img>/<svg>/<figure> into one plain-text block. Tables and
 * figures need special handling; everything else falls back to its own text.
 */
function flattenBody(
  $: cheerio.CheerioAPI,
  body: cheerio.Cheerio<Element>
): {
  text: string;
  hasFigure: boolean;
  hasComplexTable: boolean;
  figureDataUrls: string[];
  chartSvgs: string[];
  svgSanitizeFailed: boolean;
} {
  const parts: string[] = [];
  let hasFigure = false;
  let hasComplexTable = false;
  let svgSanitizeFailed = false;
  const figureDataUrls: string[] = [];
  const chartSvgs: string[] = [];

  body.contents().each((_, node) => {
    if (node.type !== 'tag') return; // skip bare whitespace text nodes between elements

    const $node = $(node);
    const tag = node.name.toLowerCase();

    if (tag === 'p') {
      const text = normalizeWhitespace($node.text());
      if (text) parts.push(text);
      return;
    }

    if (tag === 'table') {
      const { text, complex } = flattenTable($, $node);
      parts.push(text);
      if (complex) hasComplexTable = true;
      return;
    }

    // A code-generated chart (see docs/15-html-import-schema.md) — real inline
    // SVG, not a pasted image. Must be checked before the generic <img> case
    // below since a <figure> can contain either.
    if (tag === 'svg' || (tag === 'figure' && $node.find('svg').length > 0)) {
      const svgEl = tag === 'svg' ? $node : $node.find('svg').first();
      hasFigure = true;
      const sanitized = sanitizeChartSvg($.html(svgEl));
      if (sanitized) {
        chartSvgs.push(sanitized);
      } else {
        svgSanitizeFailed = true;
      }
      parts.push('[Chart — see attached figure]');
      return;
    }

    if (tag === 'img' || (tag === 'figure' && $node.find('img').length > 0)) {
      const img = tag === 'img' ? $node : $node.find('img').first();
      const src = img.attr('src') ?? '';
      hasFigure = true;
      if (src.startsWith('data:')) figureDataUrls.push(src);
      parts.push('[Chart/figure — see attached image]');
      return;
    }

    // Unrecognized element inside question-body — best-effort text rather
    // than silently dropping content the schema doc didn't anticipate.
    const text = normalizeWhitespace($node.text());
    if (text) parts.push(text);
  });

  return {
    text: parts.join('\n\n'),
    hasFigure,
    hasComplexTable,
    figureDataUrls,
    chartSvgs,
    svgSanitizeFailed,
  };
}

/**
 * Render a <table> as "Row N: Header: value; Header: value" lines. Legible
 * even fully collapsed onto one line by a renderer that ignores whitespace
 * (the practice UI does today — see docs/15-html-import-schema.md), since
 * every fact stays attributable to its column without relying on line breaks.
 */
function flattenTable(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<Element>
): { text: string; complex: boolean } {
  let headers = table
    .find('thead th')
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get();

  const hasMergedCells = table.find('[colspan], [rowspan]').length > 0;
  const hasNestedTable = table.find('table').length > 0;

  let rows = table.find('tbody tr').length > 0 ? table.find('tbody tr') : table.find('tr');

  // No <thead>: if the first row is all <th>, treat it as the header row.
  if (headers.length === 0 && rows.length > 0) {
    const firstRow = rows.first();
    const firstCells = firstRow.find('th');
    if (firstCells.length > 0) {
      headers = firstCells.map((_, el) => normalizeWhitespace($(el).text())).get();
      rows = rows.slice(1);
    }
  }

  let mismatch = false;
  const lines = rows
    .map((i, tr) => {
      const cells = $(tr)
        .find('td, th')
        .map((_, td) => normalizeWhitespace($(td).text()))
        .get();
      if (headers.length !== cells.length) mismatch = true;
      const paired =
        headers.length === cells.length ? cells.map((c, idx) => `${headers[idx]}: ${c}`) : cells;
      return `Row ${i + 1}: ${paired.join('; ')}`;
    })
    .get();

  const caption = normalizeWhitespace(table.find('caption').first().text());
  const text = (caption ? `Table — ${caption}\n` : 'Table:\n') + lines.join('\n');

  return { text, complex: hasMergedCells || hasNestedTable || mismatch };
}
