import { Hono } from 'hono';
import { db, portalsConfig } from '@career-ops/db';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { SCAN_SOURCES } from '@career-ops/shared';
import { auth, type AuthCtx } from '../lib/auth.js';
import { boss, ensureStarted, QUEUES, type ScanUserJobData } from '../lib/queue.js';

type Env = { Variables: { auth: AuthCtx } };

export const scanRoute = new Hono<Env>();
scanRoute.use('*', auth);

scanRoute.get('/portals', async (c) => {
  const { userId } = c.get('auth');
  const rows = await db.select().from(portalsConfig).where(eq(portalsConfig.userId, userId));
  return c.json({ portals: rows });
});

const PortalSchema = z.object({
  source: z.enum(SCAN_SOURCES),
  company_slug: z.string().nullable().optional(),
  company_name: z.string().nullable().optional(),
  api_url: z.string().url().nullable().optional(),
  careers_url: z.string().url().nullable().optional(),
  queries: z.array(z.string()).default([]),
  title_positive: z.array(z.string()).default([]),
  title_negative: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});

scanRoute.post('/portals', zValidator('json', PortalSchema), async (c) => {
  const { userId } = c.get('auth');
  const p = c.req.valid('json');
  const [row] = await db.insert(portalsConfig).values({
    userId,
    source: p.source,
    companySlug: p.company_slug ?? null,
    companyName: p.company_name ?? null,
    apiUrl: p.api_url ?? null,
    careersUrl: p.careers_url ?? null,
    queries: p.queries,
    titlePositive: p.title_positive,
    titleNegative: p.title_negative,
    enabled: p.enabled,
  }).returning();
  return c.json({ portal: row });
});

scanRoute.delete('/portals/:id', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const [row] = await db.delete(portalsConfig)
    .where(and(eq(portalsConfig.id, id), eq(portalsConfig.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

// Dispara un scan para el usuario actual (lo consume el worker-scheduler vía
// el queue scan-user). Throttle: como máximo un scan por usuario por hora
// (singletonKey + singletonSeconds), así llamarlo en cada login no spamea.
scanRoute.post('/run', async (c) => {
  const { userId } = c.get('auth');
  try {
    await ensureStarted();
    await boss.send(QUEUES.scanUser, { userId } satisfies ScanUserJobData, {
      singletonKey: userId,
      singletonSeconds: 3600,
    });
    return c.json({ accepted: true });
  } catch (err) {
    console.error('[scan/run] enqueue falló:', err instanceof Error ? err.message : err);
    return c.json({ accepted: false }, 500);
  }
});
