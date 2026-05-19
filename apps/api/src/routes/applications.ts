import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, applications, reports } from '@career-ops/db';
import { APPLICATION_STATUSES } from '@career-ops/shared';
import { and, desc, eq } from 'drizzle-orm';
import { auth, type AuthCtx } from '../lib/auth.js';

type Env = { Variables: { auth: AuthCtx } };

export const applicationsRoute = new Hono<Env>();
applicationsRoute.use('*', auth);

applicationsRoute.get('/', async (c) => {
  const { userId } = c.get('auth');
  const rows = await db.select().from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.date), desc(applications.num));
  return c.json({ applications: rows });
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
