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
export const attemptContextEnum = pgEnum('attempt_context', [
  'practice',
  'qod',
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
    points: integer('points').notNull().default(0),
    streakDays: integer('streak_days').notNull().default(0),
    lastQodAnsweredAt: timestamp('last_qod_answered_at', { withTimezone: true }),
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
    options: jsonb('options').notNull(), // { A: '...', B: '...', C: '...', D: '...' }
    correctAnswer: text('correct_answer').notNull(), // 'A' | 'B' | 'C' | 'D'
    explanation: text('explanation').notNull(),
    difficulty: difficultyEnum('difficulty').notNull(),
    status: questionStatusEnum('status').notNull().default('draft'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('questions_category_id_idx').on(t.categoryId),
    index('questions_status_idx').on(t.status),
    index('questions_tags_gin_idx').using('gin', t.tags),
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
  ]
);

// ─── QOD schedule ───────────────────────────────────────────────────
export const qodSchedule = pgTable(
  'qod_schedule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduledDate: date('scheduled_date').notNull().unique(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('qod_scheduled_date_unique_idx').on(t.scheduledDate)]
);

// ─── QOD answers ────────────────────────────────────────────────────
export const qodAnswers = pgTable(
  'qod_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    qodId: uuid('qod_id')
      .notNull()
      .references(() => qodSchedule.id, { onDelete: 'cascade' }),
    selectedAnswer: text('selected_answer').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    pointsAwarded: integer('points_awarded').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('qod_answers_user_qod_unique_idx').on(t.userId, t.qodId),
    index('qod_answers_user_id_idx').on(t.userId),
  ]
);

// ─── Points ledger ──────────────────────────────────────────────────
export const pointsLedger = pgTable(
  'points_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    referenceId: uuid('reference_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('points_ledger_user_id_idx').on(t.userId)]
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
