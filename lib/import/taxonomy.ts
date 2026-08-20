/**
 * The official College Board Digital SAT taxonomy: 29 skills nested under the
 * 8 domains. Shared by the topics seed and the HTML import pipeline, so both
 * agree on what a topic is and how a source Skill string maps to one.
 *
 * Deliberately free of any Supabase or server-only import — the Trigger.dev
 * task bundles this module, and server-only throws outside the Next bundler.
 */

export type TopicSeed = {
  slug: string;
  name: string;
  categorySlug: string;
  /** Exact `Skill` values seen in College Board question-bank exports. */
  sourceSkillNames: string[];
};

// ─── Reading & Writing (10 skills) ──────────────────────────────────
const ENGLISH_TOPICS: TopicSeed[] = [
  {
    slug: 'central-ideas-and-details',
    name: 'Central Ideas & Details',
    categorySlug: 'information-and-ideas',
    sourceSkillNames: ['Central Ideas and Details'],
  },
  {
    slug: 'inferences',
    name: 'Inferences',
    categorySlug: 'information-and-ideas',
    sourceSkillNames: ['Inferences'],
  },
  {
    slug: 'command-of-evidence',
    name: 'Command of Evidence',
    categorySlug: 'information-and-ideas',
    sourceSkillNames: [
      'Command of Evidence',
      'Command of Evidence (Textual)',
      'Command of Evidence (Quantitative)',
    ],
  },
  {
    slug: 'words-in-context',
    name: 'Words in Context',
    categorySlug: 'craft-and-structure',
    sourceSkillNames: ['Words in Context'],
  },
  {
    slug: 'text-structure-and-purpose',
    name: 'Text Structure & Purpose',
    categorySlug: 'craft-and-structure',
    sourceSkillNames: ['Text Structure and Purpose'],
  },
  {
    slug: 'cross-text-connections',
    name: 'Cross-Text Connections',
    categorySlug: 'craft-and-structure',
    sourceSkillNames: ['Cross-Text Connections'],
  },
  {
    slug: 'rhetorical-synthesis',
    name: 'Rhetorical Synthesis',
    categorySlug: 'expression-of-ideas',
    sourceSkillNames: ['Rhetorical Synthesis'],
  },
  {
    slug: 'transitions',
    name: 'Transitions',
    categorySlug: 'expression-of-ideas',
    sourceSkillNames: ['Transitions'],
  },
  {
    slug: 'boundaries',
    name: 'Boundaries',
    categorySlug: 'standard-english-conventions',
    sourceSkillNames: ['Boundaries'],
  },
  {
    slug: 'form-structure-and-sense',
    name: 'Form, Structure, and Sense',
    categorySlug: 'standard-english-conventions',
    sourceSkillNames: ['Form, Structure, and Sense'],
  },
];

