/**
 * Parse a hand-converted, semantic HTML question-bank export into staged
 * question rows for the same staging/review/promote pipeline.
 *
 * Every field here is explicitly tagged in the source — the correct answer
 * via `class="option correct"`, taxonomy via badges, math as literal LaTeX
 * text — so this module never calls a model. It is a pure DOM walk. The
 * exact contract it expects is documented in docs/15-html-import-schema.md;
 * anything that deviates from it degrades to a structural flag on that
 * question rather than a thrown error, so one malformed `<article>` never
 * sinks the rest of the file.
 *
 * Pure — no I/O.
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { sanitizeChartSvg } from './svg-sanitize';
import { sanitizeTableHtml } from './table-sanitize';
import { sanitizeRichText } from './richtext-sanitize';

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

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
  /**
   * Sanitized `<table>` markup, in document order. `questionText` carries a
   * `[[table:N]]` token at each table's original position — the renderer
   * (components/reading/question-body.tsx) swaps it back in.
   */
  tables: string[];
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

// Cosmetic only (see ParsedQuestion.subjectBadge doc comment) — taxonomy
// resolution goes through `skill` alone (lib/import/taxonomy.ts), which is
// unambiguous across both subjects, so a missing Subject badge never blocks
// an import. This just fills in what the review UI displays.
const MATH_DOMAINS = new Set([
  'algebra',
  'advanced math',
  'problem-solving and data analysis',
  'geometry and trigonometry',
]);
const RW_DOMAINS = new Set([
  'information and ideas',
  'craft and structure',
  'expression of ideas',
  'standard english conventions',
]);
function inferSubjectFromDomain(domain: string | undefined): string | undefined {
  if (!domain) return undefined;
  const key = domain.trim().toLowerCase();
  if (MATH_DOMAINS.has(key)) return 'Math';
  if (RW_DOMAINS.has(key)) return 'Reading and Writing';
  return undefined;
}

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

  // The documented shape is 5 badges (Assessment/Subject/Domain/Skill/
  // Difficulty), but a Math question-bank scrape in the wild omits the
  // Subject badge entirely — 4 badges: Assessment/Domain/Skill/Difficulty.
  // Positionally destructuring 4 items as if they were 5 would silently
  // shift every field by one (skill would read "Easy", difficulty would be
  // null), so detect the 4-badge shape explicitly rather than flag-and-guess.
  let assessment: string | undefined;
  let subjectBadge: string | undefined;
  let domain: string | undefined;
  let skill: string | undefined;
  let difficultyRaw: string | undefined;

  if (badges.length === 5) {
    [assessment, subjectBadge, domain, skill, difficultyRaw] = badges;
  } else if (badges.length === 4) {
    [assessment, domain, skill, difficultyRaw] = badges;
    subjectBadge = inferSubjectFromDomain(domain);
  } else {
    flags.push(
      `Expected 5 badges (Assessment/Subject/Domain/Skill/Difficulty) or 4 (Subject omitted), found ${badges.length}.`
    );
    [assessment, subjectBadge, domain, skill, difficultyRaw] = badges;
  }

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
  const tables: string[] = [];

  if (bodyEl.length === 0) {
    flags.push('Missing .question-body — question text is empty.');
  } else {
    const body = flattenBody($, bodyEl);
    questionText = body.text;
    hasFigure = body.hasFigure;
    hasComplexTable = body.hasComplexTable;
    figureDataUrls.push(...body.figureDataUrls);
    chartSvgs.push(...body.chartSvgs);
    tables.push(...body.tables);
    if (body.svgSanitizeFailed) {
      flags.push('Embedded <svg> chart could not be sanitized — could not attach it automatically.');
    }
    if (body.tableSanitizeFailed) {
      flags.push('A <table> could not be parsed — could not attach it automatically.');
    }
  }
  if (!questionText) flags.push('Question body produced no text.');

  const optionsList = article.find('ul.options').first();
  // Two grid-in shapes are in the wild: the documented `.grid-in-answer`
  // (hand-authored) and `.grid-in-check[data-answer="..., ..."]`, which is
  // what the Math question-bank scraping tool actually emits (see
  // docs/15-html-import-schema.md).
  const gridInAnswerBlock = article.find('.grid-in-answer').first();
  const gridInCheckBlock = article.find('.grid-in-check[data-answer]').first();

  let questionType: 'mcq' | 'grid_in' = 'mcq';
  let options: { id: string; text: string }[] = [];
  let correctAnswer: string | null = null;
  let acceptedAnswers: string[] = [];

  if ((gridInAnswerBlock.length > 0 || gridInCheckBlock.length > 0) && optionsList.length === 0) {
    questionType = 'grid_in';
    if (gridInCheckBlock.length > 0) {
      const raw = gridInCheckBlock.attr('data-answer') ?? '';
      acceptedAnswers = raw
        .split(',')
        .map(a => normalizeWhitespace(a))
        .filter(Boolean);
    } else {
      const correctValue = normalizeWhitespace(
        gridInAnswerBlock.find('.correct-value').first().text()
      );
      const acceptedRaw = gridInAnswerBlock.find('.accepted-forms').first().text();
      acceptedAnswers = acceptedRaw
        .split(',')
        .map(a => normalizeWhitespace(a))
        .filter(Boolean);
      if (acceptedAnswers.length === 0 && correctValue) acceptedAnswers = [correctValue];
    }
    if (acceptedAnswers.length === 0) {
      flags.push('Grid-in question has no accepted answers.');
    } else {
      // The DB requires a canonical correct_answer even for grid-in — the
      // first accepted form is as good a canonical value as any.
      correctAnswer = acceptedAnswers[0];
    }
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
        const text = sanitizeRichText($li.find('.option-text').first().html() ?? '');
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
    tables,
    structuralFlags: flags,
  };
}

