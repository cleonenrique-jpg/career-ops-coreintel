import PgBoss from 'pg-boss';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL required for queue');

export const boss = new PgBoss({
  connectionString,
  schema: process.env.JOBS_SCHEMA ?? 'pgboss',
  // Pin retention so failed jobs surface in evaluation_runs.error_message.
  retentionDays: 7,
});

export const QUEUES = {
  evaluate: 'evaluate-pipeline-url',
  pdfgen: 'generate-pdf',
  interviewPrep: 'generate-interview-prep',
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
  jd: string;
};
