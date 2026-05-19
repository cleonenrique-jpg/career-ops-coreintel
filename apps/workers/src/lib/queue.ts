import PgBoss from 'pg-boss';

// On Supabase free, direct connection (5432) requires IPv6. The pooler (6543)
// works over IPv4 but is transaction-mode, so we disable LISTEN/NOTIFY-based
// workers (`supervise: false`) and pg-boss falls back to polling.
const connectionString = process.env.DATABASE_URL_POOLER ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL or DATABASE_URL_POOLER required for queue');

export const boss = new PgBoss({
  connectionString,
  schema: process.env.JOBS_SCHEMA ?? 'pgboss',
  supervise: false,
  schedule: false,
  application_name: 'career-ops-workers',
});

export const QUEUES = {
  evaluate: 'evaluate-pipeline-url',
  pdfgen: 'generate-pdf',
  interviewPrep: 'generate-interview-prep',
  tailorCv: 'tailor-cv',
} as const;

export type EvaluateJobData = {
  userId: string;
  pipelineUrlId: string;
};

export type PdfgenJobData = {
  userId: string;
  applicationId: string;
};

export type InterviewPrepJobData = {
  userId: string;
  applicationId: string;
};

export type TailorCvJobData = {
  userId: string;
  applicationId: string;
};
