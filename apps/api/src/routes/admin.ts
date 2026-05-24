import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { db, profiles, adminAuditLog } from '@career-ops/db';
import { desc, eq } from 'drizzle-orm';
import { auth, requireAdmin, type AuthCtx } from '../lib/auth.js';

type Env = { Variables: { auth: AuthCtx } };

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type AdminAction = 'invite' | 'approve' | 'suspend' | 'reactivate' | 'role_change';

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
