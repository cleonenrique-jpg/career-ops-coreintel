import PgBoss from 'pg-boss';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL required');

export const boss = new PgBoss({
  connectionString,
  schema: process.env.JOBS_SCHEMA ?? 'pgboss',
});

let started = false;
export async function ensureStarted() {
  if (!started) {
    await boss.start();
    started = true;
  }
}

export const QUEUES = {
  evaluate: 'evaluate-pipeline-url',
  pdfgen: 'generate-pdf',
  interviewPrep: 'generate-interview-prep',
} as const;
