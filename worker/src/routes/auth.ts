import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Env, Vars } from '../types';
import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { verifyPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { requireAuth } from '../middleware/auth';

export const authRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

const loginSchema = z.object({ phone: z.string().min(6), password: z.string().min(1) });

// OTP sign-in (POST /auth/otp:request, /auth/otp:verify) is not implemented
// yet — it needs an SMS provider (Twilio or similar) this deployment isn't
// wired to. Password is the only working sign-in path for now; see
// design/handoff/API.md.
authRoutes.post('/password', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: 'phone and password required' } }, 422);

  const db = getDb(c.env);
  const [user] = await db.select().from(users).where(eq(users.phone, parsed.data.phone)).limit(1);
  if (!user || !user.passwordHash || !user.passwordSalt || user.disabledAt) {
    return c.json({ error: { code: 'invalid_credentials', message: 'Phone or password is incorrect' } }, 401);
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash, user.passwordSalt);
  if (!ok) return c.json({ error: { code: 'invalid_credentials', message: 'Phone or password is incorrect' } }, 401);

  const access = await signAccessToken(
    { orgId: user.orgId, userId: user.id, role: user.role, driverId: user.driverId },
    c.env.JWT_SECRET
  );

  return c.json({
    access,
    user: { id: user.id, name: user.fullName, role: user.role, phone: user.phone, orgId: user.orgId }
  });
});

authRoutes.get('/me', requireAuth, async (c) => {
  const auth = c.get('auth');
  const db = getDb(c.env);
  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!user) return c.json({ error: { code: 'not_found', message: 'User not found' } }, 404);
  return c.json({ id: user.id, name: user.fullName, role: user.role, phone: user.phone, orgId: user.orgId });
});
