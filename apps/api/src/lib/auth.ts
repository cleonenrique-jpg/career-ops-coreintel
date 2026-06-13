import { createMiddleware } from 'hono/factory';
import { createClient } from '@supabase/supabase-js';
import { HTTPException } from 'hono/http-exception';
import { db, profiles } from '@career-ops/db';
import { eq } from 'drizzle-orm';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseAnon = process.env.SUPABASE_ANON_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: { persistSession: false },
});

export type AuthCtx = {
  userId: string;
  email: string;
  role: 'admin' | 'member';
  status: 'pending' | 'active' | 'suspended';
};

export const auth = createMiddleware<{ Variables: { auth: AuthCtx } }>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'missing bearer token' });
  }
  const token = header.slice('Bearer '.length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HTTPException(401, { message: 'invalid token' });

  const [profile] = await db.select({
    role: profiles.role,
    status: profiles.status,
  }).from(profiles).where(eq(profiles.userId, data.user.id)).limit(1);

  if (!profile) throw new HTTPException(403, { message: 'profile not found' });
  if (profile.status === 'pending') throw new HTTPException(403, { message: 'account pending approval' });
  if (profile.status === 'suspended') throw new HTTPException(403, { message: 'account suspended' });

  c.set('auth', {
    userId: data.user.id,
    email: data.user.email ?? '',
    role: profile.role,
    status: profile.status,
  });
  await next();
});

// Guard for admin-only routes. Use as: adminRoute.use('*', auth, requireAdmin)
export const requireAdmin = createMiddleware<{ Variables: { auth: AuthCtx } }>(async (c, next) => {
  const ctx = c.get('auth');
  if (ctx.role !== 'admin') throw new HTTPException(403, { message: 'admin only' });
  await next();
});

// Variante para onboarding self-serve: igual que `auth` pero permite cuentas
// en estado 'pending' (el wizard ES el camino de pending → active).
export const authAllowPending = createMiddleware<{ Variables: { auth: AuthCtx } }>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'missing bearer token' });
  }
  const token = header.slice('Bearer '.length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HTTPException(401, { message: 'invalid token' });

  const [profile] = await db.select({
    role: profiles.role,
    status: profiles.status,
  }).from(profiles).where(eq(profiles.userId, data.user.id)).limit(1);

  if (!profile) throw new HTTPException(403, { message: 'profile not found' });
  if (profile.status === 'suspended') throw new HTTPException(403, { message: 'account suspended' });

  c.set('auth', {
    userId: data.user.id,
    email: data.user.email ?? '',
    role: profile.role,
    status: profile.status,
  });
  await next();
});
