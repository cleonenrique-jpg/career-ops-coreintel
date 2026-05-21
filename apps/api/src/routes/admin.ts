import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { db, profiles } from '@career-ops/db';
import { desc, eq } from 'drizzle-orm';
import { auth, requireAdmin, type AuthCtx } from '../lib/auth.js';

type Env = { Variables: { auth: AuthCtx } };

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });
  if (error || !data.user) {
    throw new HTTPException(400, { message: error?.message ?? 'invite failed' });
  }

  // The handle_new_user trigger creates the profile row as pending/member.
  // If the admin asked for a different role, update it now.
  if (role !== 'member') {
    await db.update(profiles).set({ role }).where(eq(profiles.userId, data.user.id));
  }

  return c.json({ userId: data.user.id, email: data.user.email });
});

adminRoute.patch('/users/:userId', zValidator('json', PatchSchema), async (c) => {
  const userId = c.req.param('userId');
  const patch = c.req.valid('json');
  const me = c.get('auth');

  // Guard: admins cannot demote or suspend themselves (avoid lockout).
  if (userId === me.userId) {
    if (patch.role && patch.role !== 'admin') {
      throw new HTTPException(400, { message: 'cannot remove your own admin role' });
    }
    if (patch.status && patch.status !== 'active') {
      throw new HTTPException(400, { message: 'cannot change your own active status' });
    }
  }

  const [row] = await db.update(profiles)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(profiles.userId, userId))
    .returning({
      userId: profiles.userId,
      email: profiles.email,
      role: profiles.role,
      status: profiles.status,
    });
  if (!row) throw new HTTPException(404, { message: 'user not found' });

  return c.json({ user: row });
});
