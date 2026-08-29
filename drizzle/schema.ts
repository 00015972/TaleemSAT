import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  date,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Enums ──────────────────────────────────────────────────────────
export const tierEnum = pgEnum('user_tier', ['free', 'pro', 'elite']);
export const roleEnum = pgEnum('user_role', ['student', 'admin']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'trialing',
]);
export const subscriptionProviderEnum = pgEnum('subscription_provider', [
  'stripe',
  'payme',
]);
export const questionStatusEnum = pgEnum('question_status', [
  'draft',
  'published',
  'archived',
]);
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);
export const questionTypeEnum = pgEnum('question_type', ['mcq', 'grid_in']);
export const examStatusEnum = pgEnum('exam_status', ['draft', 'published', 'archived']);
export const moduleVariantEnum = pgEnum('module_variant', ['easy', 'hard']);
export const importJobTypeEnum = pgEnum('import_job_type', ['extract', 'generate']);
export const importJobStatusEnum = pgEnum('import_job_status', [
  'queued',
  'running',
  'completed',
  'failed',
]);
export const importItemStatusEnum = pgEnum('import_item_status', [
  'pending_review',
  'verification_failed',
  'approved',
  'rejected',
]);
export const attemptContextEnum = pgEnum('attempt_context', [
  'practice',
  'mock',
]);
export const aiKindEnum = pgEnum('ai_kind', ['weakness', 'plan', 'prediction']);
export const emailCategoryEnum = pgEnum('email_category', [
  'engagement',
  'marketing',
]);

// ─── Subjects ───────────────────────────────────────────────────────
export const subjects = pgTable('subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Categories ─────────────────────────────────────────────────────
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('categories_subject_id_idx').on(t.subjectId)]
);

// ─── Users (mirrors auth.users) ─────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(), // matches auth.users.id (no defaultRandom)
    email: text('email').notNull().unique(),
    fullName: text('full_name'),
    role: roleEnum('role').notNull().default('student'),
    tier: tierEnum('tier').notNull().default('free'),
    targetSatScore: integer('target_sat_score'),
    examDate: date('exam_date'),
    marketingOptIn: boolean('marketing_opt_in').notNull().default(true),
    stripeCustomerId: text('stripe_customer_id'),
    subscriptionId: text('subscription_id'),
    subscriptionStatus: subscriptionStatusEnum('subscription_status'),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('users_role_idx').on(t.role),
    index('users_tier_idx').on(t.tier),
  ]
);

// ─── Questions ──────────────────────────────────────────────────────
export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    passage: text('passage'),
    questionText: text('question_text').notNull(),
    questionImageUrl: text('question_image_url'),
    // Sanitized inline <svg> chart markup — see lib/import/svg-sanitize.ts.
    // Mutually exclusive with questionImageUrl in practice: a figure is
    // either a code-generated chart or a pasted image, never both.
    chartSvg: text('chart_svg'),
    // Sanitized <table> markup, in document order — see
    // lib/import/table-sanitize.ts. questionText carries a `[[table:N]]`
    // token at each table's original position.
    tables: text('tables').array().notNull().default(sql`'{}'::text[]`),
    questionType: questionTypeEnum('question_type').notNull().default('mcq'),
    options: jsonb('options').notNull(), // [{ id: 'A', text: '...' }, ...]; [] for grid_in
    correctAnswer: text('correct_answer').notNull(), // 'A'-'D' for mcq; canonical value for grid_in
    // Grid-in only: every accepted written form, e.g. ['3/2', '1.5'].
    acceptedAnswers: text('accepted_answers').array().notNull().default(sql`'{}'::text[]`),
    explanation: text('explanation').notNull(),
    difficulty: difficultyEnum('difficulty').notNull(),
    status: questionStatusEnum('status').notNull().default('draft'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    topicId: uuid('topic_id'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('questions_category_id_idx').on(t.categoryId),
    index('questions_status_idx').on(t.status),
    index('questions_tags_gin_idx').using('gin', t.tags),
    index('questions_published_subject_manifest_idx')
      .on(t.subjectId, t.createdAt, t.id, t.difficulty)
      .where(sql`${t.status} = 'published'`),
    index('questions_published_category_manifest_idx')
      .on(t.categoryId, t.createdAt, t.id, t.difficulty)
      .where(sql`${t.status} = 'published'`),
    index('questions_published_topic_manifest_idx')
      .on(t.topicId, t.createdAt, t.id, t.difficulty)
      .where(sql`${t.status} = 'published'`),
  ]
);

