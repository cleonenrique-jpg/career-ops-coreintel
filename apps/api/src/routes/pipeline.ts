import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, pipelineUrls } from '@career-ops/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { auth, type AuthCtx } from '../lib/auth.js';
import { boss, ensureStarted, QUEUES } from '../lib/queue.js';

type Env = { Variables: { auth: AuthCtx } };

export const pipelineRoute = new Hono<Env>();
pipelineRoute.use('*', auth);

pipelineRoute.get('/', async (c) => {
  const { userId } = c.get('auth');
  const status = c.req.query('status');
  const where = status
    ? and(eq(pipelineUrls.userId, userId), eq(pipelineUrls.status, status as 'pending'))
    : eq(pipelineUrls.userId, userId);
  const rows = await db.select().from(pipelineUrls).where(where).orderBy(desc(pipelineUrls.scannedAt));
  return c.json({ items: rows });
});

const AddSchema = z.object({
  url: z.string().url(),
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
});

pipelineRoute.post('/', zValidator('json', AddSchema), async (c) => {
  const { userId } = c.get('auth');
  const body = c.req.valid('json');
  const [row] = await db.insert(pipelineUrls).values({
    userId,
    url: body.url,
    company: body.company,
    title: body.title,
    status: 'pending',
    source: 'manual',
  }).onConflictDoNothing().returning();
  return c.json({ item: row });
});

const EvaluateSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(50) });

pipelineRoute.post('/evaluate', zValidator('json', EvaluateSchema), async (c) => {
  const { userId } = c.get('auth');
  const { ids } = c.req.valid('json');

  const rows = await db.select().from(pipelineUrls)
    .where(and(eq(pipelineUrls.userId, userId), inArray(pipelineUrls.id, ids)));

  await ensureStarted();
  const jobs = await Promise.all(rows.map((r) => boss.send(QUEUES.evaluate, { userId, pipelineUrlId: r.id })));

  return c.json({ enqueued: rows.length, jobIds: jobs });
});

pipelineRoute.delete('/:id', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const [row] = await db.update(pipelineUrls).set({ status: 'discarded' })
    .where(and(eq(pipelineUrls.id, id), eq(pipelineUrls.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json({ item: row });
});
