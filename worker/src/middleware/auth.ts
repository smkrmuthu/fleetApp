import type { Context, Next } from 'hono';
import type { Env, Role, Vars } from '../types';
import { verifyAccessToken } from '../lib/jwt';

/**
 * Verifies the bearer token and sets `auth` on the context from it. Every
 * downstream route reads org_id / role / driver_id from c.get('auth') —
 * never from the request body or query string. This is the entire tenant
 * isolation boundary; there is no database-level RLS backing it up on D1.
 */
export async function requireAuth(c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return c.json({ error: { code: 'unauthorized', message: 'Missing bearer token' } }, 401);

  try {
    const auth = await verifyAccessToken(token, c.env.JWT_SECRET);
    c.set('auth', auth);
  } catch {
    return c.json({ error: { code: 'unauthorized', message: 'Invalid or expired token' } }, 401);
  }

  // A viewer is strictly read-only. Enforcing it here — rather than adding
  // the role to each route's requireRole list — means a route added later
  // can't accidentally let a viewer write. Uploaded bills/receipts and the
  // notification feed are also kept out of a viewer's reach: they aren't part
  // of Dashboard / Movement Summary / Monthly Report.
  if (c.get('auth').role === 'viewer') {
    const path = c.req.path;
    const readOnly = c.req.method === 'GET' || c.req.method === 'HEAD';
    const privateData = /\/documents\/[^/]+\/file$/.test(path) || path.startsWith('/v1/notifications');
    if (!readOnly || privateData) {
      return c.json({ error: { code: 'forbidden', message: 'This account is read-only' } }, 403);
    }
  }
  await next();
}

export function requireRole(...roles: Role[]) {
  return async (c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) => {
    const auth = c.get('auth');
    if (!roles.includes(auth.role)) {
      return c.json({ error: { code: 'forbidden', message: `Requires role: ${roles.join(' or ')}` } }, 403);
    }
    await next();
  };
}
