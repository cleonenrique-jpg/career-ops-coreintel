import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { db, profiles, adminAuditLog, feedback, cvs, usageEvents } from '@career-ops/db';
import { desc, eq, and, gte, count, countDistinct, sql } from 'drizzle-orm';
import { auth, requireAdmin, type AuthCtx } from '../lib/auth.js';

type Env = { Variables: { auth: AuthCtx } };

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type AdminAction = 'invite' | 'approve' | 'suspend' | 'reactivate' | 'role_change' | 'delete';

async function logAction(input: {
  actor: AuthCtx;
  action: AdminAction;
  targetUserId: string | null;
  targetEmail: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(adminAuditLog).values({
    actorId: input.actor.userId,
    actorEmail: input.actor.email,
    action: input.action,
    targetUserId: input.targetUserId,
    targetEmail: input.targetEmail,
    metadata: input.metadata ?? {},
  });
}

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

const PatchSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended']).optional(),
  role: z.enum(['admin', 'member']).optional(),
}).refine((d) => d.status !== undefined || d.role !== undefined, {
  message: 'must provide at least one of status or role',
});

const FeedbackPatchSchema = z.object({
  category: z.enum(['bug', 'ux', 'nueva_funcionalidad', 'rendimiento', 'contenido', 'monetizacion']).nullable().optional(),
  priority: z.enum(['baja', 'media', 'alta', 'critica']).nullable().optional(),
  status: z.enum(['nuevo', 'en_revision', 'planificado', 'en_progreso', 'resuelto', 'descartado']).optional(),
  adminNotes: z.string().max(5000).nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'sin cambios' });

export const adminRoute = new Hono<Env>();
adminRoute.use('*', auth, requireAdmin);

adminRoute.get('/users', async (c) => {
  const rows = await db.select({
    userId: profiles.userId,
    email: profiles.email,
    fullName: profiles.fullName,
    role: profiles.role,
    status: profiles.status,
    createdAt: profiles.createdAt,
    updatedAt: profiles.updatedAt,
  }).from(profiles).orderBy(desc(profiles.createdAt));
  return c.json({ users: rows });
});

adminRoute.post('/users/invite', zValidator('json', InviteSchema), async (c) => {
  const { email, role } = c.req.valid('json');
  const origin = c.req.header('origin') ?? process.env.WEB_URL ?? 'http://localhost:3000';
  const me = c.get('auth');

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });
  if (error || !data.user) {
    throw new HTTPException(400, { message: error?.message ?? 'invite failed' });
  }

  if (role !== 'member') {
    await db.update(profiles).set({ role }).where(eq(profiles.userId, data.user.id));
  }

  await logAction({
    actor: me,
    action: 'invite',
    targetUserId: data.user.id,
    targetEmail: data.user.email ?? email,
    metadata: { role },
  });

  return c.json({ userId: data.user.id, email: data.user.email });
});

adminRoute.patch('/users/:userId', zValidator('json', PatchSchema), async (c) => {
  const userId = c.req.param('userId');
  const patch = c.req.valid('json');
  const me = c.get('auth');

  if (userId === me.userId) {
    if (patch.role && patch.role !== 'admin') {
      throw new HTTPException(400, { message: 'cannot remove your own admin role' });
    }
    if (patch.status && patch.status !== 'active') {
      throw new HTTPException(400, { message: 'cannot change your own active status' });
    }
  }

  // Fetch existing row to determine which audit action(s) to record.
  const [existing] = await db.select({
    email: profiles.email,
    role: profiles.role,
    status: profiles.status,
  }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!existing) throw new HTTPException(404, { message: 'user not found' });

  const [row] = await db.update(profiles)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(profiles.userId, userId))
    .returning({
      userId: profiles.userId,
      email: profiles.email,
      role: profiles.role,
      status: profiles.status,
    });

  if (patch.status && patch.status !== existing.status) {
    let action: AdminAction;
    if (patch.status === 'suspended') action = 'suspend';
    else if (patch.status === 'active' && existing.status === 'suspended') action = 'reactivate';
    else if (patch.status === 'active' && existing.status === 'pending') action = 'approve';
    else action = 'approve';

    await logAction({
      actor: me,
      action,
      targetUserId: userId,
      targetEmail: existing.email,
      metadata: { from_status: existing.status, to_status: patch.status },
    });
  }

  if (patch.role && patch.role !== existing.role) {
    await logAction({
      actor: me,
      action: 'role_change',
      targetUserId: userId,
      targetEmail: existing.email,
      metadata: { from_role: existing.role, to_role: patch.role },
    });
  }

  return c.json({ user: row });
});

// Elimina un usuario y TODOS sus datos. Las tablas tienen user_id ON DELETE
// CASCADE, así que borrar el usuario de Auth arrastra applications, cvs,
// pipeline, reports, feedback, usage_events, profile, etc.
adminRoute.delete('/users/:userId', async (c) => {
  const userId = c.req.param('userId');
  const me = c.get('auth');
  if (userId === me.userId) throw new HTTPException(400, { message: 'no podés eliminar tu propia cuenta' });

  const [existing] = await db.select({ email: profiles.email })
    .from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!existing) throw new HTTPException(404, { message: 'user not found' });

  // Auditar ANTES de borrar (mientras el userId todavía existe como FK válida).
  await logAction({ actor: me, action: 'delete', targetUserId: userId, targetEmail: existing.email });

  // Limpiar archivos del usuario en storage (best-effort).
  const bucket = process.env.STORAGE_BUCKET ?? 'career-ops';
  try {
    for (const prefix of [userId, `${userId}/feedback`]) {
      const { data: files } = await supabaseAdmin.storage.from(bucket).list(prefix);
      if (files && files.length) {
        await supabaseAdmin.storage.from(bucket).remove(files.map((f) => `${prefix}/${f.name}`));
      }
    }
  } catch (err) {
    console.error('[admin] storage cleanup falló:', err instanceof Error ? err.message : err);
  }

  // Borrar de Auth → cascada a todas las tablas (user_id ON DELETE CASCADE).
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({ ok: true });
});

