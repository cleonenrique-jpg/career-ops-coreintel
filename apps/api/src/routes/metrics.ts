import { Hono } from 'hono';
import { db, applications, pipelineUrls, evaluationRuns } from '@career-ops/db';
import { and, count, eq, sql } from 'drizzle-orm';
import { auth, type AuthCtx } from '../lib/auth.js';

type Env = { Variables: { auth: AuthCtx } };

export const metricsRoute = new Hono<Env>();
metricsRoute.use('*', auth);

metricsRoute.get('/funnel', async (c) => {
  const { userId } = c.get('auth');

  const [pending] = await db.select({ n: count() }).from(pipelineUrls)
    .where(and(eq(pipelineUrls.userId, userId), eq(pipelineUrls.status, 'pending')));

  const byStatus = await db.select({
    status: applications.status,
    n: count(),
  }).from(applications).where(eq(applications.userId, userId)).groupBy(applications.status);

  const totalCost = await db.select({
    sum: sql<string>`coalesce(sum(${evaluationRuns.costUsd}), 0)::text`,
  }).from(evaluationRuns).where(eq(evaluationRuns.userId, userId));

  return c.json({
    pending: pending?.n ?? 0,
    applications: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    cost_usd: Number(totalCost[0]?.sum ?? '0'),
  });
});
