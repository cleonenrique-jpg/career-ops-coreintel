import { createMiddleware } from 'hono/factory';
import { createClient } from '@supabase/supabase-js';
import { HTTPException } from 'hono/http-exception';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseAnon = process.env.SUPABASE_ANON_KEY ?? '';
const defaultUserId = process.env.DEFAULT_USER_ID;

const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: { persistSession: false },
});

export type AuthCtx = { userId: string };

export const auth = createMiddleware<{ Variables: { auth: AuthCtx } }>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header && defaultUserId) {
    // Single-tenant fallback while signup is closed.
    c.set('auth', { userId: defaultUserId });
    await next();
    return;
  }
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'missing bearer token' });
  }
  const token = header.slice('Bearer '.length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HTTPException(401, { message: 'invalid token' });
  c.set('auth', { userId: data.user.id });
  await next();
});
