import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db, profiles, cvs } from '@career-ops/db';
import { ProfileSchema } from '@career-ops/shared';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth, type AuthCtx } from '../lib/auth.js';

type Env = { Variables: { auth: AuthCtx } };

export const profileRoute = new Hono<Env>();
profileRoute.use('*', auth);

profileRoute.get('/', async (c) => {
  const { userId } = c.get('auth');
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  return c.json({ profile });
});

profileRoute.put('/', zValidator('json', ProfileSchema), async (c) => {
  const { userId } = c.get('auth');
  const data = c.req.valid('json');
  const [row] = await db.insert(profiles).values({
    userId,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone ?? null,
    location: data.location ?? null,
    timezone: data.timezone ?? null,
    linkedin: data.linkedin ?? null,
    portfolioUrl: data.portfolio_url ?? null,
    github: data.github ?? null,
    archetypes: data.archetypes,
    narrative: data.narrative ?? null,
    superpowers: data.superpowers,
    compTargetMin: data.comp_target_min ?? null,
    compTargetMax: data.comp_target_max ?? null,
    compCurrency: data.comp_currency,
    languageMode: data.language_mode,
  }).onConflictDoUpdate({
    target: profiles.userId,
    set: {
      fullName: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
      location: data.location ?? null,
      timezone: data.timezone ?? null,
      linkedin: data.linkedin ?? null,
      portfolioUrl: data.portfolio_url ?? null,
      github: data.github ?? null,
      archetypes: data.archetypes,
      narrative: data.narrative ?? null,
      superpowers: data.superpowers,
      compTargetMin: data.comp_target_min ?? null,
      compTargetMax: data.comp_target_max ?? null,
      compCurrency: data.comp_currency,
      languageMode: data.language_mode,
    },
  }).returning();
  return c.json({ profile: row });
});

// CV (active) ───────────────────────────────────────────────────────

profileRoute.get('/cv', async (c) => {
  const { userId } = c.get('auth');
  const [cv] = await db.select().from(cvs)
    .where(and(eq(cvs.userId, userId), eq(cvs.isActive, true)))
    .orderBy(desc(cvs.createdAt)).limit(1);
  return c.json({ cv });
});

const CvSchema = z.object({ content_md: z.string().min(50) });

profileRoute.put('/cv', zValidator('json', CvSchema), async (c) => {
  const { userId } = c.get('auth');
  const { content_md } = c.req.valid('json');

  await db.transaction(async (tx) => {
    await tx.update(cvs).set({ isActive: false }).where(eq(cvs.userId, userId));
    await tx.insert(cvs).values({ userId, contentMd: content_md, isActive: true, version: 1 });
  });

  const [cv] = await db.select().from(cvs)
    .where(and(eq(cvs.userId, userId), eq(cvs.isActive, true)))
    .orderBy(desc(cvs.createdAt)).limit(1);
  return c.json({ cv });
});
