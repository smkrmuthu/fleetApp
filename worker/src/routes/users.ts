import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Env, Vars } from '../types';
import { getDb, newId } from '../db';
import { users } from '../../drizzle/schema';
import { requireAuth, requireRole } from '../middleware/auth';
import { hashPassword } from '../lib/password';
import { writeAudit } from '../lib/audit';

export const userRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();
userRoutes.use('*', requireAuth);

userRoutes.get('/', requireRole('office', 'manager'), async (c) => {
  const { orgId } = c.get('auth');
  const db = getDb(c.env);
  const rows = await db.select().from(users).where(eq(users.orgId, orgId));
  return c.json({ users: rows.map(({ passwordHash, passwordSalt, ...safe }) => safe) });
});

const inviteSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(6),
  role: z.enum(['driver', 'office', 'manager']),
  password: z.string().min(6),
  branchId: z.string().optional(),
  driverId: z.string().optional()
});

// A real invite flow (SMS/email link, user sets their own password) is
// future work — Manager sets an initial password directly for now.
userRoutes.post('/invite', requireRole('manager'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);

  const db = getDb(c.env);
  const { password, ...rest } = parsed.data;
  const { hash, salt } = await hashPassword(password);
  const id = newId();
  await db.insert(users).values({ id, orgId: auth.orgId, passwordHash: hash, passwordSalt: salt, ...rest });
  await writeAudit(db, auth.orgId, 'users', id, 'insert', { fullName: rest.fullName, role: rest.role }, auth.userId);

  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) return c.json({ error: { code: 'not_found', message: 'User not found after insert' } }, 500);
  const { passwordHash: _h, passwordSalt: _s, ...safe } = row;
  return c.json(safe, 201);
});

userRoutes.patch('/:id', requireRole('manager'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const body = await c.req.json().catch(() => null);
  const parsed = inviteSchema.partial().omit({ password: true }).safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);

  const db = getDb(c.env);
  const result = await db.update(users).set(parsed.data).where(and(eq(users.id, id), eq(users.orgId, auth.orgId)));
  if (result.meta.changes === 0) return c.json({ error: { code: 'not_found', message: 'User not found' } }, 404);
  await writeAudit(db, auth.orgId, 'users', id, 'update', parsed.data, auth.userId);

  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) return c.json({ error: { code: 'not_found', message: 'User not found' } }, 404);
  const { passwordHash: _h, passwordSalt: _s, ...safe } = row;
  return c.json(safe);
});

// Manager only — Office can manage vehicles/drivers but never deletes a
// user account.
userRoutes.delete('/:id', requireRole('manager'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const db = getDb(c.env);
  const result = await db.delete(users).where(and(eq(users.id, id), eq(users.orgId, auth.orgId)));
  if (result.meta.changes === 0) return c.json({ error: { code: 'not_found', message: 'User not found' } }, 404);
  await writeAudit(db, auth.orgId, 'users', id, 'delete', {}, auth.userId);
  return c.json({ ok: true });
});
