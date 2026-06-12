import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, feedback } from '@career-ops/db';
import { desc, eq } from 'drizzle-orm';
import { auth, type AuthCtx } from '../lib/auth.js';

type Env = { Variables: { auth: AuthCtx } };

const CreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  type: z.enum(['error', 'sugerencia', 'funcion_faltante', 'comentario_general']),
  description: z.string().min(1).max(5000),
  screenshotPath: z.string().max(500).optional().nullable(),
  wouldRecommend: z.boolean().optional().nullable(),
});

export const feedbackRoute = new Hono<Env>();
feedbackRoute.use('*', auth);

// Cliente envía una sugerencia / reporte.
feedbackRoute.post('/', zValidator('json', CreateSchema), async (c) => {
  const me = c.get('auth');
  const body = c.req.valid('json');
  const [row] = await db.insert(feedback).values({
    userId: me.userId,
    userEmail: me.email,
    rating: body.rating,
    type: body.type,
    description: body.description,
    screenshotPath: body.screenshotPath ?? null,
    wouldRecommend: body.wouldRecommend ?? null,
  }).returning({ id: feedback.id, createdAt: feedback.createdAt });
  return c.json({ feedback: row }, 201);
});

// El cliente puede revisar su propio historial.
feedbackRoute.get('/mine', async (c) => {
  const me = c.get('auth');
  const rows = await db.select().from(feedback)
    .where(eq(feedback.userId, me.userId))
    .orderBy(desc(feedback.createdAt));
  return c.json({ feedback: rows });
});
