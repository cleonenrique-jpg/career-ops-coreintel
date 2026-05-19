import PgBoss from 'pg-boss';

const connectionString = process.env.DATABASE_URL_POOLER ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL or DATABASE_URL_POOLER required');

export const boss = new PgBoss({
  connectionString,
  schema: process.env.JOBS_SCHEMA ?? 'pgboss',
  supervise: false,
  schedule: false,
  application_name: 'career-ops-api',
});

let started = false;
export async function ensureStarted() {
  if (!started) {
    await boss.start();
    // Idempotent: only create on first call.
    for (const q of Object.values(QUEUES)) {
      try { await boss.createQueue(q); } catch { /* already exists */ }
    }
    started = true;
  }
}

export const QUEUES = {
  evaluate: 'evaluate-pipeline-url',
  pdfgen: 'generate-pdf',
  interviewPrep: 'generate-interview-prep',
  tailorCv: 'tailor-cv',
} as const;
