import {
  pgTable, pgSchema, uuid, text, integer, numeric, boolean, timestamp,
  jsonb, pgEnum, uniqueIndex, index, primaryKey,
} from 'drizzle-orm/pg-core';

// Reference Supabase's auth.users — we do not own it, just FK to it.
const authSchema = pgSchema('auth');
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
});

// ── Enums (mirror packages/shared/src/states.ts) ─────────────────────

export const applicationStatusEnum = pgEnum('application_status', [
  'Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP',
]);

export const pipelineStatusEnum = pgEnum('pipeline_url_status', [
  'pending', 'processed', 'discarded', 'expired',
]);

export const livenessEnum = pgEnum('liveness_result', ['active', 'expired', 'uncertain']);

export const scanSourceEnum = pgEnum('scan_source', [
  'greenhouse', 'ashby', 'lever', 'linkedin', 'computrabajo', 'talent', 'tecoloco', 'procomer', 'cinde', 'manual',
]);

export const languageEnum = pgEnum('language_mode', ['en', 'es', 'de', 'fr', 'ja']);

export const jobStateEnum = pgEnum('job_state', [
  'pending', 'in_progress', 'completed', 'failed', 'cancelled',
]);

// ── Tables ───────────────────────────────────────────────────────────

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  location: text('location'),
  timezone: text('timezone'),
  linkedin: text('linkedin'),
  portfolioUrl: text('portfolio_url'),
  github: text('github'),
  archetypes: jsonb('archetypes').$type<Array<{ name: string; level: string; fit: 'primary' | 'secondary' | 'adjacent' }>>().notNull().default([]),
  narrative: text('narrative'),
  superpowers: jsonb('superpowers').$type<string[]>().notNull().default([]),
  compTargetMin: integer('comp_target_min'),
  compTargetMax: integer('comp_target_max'),
  compCurrency: text('comp_currency').notNull().default('USD'),
  languageMode: languageEnum('language_mode').notNull().default('es'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cvs = pgTable('cvs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  contentMd: text('content_md').notNull(),
  version: integer('version').notNull().default(1),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userActiveIdx: index('cvs_user_active_idx').on(t.userId, t.isActive),
}));

export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  num: integer('num').notNull(),
  date: text('date').notNull(), // ISO YYYY-MM-DD
  company: text('company').notNull(),
  role: text('role').notNull(),
  score: numeric('score', { precision: 2, scale: 1 }),
  status: applicationStatusEnum('status').notNull().default('Evaluated'),
  pdfUrl: text('pdf_url'),
  url: text('url'), // source URL of the listing (for traceability)
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userNumUnq: uniqueIndex('applications_user_num_unq').on(t.userId, t.num),
  userStatusIdx: index('applications_user_status_idx').on(t.userId, t.status),
}));

export const pipelineUrls = pgTable('pipeline_urls', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  company: text('company'),
  title: text('title'),
  status: pipelineStatusEnum('status').notNull().default('pending'),
  scannedAt: timestamp('scanned_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  applicationId: uuid('application_id').references(() => applications.id, { onDelete: 'set null' }),
  source: scanSourceEnum('source'),
}, (t) => ({
  userUrlUnq: uniqueIndex('pipeline_user_url_unq').on(t.userId, t.url),
  userStatusIdx: index('pipeline_user_status_idx').on(t.userId, t.status),
}));

export const scanHistory = pgTable('scan_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  company: text('company'),
  title: text('title'),
  location: text('location'),
  source: scanSourceEnum('source').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userUrlUnq: uniqueIndex('scan_history_user_url_unq').on(t.userId, t.url),
}));

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  applicationId: uuid('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  num: integer('num').notNull(),
  contentMd: text('content_md').notNull(),
  verification: livenessEnum('verification').notNull().default('uncertain'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  appIdx: index('reports_app_idx').on(t.applicationId),
}));

export const interviewPrep = pgTable('interview_prep', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  applicationId: uuid('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  contentMd: text('content_md').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const storyBank = pgTable('story_bank', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  situation: text('situation'),
  task: text('task'),
  action: text('action'),
  result: text('result'),
  reflection: text('reflection'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const followUps = pgTable('follow_ups', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  applicationId: uuid('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // e.g. 'check-in', 'thank-you', 'nudge'
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  responseAt: timestamp('response_at', { withTimezone: true }),
  channel: text('channel'), // email, linkedin, etc.
  notes: text('notes'),
});

export const portalsConfig = pgTable('portals_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  source: scanSourceEnum('source').notNull(),
  companySlug: text('company_slug'),
  companyName: text('company_name'),
  apiUrl: text('api_url'),
  careersUrl: text('careers_url'),
  queries: jsonb('queries').$type<string[]>().notNull().default([]),
  titlePositive: jsonb('title_positive').$type<string[]>().notNull().default([]),
  titleNegative: jsonb('title_negative').$type<string[]>().notNull().default([]),
  locationFilter: jsonb('location_filter').$type<{ include?: string[]; exclude?: string[] } | null>(),
  enabled: boolean('enabled').notNull().default(true),
}, (t) => ({
  userSourceIdx: index('portals_user_source_idx').on(t.userId, t.source),
}));

export const evaluationRuns = pgTable('evaluation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  pipelineUrlId: uuid('pipeline_url_id').references(() => pipelineUrls.id, { onDelete: 'set null' }),
  applicationId: uuid('application_id').references(() => applications.id, { onDelete: 'set null' }),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
  success: boolean('success').notNull().default(true),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('eval_runs_user_idx').on(t.userId, t.createdAt),
}));
