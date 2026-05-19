// Long-running queue consumer — for each pipeline_urls row marked pending,
// fetch JD, call Gemini evaluateOffer, persist application + report, enqueue PDF.

import { boss, QUEUES, type EvaluateJobData, type PdfgenJobData } from './lib/queue.js';
import { fetchJd, shutdownBrowser } from './lib/fetchJd.js';
import {
  db, applications, pipelineUrls, reports, profiles, cvs,
} from '@career-ops/db';
import { evaluateOffer, renderOfferReport } from '@career-ops/gemini';
import { and, desc, eq, max } from 'drizzle-orm';

async function nextApplicationNum(userId: string): Promise<number> {
  const [row] = await db
    .select({ max: max(applications.num) })
    .from(applications)
    .where(eq(applications.userId, userId));
  return (row?.max ?? 0) + 1;
}

async function handleEvaluate(jobs: Array<{ data: EvaluateJobData }>) {
  for (const job of jobs) {
    await handleOne(job.data);
  }
}

async function handleOne(data: EvaluateJobData) {
  const { userId, pipelineUrlId } = data;

  const [pu] = await db.select().from(pipelineUrls)
    .where(and(eq(pipelineUrls.id, pipelineUrlId), eq(pipelineUrls.userId, userId)));
  if (!pu) throw new Error(`pipeline_url ${pipelineUrlId} not found`);
  if (pu.status !== 'pending') {
    console.log(`[evaluator] skip ${pipelineUrlId} (status=${pu.status})`);
    return;
  }

  const userProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!userProfile) throw new Error(`profile not found for user ${userId}`);

  const [activeCv] = await db.select().from(cvs)
    .where(and(eq(cvs.userId, userId), eq(cvs.isActive, true)))
    .orderBy(desc(cvs.createdAt)).limit(1);
  if (!activeCv) throw new Error(`no active CV for user ${userId}`);

  const fetched = await fetchJd(pu.url);
  if (fetched.liveness.result === 'expired') {
    await db.update(pipelineUrls).set({ status: 'expired', processedAt: new Date() }).where(eq(pipelineUrls.id, pipelineUrlId));
    console.log(`[evaluator] expired ${pu.url} — ${fetched.liveness.reason}`);
    return;
  }

  const company = pu.company ?? 'Unknown';
  const role = pu.title ?? 'Unknown role';

  const { data: evalResult } = await evaluateOffer({
    jd: fetched.jd,
    jdUrl: pu.url,
    company,
    role,
    cvMd: activeCv.contentMd,
    profileNarrative: userProfile.narrative ?? '',
    archetypes: userProfile.archetypes,
    userId,
    pipelineUrlId,
  });

  const num = await nextApplicationNum(userId);
  const date = new Date().toISOString().slice(0, 10);

  const decisionStatus = evalResult.blockC.decision === 'discard' ? 'SKIP' : 'Evaluated';

  const [app] = await db.insert(applications).values({
    userId,
    num,
    date,
    company,
    role,
    score: evalResult.blockC.score.toFixed(1),
    status: decisionStatus,
    url: pu.url,
    notes: evalResult.blockC.reason,
  }).returning();

  if (!app) throw new Error('failed to insert application');

  const reportMd = renderOfferReport({
    company, role, url: pu.url, date, eval: evalResult,
  });

  await db.insert(reports).values({
    userId,
    applicationId: app.id,
    num,
    contentMd: reportMd,
    verification: fetched.liveness.result,
  });

  await db.update(pipelineUrls).set({
    status: 'processed',
    processedAt: new Date(),
    applicationId: app.id,
  }).where(eq(pipelineUrls.id, pipelineUrlId));

  if (evalResult.blockC.decision === 'apply') {
    await boss.send(QUEUES.pdfgen, { userId, applicationId: app.id } satisfies PdfgenJobData);
  }

  console.log(`[evaluator] ${company} | ${role} → score=${evalResult.blockC.score} decision=${evalResult.blockC.decision}`);
}

async function main() {
  await boss.start();
  // pg-boss v10+ requires explicit queue creation before send/work.
  await boss.createQueue(QUEUES.evaluate);
  await boss.createQueue(QUEUES.pdfgen);
  await boss.work<EvaluateJobData>(QUEUES.evaluate, { teamSize: 2 }, handleEvaluate);
  console.log('[evaluator] ready, listening on', QUEUES.evaluate);
}

process.on('SIGTERM', async () => { await boss.stop(); await shutdownBrowser(); process.exit(0); });
process.on('SIGINT',  async () => { await boss.stop(); await shutdownBrowser(); process.exit(0); });

main().catch((err) => { console.error('[evaluator] fatal:', err); process.exit(1); });