/**
 * Join every direct/nested <p> inside a container into rich-text paragraphs —
 * sanitized HTML (bold/italic/sup/sub/MathML survive; see
 * lib/import/richtext-sanitize.ts) rather than plain text, so inline math in
 * a rationale or passage renders instead of collapsing to bare characters.
 */
function flattenParagraphs($: cheerio.CheerioAPI, container: cheerio.Cheerio<Element>): string {
  const paragraphs = container
    .find('p')
    .map((_, el) => sanitizeRichText($(el).html() ?? ''))
    .get()
    .filter(Boolean);

  if (paragraphs.length > 0) return paragraphs.join('\n\n');

  // No <p> children — fall back to the container's own markup rather than
  // silently returning empty (a reviewer written straight into a <div>
  // shouldn't disappear just because it skipped the <p> convention).
  return sanitizeRichText(container.html() ?? '');
}

/**
 * Walk a .question-body's direct children in document order, turning
 * <p>/<table>/<img>/<svg>/<figure> into one text block, joined by blank
 * lines so the renderer (components/reading/question-body.tsx) can split it
 * back into paragraphs. A <table> becomes a `[[table:N]]` token at its
 * original position — the real, sanitized markup lives in `tables[N]` since
 * a <table> can't be embedded in a plain-text string.
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
  tables: string[];
  svgSanitizeFailed: boolean;
  tableSanitizeFailed: boolean;
} {
  const parts: string[] = [];
  let hasFigure = false;
  let hasComplexTable = false;
  let svgSanitizeFailed = false;
  let tableSanitizeFailed = false;
  const figureDataUrls: string[] = [];
  const chartSvgs: string[] = [];
  const tables: string[] = [];

  body.contents().each((_, node) => {
    if (node.type !== 'tag') return; // skip bare whitespace text nodes between elements

    const $node = $(node);
    const tag = node.name.toLowerCase();

    if (tag === 'p') {
      const html = sanitizeRichText($node.html() ?? '');
      if (html) parts.push(html);
      return;
    }

    // An enumerated list of statements (e.g. "I. ... II. ... III. ..."),
    // referenced by the answer choices ("I and II only"). Kept as real
    // <ol>/<ul> markup — flattening it to inline text would lose which
    // statement is I vs. II vs. III.
    if (tag === 'ol' || tag === 'ul') {
      const html = sanitizeRichText($.html($node) ?? '');
      if (html) parts.push(html);
      return;
    }

    if (tag === 'table') {
      const { html, complex } = extractTable($, $node);
      if (html) {
        tables.push(html);
        parts.push(`[[table:${tables.length - 1}]]`);
      } else {
        tableSanitizeFailed = true;
        parts.push('[Table — see original source]');
      }
      if (complex) hasComplexTable = true;
      return;
    }

    // A figure wrapper — the documented shape is a semantic <figure>, but a
    // Math question-bank scrape actually wraps its graphs in <div
    // class="figure">, so both count.
    const isFigureWrapper = tag === 'figure' || (tag === 'div' && $node.hasClass('figure'));

    // A code-generated chart (see docs/15-html-import-schema.md) — real inline
    // SVG, not a pasted image. Must be checked before the generic <img> case
    // below since a figure wrapper can contain either.
    if (tag === 'svg' || (isFigureWrapper && $node.find('svg').length > 0)) {
      const svgEl = tag === 'svg' ? $node : $node.find('svg').first();
      hasFigure = true;
      const sanitized = sanitizeChartSvg($.html(svgEl));
      if (sanitized) {
        // Rendered directly via components/reading/chart-figure.tsx above the
        // question body — a text placeholder here would just be a redundant
        // caption underneath the real chart.
        chartSvgs.push(sanitized);
      } else {
        svgSanitizeFailed = true;
        parts.push('[Chart — see attached figure]');
      }
      return;
    }

    if (tag === 'img' || (isFigureWrapper && $node.find('img').length > 0)) {
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
    tables,
    svgSanitizeFailed,
    tableSanitizeFailed,
  };
}

/**
 * Sanitize a <table> into real markup for direct rendering
 * (components/reading/table-figure.tsx), and flag it `complex` — merged
 * cells, a nested table, or a row whose cell count doesn't match its
 * headers — so a human confirms it renders correctly before publishing.
 */
function extractTable(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<Element>
): { html: string | null; complex: boolean } {
  const hasMergedCells = table.find('[colspan], [rowspan]').length > 0;
  const hasNestedTable = table.find('table').length > 0;

  let headerCount = table.find('thead th').length;
  let rows = table.find('tbody tr').length > 0 ? table.find('tbody tr') : table.find('tr');

  // No <thead>: if the first row is all <th>, treat it as the header row.
  if (headerCount === 0 && rows.length > 0) {
    const firstCells = rows.first().find('th');
    if (firstCells.length > 0) {
      headerCount = firstCells.length;
      rows = rows.slice(1);
    }
  }

  let mismatch = false;
  if (headerCount > 0) {
    rows.each((_, tr) => {
      if ($(tr).find('td, th').length !== headerCount) mismatch = true;
    });
  }

  const html = sanitizeTableHtml($.html(table));
  return { html, complex: hasMergedCells || hasNestedTable || mismatch };
}