adminRoute.get('/audit-log', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const rows = await db.select({
    id: adminAuditLog.id,
    actorId: adminAuditLog.actorId,
    actorEmail: adminAuditLog.actorEmail,
    action: adminAuditLog.action,
    targetUserId: adminAuditLog.targetUserId,
    targetEmail: adminAuditLog.targetEmail,
    metadata: adminAuditLog.metadata,
    createdAt: adminAuditLog.createdAt,
  }).from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit);
  return c.json({ entries: rows });
});

// ── Feedback: gestión y clasificación ────────────────────────────────

adminRoute.get('/feedback', async (c) => {
  const status = c.req.query('status');
  const category = c.req.query('category');
  const conds = [];
  if (status) conds.push(eq(feedback.status, status as never));
  if (category) conds.push(eq(feedback.category, category as never));
  const rows = await db.select().from(feedback)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(feedback.createdAt))
    .limit(500);
  return c.json({ feedback: rows });
});

adminRoute.patch('/feedback/:id', zValidator('json', FeedbackPatchSchema), async (c) => {
  const id = c.req.param('id');
  const patch = c.req.valid('json');
  const [row] = await db.update(feedback)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(feedback.id, id))
    .returning();
  if (!row) throw new HTTPException(404, { message: 'feedback not found' });
  return c.json({ feedback: row });
});

// Firma temporal de la captura (bucket privado) para que el admin pueda verla.
adminRoute.get('/feedback/:id/screenshot', async (c) => {
  const id = c.req.param('id');
  const [row] = await db.select({ path: feedback.screenshotPath })
    .from(feedback).where(eq(feedback.id, id)).limit(1);
  if (!row?.path) throw new HTTPException(404, { message: 'sin captura' });
  const bucket = process.env.STORAGE_BUCKET ?? 'career-ops';
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(row.path, 300);
  if (error || !data) throw new HTTPException(500, { message: error?.message ?? 'no se pudo firmar la URL' });
  return c.json({ url: data.signedUrl });
});

// ── Métricas KPI de adopción / retención / uso (solo clientes: role=member) ──

adminRoute.get('/metrics', async (c) => {
  const member = eq(profiles.role, 'member');

  const [tot] = await db.select({ n: count() }).from(profiles).where(member);
  const total = Number(tot?.n ?? 0);

  const [act] = await db.select({ n: count() }).from(profiles)
    .where(and(member, eq(profiles.status, 'active')));

  const [cvU] = await db.select({ n: countDistinct(cvs.userId) }).from(cvs)
    .innerJoin(profiles, eq(profiles.userId, cvs.userId)).where(member);

  const [fbU] = await db.select({ n: countDistinct(feedback.userId) }).from(feedback)
    .innerJoin(profiles, eq(profiles.userId, feedback.userId)).where(member);

  const [rec] = await db.select({
    responders: sql<number>`count(*) filter (where ${feedback.wouldRecommend} is not null)`,
    promoters: sql<number>`count(*) filter (where ${feedback.wouldRecommend} = true)`,
  }).from(feedback).innerJoin(profiles, eq(profiles.userId, feedback.userId)).where(member);

  const [weekly] = await db.select({ n: countDistinct(usageEvents.userId) }).from(usageEvents)
    .innerJoin(profiles, eq(profiles.userId, usageEvents.userId))
    .where(and(member, gte(usageEvents.createdAt, sql`now() - interval '7 days'`)));

  const [ret] = await db.select({ n: countDistinct(usageEvents.userId) }).from(usageEvents)
    .innerJoin(profiles, eq(profiles.userId, usageEvents.userId))
    .where(and(member, sql`${usageEvents.createdAt} >= ${profiles.createdAt} + interval '3 days'`));

  const pct = (x: number) => (total > 0 ? Math.round((x / total) * 100) : 0);
  const responders = Number(rec?.responders ?? 0);
  const promoters = Number(rec?.promoters ?? 0);
  const recPct = responders > 0 ? Math.round((promoters / responders) * 100) : 0;

  const kpis = [
    { key: 'registro_completado', label: 'Registro completado', value: pct(Number(act?.n ?? 0)), target: 80, detail: `${Number(act?.n ?? 0)}/${total} activos` },
    { key: 'cv_subido',           label: 'CV subido',           value: pct(Number(cvU?.n ?? 0)), target: 70, detail: `${Number(cvU?.n ?? 0)}/${total}` },
    { key: 'retencion_3d',        label: 'Retención 3 días',    value: pct(Number(ret?.n ?? 0)), target: 50, detail: `${Number(ret?.n ?? 0)}/${total}` },
    { key: 'feedback_enviado',    label: 'Feedback enviado',    value: pct(Number(fbU?.n ?? 0)), target: 60, detail: `${Number(fbU?.n ?? 0)}/${total}` },
    { key: 'recomendacion',       label: 'Recomendación a otros', value: recPct,                 target: 70, detail: `${promoters}/${responders} respuestas` },
    { key: 'uso_semanal',         label: 'Uso semanal',         value: pct(Number(weekly?.n ?? 0)), target: 60, detail: `${Number(weekly?.n ?? 0)}/${total}` },
  ].map((k) => ({ ...k, ok: k.value >= k.target }));

  return c.json({ totalMembers: total, kpis });
});