// ─── Math (19 skills) ───────────────────────────────────────────────
const MATH_TOPICS: TopicSeed[] = [
  {
    slug: 'linear-equations-in-one-variable',
    name: 'Linear Equations in One Variable',
    categorySlug: 'algebra',
    sourceSkillNames: ['Linear equations in one variable'],
  },
  {
    slug: 'linear-functions',
    name: 'Linear Functions',
    categorySlug: 'algebra',
    sourceSkillNames: ['Linear functions'],
  },
  {
    slug: 'linear-equations-in-two-variables',
    name: 'Linear Equations in Two Variables',
    categorySlug: 'algebra',
    sourceSkillNames: ['Linear equations in two variables'],
  },
  {
    slug: 'systems-of-two-linear-equations',
    name: 'Systems of Two Linear Equations in Two Variables',
    categorySlug: 'algebra',
    sourceSkillNames: ['Systems of two linear equations in two variables'],
  },
  {
    slug: 'linear-inequalities',
    name: 'Linear Inequalities in One or Two Variables',
    categorySlug: 'algebra',
    sourceSkillNames: ['Linear inequalities in one or two variables'],
  },
  {
    slug: 'equivalent-expressions',
    name: 'Equivalent Expressions',
    categorySlug: 'advanced-math',
    sourceSkillNames: ['Equivalent expressions'],
  },
  {
    slug: 'nonlinear-equations-and-systems',
    name: 'Nonlinear Equations in One Variable & Systems of Equations in Two Variables',
    categorySlug: 'advanced-math',
    sourceSkillNames: [
      'Nonlinear equations in one variable and systems of equations in two variables',
    ],
  },
  {
    slug: 'nonlinear-functions',
    name: 'Nonlinear Functions',
    categorySlug: 'advanced-math',
    sourceSkillNames: ['Nonlinear functions'],
  },
  {
    slug: 'ratios-rates-proportional-relationships-and-units',
    name: 'Ratios, Rates, Proportional Relationships, and Units',
    categorySlug: 'problem-solving-data-analysis',
    sourceSkillNames: ['Ratios, rates, proportional relationships, and units'],
  },
  {
    slug: 'percentages',
    name: 'Percentages',
    categorySlug: 'problem-solving-data-analysis',
    sourceSkillNames: ['Percentages'],
  },
  {
    slug: 'one-variable-data',
    name: 'One-Variable Data: Distributions and Measures of Center and Spread',
    categorySlug: 'problem-solving-data-analysis',
    sourceSkillNames: [
      'One-variable data: Distributions and measures of center and spread',
    ],
  },
  {
    slug: 'two-variable-data',
    name: 'Two-Variable Data: Models and Scatterplots',
    categorySlug: 'problem-solving-data-analysis',
    sourceSkillNames: ['Two-variable data: Models and scatterplots'],
  },
  {
    slug: 'probability-and-conditional-probability',
    name: 'Probability and Conditional Probability',
    categorySlug: 'problem-solving-data-analysis',
    sourceSkillNames: ['Probability and conditional probability'],
  },
  {
    slug: 'inference-from-sample-statistics',
    name: 'Inference from Sample Statistics and Margin of Error',
    categorySlug: 'problem-solving-data-analysis',
    sourceSkillNames: ['Inference from sample statistics and margin of error'],
  },
  {
    slug: 'evaluating-statistical-claims',
    name: 'Evaluating Statistical Claims: Observational Studies and Experiments',
    categorySlug: 'problem-solving-data-analysis',
    sourceSkillNames: [
      'Evaluating statistical claims: Observational studies and experiments',
    ],
  },
  {
    slug: 'area-and-volume',
    name: 'Area and Volume',
    categorySlug: 'geometry-trigonometry',
    sourceSkillNames: ['Area and volume', 'Area and volume formulas'],
  },
  {
    slug: 'lines-angles-and-triangles',
    name: 'Lines, Angles, and Triangles',
    categorySlug: 'geometry-trigonometry',
    sourceSkillNames: ['Lines, angles, and triangles'],
  },
  {
    slug: 'right-triangles-and-trigonometry',
    name: 'Right Triangles and Trigonometry',
    categorySlug: 'geometry-trigonometry',
    sourceSkillNames: ['Right triangles and trigonometry'],
  },
  {
    slug: 'circles',
    name: 'Circles',
    categorySlug: 'geometry-trigonometry',
    sourceSkillNames: ['Circles'],
  },
];

export const TOPICS: TopicSeed[] = [...ENGLISH_TOPICS, ...MATH_TOPICS];

/**
 * Strip everything but letters and digits.
 *
 * A wrapped source line can lose the space at the wrap point, so the same
 * skill arrives as "Linear equations in onevariable" or "Geometry
 * andTrigonometry". Comparing on alphanumerics only makes the match immune
 * to that, without loosening it into fuzzy territory.
 */
function normalizeSkill(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const TOPIC_SLUG_BY_SKILL = new Map<string, string>(
  TOPICS.flatMap(t => t.sourceSkillNames.map(s => [normalizeSkill(s), t.slug] as const))
);

/**
 * Resolve a College Board `Skill` string to a topic slug. Used by the question
 * import pipeline. Returns null when the skill is unrecognised — callers should
 * surface that for review rather than guessing a topic.
 */
export function topicSlugForSkill(skill: string): string | null {
  return TOPIC_SLUG_BY_SKILL.get(normalizeSkill(skill)) ?? null;
}