// ─── Attempts ───────────────────────────────────────────────────────
export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    selectedAnswer: text('selected_answer').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    timeTakenMs: integer('time_taken_ms'),
    context: attemptContextEnum('context').notNull().default('practice'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('attempts_user_id_created_at_idx').on(t.userId, t.createdAt),
    index('attempts_question_id_idx').on(t.questionId),
    index('attempts_user_question_idx').on(t.userId, t.questionId),
  ]
);

// ─── Certificates ───────────────────────────────────────────────────
export const certificates = pgTable(
  'certificates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tier: integer('tier').notNull(), // 25, 50, 100, 200, ...
    awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
    pdfUrl: text('pdf_url'),
    pdfGeneratedAt: timestamp('pdf_generated_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('certificates_user_tier_unique_idx').on(t.userId, t.tier),
    index('certificates_user_id_idx').on(t.userId),
  ]
);

// ─── AI insights ────────────────────────────────────────────────────
export const aiInsights = pgTable(
  'ai_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: aiKindEnum('kind').notNull(),
    promptHash: text('prompt_hash').notNull(),
    payload: jsonb('payload').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('ai_insights_user_kind_idx').on(t.userId, t.kind),
    index('ai_insights_expires_at_idx').on(t.expiresAt),
  ]
);

// ─── Subscriptions ──────────────────────────────────────────────────
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: subscriptionProviderEnum('provider').notNull(),
    status: subscriptionStatusEnum('status').notNull(),
    tier: tierEnum('tier').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripeCustomerId: text('stripe_customer_id'),
    paymeTransactionId: text('payme_transaction_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('subscriptions_user_id_idx').on(t.userId)]
);

// ─── Stripe events (idempotency) ────────────────────────────────────
export const stripeEvents = pgTable('stripe_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  stripeEventId: text('stripe_event_id').notNull().unique(),
  type: text('type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  raw: jsonb('raw').notNull(),
});

// ─── Audit log ──────────────────────────────────────────────────────
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(), // 'question.create', 'user.update', ...
    targetType: text('target_type').notNull(), // 'question' | 'user'
    targetId: uuid('target_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_actor_idx').on(t.actorUserId),
    index('audit_log_target_idx').on(t.targetType, t.targetId),
  ]
);

// ─── Email subscriptions ────────────────────────────────────────────
export const emailSubscriptions = pgTable(
  'email_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    category: emailCategoryEnum('category').notNull(),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('email_subs_email_category_unique_idx').on(t.email, t.category),
    index('email_subs_user_id_idx').on(t.userId),
  ]
);

// ─── Import pipeline ────────────────────────────────────────────────
// Staging for the admin HTML question-import pipeline. Output lands in
// `import_job_items` for human review; only approved items are promoted
// into `questions` as drafts.
export const importJobs = pgTable(
  'import_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: importJobTypeEnum('type').notNull(),
    status: importJobStatusEnum('status').notNull().default('queued'),
    // extract: {}. generate: { subjectSlug, categorySlug, difficulty, count }.
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    sourceFormat: text('source_format').notNull().default('html'),
    // Path within the `source-html` bucket.
    sourceHtmlPath: text('source_html_path'),
    sourceFilename: text('source_filename'),
    totalCount: integer('total_count').notNull().default(0),
    successCount: integer('success_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    error: text('error'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('import_jobs_status_idx').on(t.status),
    index('import_jobs_created_by_idx').on(t.createdBy),
    index('import_jobs_created_at_idx').on(t.createdAt),
    index('import_jobs_source_format_idx').on(t.sourceFormat),
  ]
);

