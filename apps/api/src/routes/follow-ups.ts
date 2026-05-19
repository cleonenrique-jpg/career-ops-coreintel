import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, applications, followUps } from '@career-ops/db';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { auth, type AuthCtx } from '../lib/auth.js';

type Env = { Variables: { auth: AuthCtx } };

export const followUpsRoute = new Hono<Env>();
followUpsRoute.use('*', auth);

// Statuses that warrant a follow-up if they sit too long
const TRACKED_STATUSES: Array<'Applied' | 'Responded'> = ['Applied', 'Responded'];
const APPLIED_THRESHOLD_DAYS = 7;
const RESPONDED_THRESHOLD_DAYS = 14;

/**
 * GET /api/follow-ups
 * Returns apps in Applied/Responded that haven't moved in N days AND don't have
 * a follow-up logged within that same window. The list is the "to-do" surface.
 */
followUpsRoute.get('/', async (c) => {
  const { userId } = c.get('auth');

  // Fetch all candidate apps
  const apps = await db.select().from(applications)
    .where(and(
      eq(applications.userId, userId),
      inArray(applications.status, TRACKED_STATUSES),
    ));

  if (apps.length === 0) return c.json({ followUps: [] });

  // Fetch the most-recent follow-up per application
  const appIds = apps.map((a) => a.id);
  const recentFollowUps = await db.select({
    applicationId: followUps.applicationId,
    lastSentAt: sql<Date>`max(${followUps.sentAt})`.as('last_sent_at'),
  })
    .from(followUps)
    .where(and(eq(followUps.userId, userId), inArray(followUps.applicationId, appIds)))
    .groupBy(followUps.applicationId);
  const lastFollowUpByApp = new Map(recentFollowUps.map((r) => [r.applicationId, new Date(r.lastSentAt as unknown as string)]));

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const pending = apps
    .map((a) => {
      const threshold = a.status === 'Responded' ? RESPONDED_THRESHOLD_DAYS : APPLIED_THRESHOLD_DAYS;
      const updatedAt = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const lastFu = lastFollowUpByApp.get(a.id)?.getTime() ?? 0;
      const referenceAt = Math.max(updatedAt, lastFu);
      const daysSince = Math.floor((now - referenceAt) / dayMs);
      const isOverdue = daysSince >= threshold;
      return {
        applicationId: a.id,
        num: a.num,
        company: a.company,
        role: a.role,
        status: a.status,
        score: a.score,
        url: a.url,
        daysSinceMovement: daysSince,
        threshold,
        isOverdue,
        lastFollowUpAt: lastFollowUpByApp.get(a.id)?.toISOString() ?? null,
      };
    })
    .filter((row) => row.isOverdue)
    .sort((a, b) => b.daysSinceMovement - a.daysSinceMovement);

  return c.json({ followUps: pending });
});

const LogSchema = z.object({
  kind: z.enum(['check-in', 'thank-you', 'nudge']).default('check-in'),
  channel: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/follow-ups/:applicationId
 * Logs that the user sent a follow-up. Used by the dashboard 'Marcar como enviado' button.
 */
followUpsRoute.post('/:applicationId', zValidator('json', LogSchema), async (c) => {
  const { userId } = c.get('auth');
  const applicationId = c.req.param('applicationId');
  const body = c.req.valid('json');

  const [app] = await db.select().from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
  if (!app) return c.json({ error: 'not_found' }, 404);

  const [row] = await db.insert(followUps).values({
    userId,
    applicationId,
    kind: body.kind,
    sentAt: new Date(),
    channel: body.channel,
    notes: body.notes,
  }).returning();

  return c.json({ followUp: row });
});

/**
 * GET /api/follow-ups/:applicationId/history — list all follow-ups for one app.
 */
followUpsRoute.get('/:applicationId/history', async (c) => {
  const { userId } = c.get('auth');
  const applicationId = c.req.param('applicationId');
  const rows = await db.select().from(followUps)
    .where(and(eq(followUps.applicationId, applicationId), eq(followUps.userId, userId)))
    .orderBy(desc(followUps.sentAt));
  return c.json({ history: rows });
});
