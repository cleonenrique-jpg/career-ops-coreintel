import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, usageEvents } from '@career-ops/db';
import { auth, type AuthCtx } from '../lib/auth.js';

type Env = { Variables: { auth: AuthCtx } };

const Schema = z.object({
  event: z.string().min(1).max(64),
  path: z.string().max(300).optional().nullable(),
});

export const eventsRoute = new Hono<Env>();
eventsRoute.use('*', auth);

// Registra un evento de uso (app_open, login, etc.) para las métricas de adopción.
eventsRoute.post('/', zValidator('json', Schema), async (c) => {
  const me = c.get('auth');
  const { event, path } = c.req.valid('json');
  await db.insert(usageEvents).values({ userId: me.userId, event, path: path ?? null });
  return c.json({ ok: true });
});
