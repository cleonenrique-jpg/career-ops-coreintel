// Onboarding self-serve: el usuario nuevo (status=pending) completa el wizard
// y su cuenta queda activa, con CV, perfil y portales sembrados + primer scan.

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, profiles, cvs, portalsConfig } from '@career-ops/db';
import { eq } from 'drizzle-orm';
import { parseCv } from '@career-ops/gemini';
import { authAllowPending, type AuthCtx } from '../lib/auth.js';
import { boss, ensureStarted, QUEUES, type ScanUserJobData } from '../lib/queue.js';

type Env = { Variables: { auth: AuthCtx } };

export const onboardingRoute = new Hono<Env>();
onboardingRoute.use('*', authAllowPending);

const ParseSchema = z.object({
  cvText: z.string().min(100, 'El CV es muy corto — pegá el texto completo').max(60_000),
});

onboardingRoute.post('/parse-cv', zValidator('json', ParseSchema), async (c) => {
  const me = c.get('auth');
  const { cvText } = c.req.valid('json');
  const parsed = await parseCv({ cvText, userId: me.userId });
  return c.json({ parsed });
});

const CompleteSchema = z.object({
  cvMarkdown: z.string().min(100),
  fullName: z.string().min(2).max(120),
  location: z.string().max(120).nullable().optional(),
  linkedin: z.string().max(300).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  targetRoles: z.array(z.string().min(2).max(80)).min(1).max(5),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'executive']).default('mid'),
  superpowers: z.array(z.string().max(200)).max(5).default([]),
  narrative: z.string().max(2000).nullable().optional(),
  compTargetMin: z.number().int().positive().nullable().optional(),
  compTargetMax: z.number().int().positive().nullable().optional(),
  compCurrency: z.string().max(8).default('USD'),
});

// Palabras que casi nunca quiere nadie que está definiendo roles objetivo concretos.
const DEFAULT_TITLE_NEGATIVE = ['pasante', 'practicante', 'becario', 'intern', 'voluntario'];

// Fuentes de listado que funcionan con queries por keyword (sin slug de empresa).
const LISTING_SOURCES = ['computrabajo', 'talent', 'linkedin'] as const;

onboardingRoute.post('/complete', zValidator('json', CompleteSchema), async (c) => {
  const me = c.get('auth');
  const body = c.req.valid('json');

  if (me.status === 'active') {
    return c.json({ ok: true, note: 'already active' });
  }

  // Keywords de título a partir de los roles objetivo (para los scrapers de listados).
  const titlePositive = Array.from(new Set(
    body.targetRoles.flatMap((r) => r.toLowerCase().split(/[\s/,-]+/).filter((w) => w.length > 3)),
  )).slice(0, 12);

  await db.transaction(async (tx) => {
    // 1. CV canónico (primera versión, activa).
    await tx.update(cvs).set({ isActive: false }).where(eq(cvs.userId, me.userId));
    await tx.insert(cvs).values({
      userId: me.userId,
      contentMd: body.cvMarkdown,
      version: 1,
      isActive: true,
    });

    // 2. Perfil + activación.
    await tx.update(profiles).set({
      fullName: body.fullName,
      location: body.location ?? null,
      linkedin: body.linkedin ?? null,
      phone: body.phone ?? null,
      archetypes: body.targetRoles.map((name, i) => ({
        name,
        level: body.seniority,
        fit: i === 0 ? 'primary' as const : 'secondary' as const,
      })),
      superpowers: body.superpowers,
      narrative: body.narrative ?? null,
      compTargetMin: body.compTargetMin ?? null,
      compTargetMax: body.compTargetMax ?? null,
      compCurrency: body.compCurrency,
      status: 'active',
      updatedAt: new Date(),
    }).where(eq(profiles.userId, me.userId));

    // 3. Seed de portales de listado con las queries del usuario (idempotente:
    //    solo si aún no tiene portales configurados).
    const existing = await tx.select({ id: portalsConfig.id })
      .from(portalsConfig).where(eq(portalsConfig.userId, me.userId)).limit(1);
    if (existing.length === 0) {
      for (const source of LISTING_SOURCES) {
        await tx.insert(portalsConfig).values({
          userId: me.userId,
          source,
          queries: body.targetRoles,
          titlePositive,
          titleNegative: DEFAULT_TITLE_NEGATIVE,
          enabled: true,
        });
      }
    }
  });

  // 4. Primer scan inmediato (aha moment) — best effort, no bloquea la activación.
  try {
    await ensureStarted();
    await boss.send(QUEUES.scanUser, { userId: me.userId } satisfies ScanUserJobData);
  } catch (err) {
    console.error('[onboarding] no se pudo encolar el primer scan:', err instanceof Error ? err.message : err);
  }

  return c.json({ ok: true });
});
