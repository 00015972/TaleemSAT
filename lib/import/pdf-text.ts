/**
 * Parse the metadata a College Board question-bank PDF export puts in its text
 * layer, and group pages into questions.
 *
 * What the text layer gives us reliably:
 *   Question ID, Assessment/Test, Domain, Skill, Difficulty, Correct Answer.
 *
 * What it does NOT give us: any math. Every expression is drawn as vector art,
 * so the extracted prose has holes exactly where the formulas belong —
 * "In the given equation,  and  are constants, and ." That is why the actual
 * question content has to come from a vision pass over a rendered page
 * (see lib/ai/vision.ts); this module only supplies the trustworthy metadata
 * and the answer key.
 *
 * Pure — no I/O, so it is testable and safe to run inside a Trigger.dev task.
 */

export type PageText = { pageNumber: number; text: string };

export type QuestionMeta = {
  /** College Board's own ID, e.g. "ac472881". Used for dedupe and provenance. */
  questionId: string;
  domain: string | null;
  skill: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  /** Raw string between "Correct Answer:" and "Rationale", uncleaned. */
  correctAnswerRaw: string | null;
};

export type QuestionPages = {
  meta: QuestionMeta;
  /** 1-based page numbers this question spans; usually one, sometimes two. */
  pageNumbers: number[];
  /** Concatenated text layer for those pages — context for the vision model. */
  text: string;
};

/** Collapse the runs of whitespace pdfjs emits between glyph groups. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const DIFFICULTY_BY_LABEL: Record<string, 'easy' | 'medium' | 'hard'> = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
};

/**
 * Pull the metadata header off a page. Returns null when the page carries no
 * "Question ID:" — that means it is a continuation of the previous question.
 */
export function parsePageMeta(text: string): QuestionMeta | null {
  const flat = normalizeWhitespace(text);

  // Glyph groups carry no separator of their own, so neighbouring fields run
  // together: "ac472881Assessment", "onevariableHard", "HardQuestion". Every
  // pattern here is bounded by the next literal rather than by \b.
  const idMatch = flat.match(/Question\s*ID:\s*([A-Za-z0-9-]+?)\s*(?=Assessment|$)/i);
  if (!idMatch) return null;

  // The header row reads: "Assessment Test Domain Skill Difficulty" followed by
  // the values, e.g. "SAT Math Algebra Linear equations in one variable Hard".
  // Difficulty is the terminator, so everything between the test name and it is
  // domain + skill — which run together without a delimiter.
  const headerMatch = flat.match(
    /Assessment\s*Test\s*Domain\s*Skill\s*Difficulty\s*(.*?)(Easy|Medium|Hard)(?=Question|\s|$)/i
  );

  let domain: string | null = null;
  let skill: string | null = null;
  let difficulty: 'easy' | 'medium' | 'hard' | null = null;

  if (headerMatch) {
    difficulty = DIFFICULTY_BY_LABEL[headerMatch[2].toLowerCase()] ?? null;
    const values = normalizeWhitespace(headerMatch[1]).replace(/^SAT\s+/i, '');
    // values is now like "Math Algebra Linear equations in one variable".
    const parsed = splitDomainAndSkill(values);
    domain = parsed.domain;
    skill = parsed.skill;
  }

  const answerMatch = flat.match(/Correct\s*Answer:\s*(.*?)\s*(?:Rationale|$)/i);

  return {
    questionId: idMatch[1],
    domain,
    skill,
    difficulty,
    correctAnswerRaw: answerMatch ? normalizeWhitespace(answerMatch[1]) || null : null,
  };
}

/** The eight official domains, longest first so the greedy prefix match is safe. */
const DOMAINS = [
  'Problem-Solving and Data Analysis',
  'Standard English Conventions',
  'Geometry and Trigonometry',
  'Information and Ideas',
  'Expression of Ideas',
  'Craft and Structure',
  'Advanced Math',
  'Algebra',
];

/**
 * Separate "Math Algebra Linear equations in one variable" into its domain and
 * skill. There is no delimiter between them, so we match a known domain name as
 * a prefix — compared on alphanumerics only, since line wraps eat spaces.
 */
function splitDomainAndSkill(values: string): {
  domain: string | null;
  skill: string | null;
} {
  // Drop the leading subject word ("Math" / "Reading and Writing").
  const withoutSubject = values
    .replace(/^Reading\s*(and|&)\s*Writing\s*/i, '')
    .replace(/^Math\s*/i, '')
    .trim();

  const squashed = withoutSubject.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const domain of DOMAINS) {
    const key = domain.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!squashed.startsWith(key)) continue;

    // Walk the original string until we've consumed `key.length` alphanumerics,
    // so the skill keeps its original spacing.
    let consumed = 0;
    let cut = 0;
    for (let i = 0; i < withoutSubject.length && consumed < key.length; i++) {
      if (/[a-z0-9]/i.test(withoutSubject[i])) consumed++;
      cut = i + 1;
    }
    const skill = withoutSubject.slice(cut).trim();
    return { domain, skill: skill || null };
  }

  return { domain: null, skill: withoutSubject || null };
}

/**
 * Group pages into questions. A question begins on the page carrying its
 * "Question ID:" and runs until the next one — a long rationale spills onto
 * following pages, which have no header of their own.
 *
 * Pages before the first header (cover sheets) are dropped.
 */
export function groupPagesByQuestion(pages: PageText[]): QuestionPages[] {
  const questions: QuestionPages[] = [];

  for (const page of pages) {
    const meta = parsePageMeta(page.text);

    if (meta) {
      questions.push({
        meta,
        pageNumbers: [page.pageNumber],
        text: normalizeWhitespace(page.text),
      });
      continue;
    }

    const current = questions[questions.length - 1];
    if (!current) continue; // spillover with no question yet — ignore

    current.pageNumbers.push(page.pageNumber);
    current.text = `${current.text} ${normalizeWhitespace(page.text)}`.trim();
  }

  return questions;
}

/**
 * Interpret the answer key. A single A–D letter means multiple choice;
 * anything else is a grid-in, whose several accepted forms arrive
 * comma-separated (e.g. ".1764, .1765, 3/17").
 */
export function interpretAnswer(raw: string | null): {
  questionType: 'mcq' | 'grid_in';
  correctAnswer: string | null;
  acceptedAnswers: string[];
} {
  const value = (raw ?? '').trim();

  if (/^[A-D]$/i.test(value)) {
    return {
      questionType: 'mcq',
      correctAnswer: value.toUpperCase(),
      acceptedAnswers: [],
    };
  }

  const accepted = value
    .split(',')
    .map(a => a.trim())
    .filter(Boolean);

  return {
    questionType: 'grid_in',
    correctAnswer: null,
    acceptedAnswers: accepted,
  };
}