export const importJobItems = pgTable(
  'import_job_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => importJobs.id, { onDelete: 'cascade' }),
    status: importItemStatusEnum('status').notNull().default('pending_review'),
    // College Board Question ID, or batch index.
    sourceRef: text('source_ref'),
    subjectId: uuid('subject_id').references(() => subjects.id),
    categoryId: uuid('category_id').references(() => categories.id),
    questionType: questionTypeEnum('question_type').notNull().default('mcq'),
    questionText: text('question_text'),
    passage: text('passage'),
    options: jsonb('options').notNull().default(sql`'[]'::jsonb`),
    correctAnswer: text('correct_answer'),
    acceptedAnswers: text('accepted_answers').array().notNull().default(sql`'{}'::text[]`),
    explanation: text('explanation'),
    difficulty: difficultyEnum('difficulty'),
    questionImageUrl: text('question_image_url'),
    chartSvg: text('chart_svg'),
    tables: text('tables').array().notNull().default(sql`'{}'::text[]`),
    // Why the item passed/failed its answer check (solver vs verifier model).
    verificationNotes: jsonb('verification_notes'),
    // validateQuestion() output at staging time, so reviewers see blockers.
    validationErrors: jsonb('validation_errors'),
    // Set on promotion; also guards against double-promotion.
    questionId: uuid('question_id').references(() => questions.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('import_job_items_job_id_idx').on(t.jobId),
    index('import_job_items_status_idx').on(t.status),
    index('import_job_items_job_status_idx').on(t.jobId, t.status),
  ]
);


// ─── Topics ─────────────────────────────────────────────────────────
// Third taxonomy tier (subject -> category -> topic). Drives the Practice
// page's per-topic cards; the 8 categories remain the College Board domains
// used for analytics and AI weakness insights.
export const topics = pgTable(
  'topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('topics_category_id_idx').on(t.categoryId),
    index('topics_display_order_idx').on(t.displayOrder),
  ]
);

// ─── Exams (mock tests) ─────────────────────────────────────────────
// A named, versioned mock test - e.g. "March 2026, Version A" - built from
// four fixed modules. Module 2's easy/hard variant is fixed per version
// rather than chosen adaptively from Module 1 performance.
export const exams = pgTable(
  'exams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(), // 'March 2026'
    version: text('version').notNull(), // 'A'
    year: integer('year').notNull(), // groups the card rows
    status: examStatusEnum('status').notNull().default('draft'),
    displayOrder: integer('display_order').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('exams_title_version_unique').on(t.title, t.version),
    index('exams_year_idx').on(t.year),
    index('exams_status_idx').on(t.status),
  ]
);

// One row per section-module: RW M1, RW M2, Math M1, Math M2.
export const examModules = pgTable(
  'exam_modules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id),
    moduleNumber: integer('module_number').notNull(), // 1 | 2
    // null for Module 1; 'easy' | 'hard' for Module 2.
    variant: moduleVariantEnum('variant'),
    timeLimitSeconds: integer('time_limit_seconds'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('exam_modules_exam_subject_number_unique').on(
      t.examId,
      t.subjectId,
      t.moduleNumber
    ),
    index('exam_modules_exam_id_idx').on(t.examId),
  ]
);

export const examQuestions = pgTable(
  'exam_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => examModules.id, { onDelete: 'cascade' }),
    // restrict: a question in a published exam must not silently vanish.
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('exam_questions_module_position_unique').on(t.moduleId, t.position),
    uniqueIndex('exam_questions_module_question_unique').on(t.moduleId, t.questionId),
    index('exam_questions_module_id_idx').on(t.moduleId),
    index('exam_questions_question_id_idx').on(t.questionId),
  ]
);
