import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, applications, reports, interviewPrep, cvTailored } from '@career-ops/db';
import { APPLICATION_STATUSES } from '@career-ops/shared';
import { and, desc, eq } from 'drizzle-orm';
import { auth, type AuthCtx } from '../lib/auth.js';
import { boss, ensureStarted, QUEUES } from '../lib/queue.js';

type Env = { Variables: { auth: AuthCtx } };

export const applicationsRoute = new Hono<Env>();
applicationsRoute.use('*', auth);

applicationsRoute.get('/', async (c) => {
  const { userId } = c.get('auth');
  const rows = await db.select().from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.date), desc(applications.num));

  // Attach the latest cv_tailored.file_url + coverage per application.
  const cvs = await db.select({
    applicationId: cvTailored.applicationId,
    fileUrl: cvTailored.fileUrl,
    keywordCoverage: cvTailored.keywordCoverage,
    generatedAt: cvTailored.generatedAt,
  }).from(cvTailored)
    .where(eq(cvTailored.userId, userId))
    .orderBy(desc(cvTailored.generatedAt));

  const latestCvByApp = new Map<string, { fileUrl: string | null; keywordCoverage: string | null }>();
  for (const cv of cvs) {
    if (!latestCvByApp.has(cv.applicationId)) {
      latestCvByApp.set(cv.applicationId, { fileUrl: cv.fileUrl, keywordCoverage: cv.keywordCoverage });
    }
  }

  const enriched = rows.map((r) => {
    const cv = latestCvByApp.get(r.id);
    return {
      ...r,
      cvTailoredUrl: cv?.fileUrl ?? null,
      cvTailoredCoverage: cv?.keywordCoverage ?? null,
    };
  });
  return c.json({ applications: enriched });
});

applicationsRoute.get('/:id', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const [app] = await db.select().from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));
  if (!app) return c.json({ error: 'not_found' }, 404);
  const [report] = await db.select().from(reports)
    .where(and(eq(reports.applicationId, id), eq(reports.userId, userId)))
    .orderBy(desc(reports.generatedAt)).limit(1);
  return c.json({ application: app, report });
});

const PatchSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  notes: z.string().optional(),
});

applicationsRoute.patch('/:id', zValidator('json', PatchSchema), async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const [updated] = await db.update(applications).set(data)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();
  if (!updated) return c.json({ error: 'not_found' }, 404);
  return c.json({ application: updated });
});

applicationsRoute.get('/:id/prep', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const [prep] = await db.select().from(interviewPrep)
    .where(and(eq(interviewPrep.applicationId, id), eq(interviewPrep.userId, userId)))
    .orderBy(desc(interviewPrep.generatedAt)).limit(1);
  return c.json({ prep: prep ?? null });
});

applicationsRoute.post('/:id/prep', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const [app] = await db.select().from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));
  if (!app) return c.json({ error: 'not_found' }, 404);
  if (!app.url) return c.json({ error: 'application has no url — cannot fetch JD' }, 400);

  await ensureStarted();
  const jobId = await boss.send(QUEUES.interviewPrep, { userId, applicationId: id });
  return c.json({ enqueued: true, jobId });
});

applicationsRoute.get('/:id/cv-tailored', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const [cv] = await db.select().from(cvTailored)
    .where(and(eq(cvTailored.applicationId, id), eq(cvTailored.userId, userId)))
    .orderBy(desc(cvTailored.generatedAt)).limit(1);
  return c.json({ cv: cv ?? null });
});

applicationsRoute.post('/:id/cv-tailored', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const [app] = await db.select().from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));
  if (!app) return c.json({ error: 'not_found' }, 404);
  if (!app.url) return c.json({ error: 'application has no url — cannot fetch JD' }, 400);

  await ensureStarted();
  const jobId = await boss.send(QUEUES.tailorCv, { userId, applicationId: id });
  return c.json({ enqueued: true, jobId });
});
