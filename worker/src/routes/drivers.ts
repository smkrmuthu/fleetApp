import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Env, Vars } from '../types';
import { getDb, newId } from '../db';
import { drivers } from '../../drizzle/schema';
import { requireAuth, requireRole } from '../middleware/auth';
import { writeAudit } from '../lib/audit';

export const driverRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();
driverRoutes.use('*', requireAuth);

driverRoutes.get('/', async (c) => {
  const { orgId } = c.get('auth');
  const db = getDb(c.env);
  const includeInactive = c.req.query('include_inactive') === 'true';
  const conditions = [eq(drivers.orgId, orgId)];
  if (!includeInactive) conditions.push(eq(drivers.active, true));
  const rows = await db.select().from(drivers).where(and(...conditions));

  const in60Days = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);
  return c.json({
    drivers: rows.map((d) => ({ ...d, expiring: !!d.licenceExpiry && d.licenceExpiry <= in60Days }))
  });
});

const createSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional(),
  licenceNo: z.string().optional(),
  licenceExpiry: z.string().optional(),
  credential: z.string().optional(),
  defaultVehicle: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional()
});

driverRoutes.post('/', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);

  const db = getDb(c.env);
  const id = newId();
  await db.insert(drivers).values({ id, orgId: auth.orgId, active: true, ...parsed.data });
  await writeAudit(db, auth.orgId, 'drivers', id, 'insert', parsed.data, auth.userId);

  const [row] = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
  return c.json(row, 201);
});

driverRoutes.patch('/:id', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);

  const db = getDb(c.env);
  const result = await db.update(drivers).set(parsed.data).where(and(eq(drivers.id, id), eq(drivers.orgId, auth.orgId)));
  if (result.meta.changes === 0) return c.json({ error: { code: 'not_found', message: 'Driver not found' } }, 404);
  await writeAudit(db, auth.orgId, 'drivers', id, 'update', parsed.data, auth.userId);

  const [row] = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
  return c.json(row);
});

// Soft delete — matches vehicles: deactivate, never remove, so past trips
// keep resolving driver_id.
driverRoutes.delete('/:id', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const db = getDb(c.env);
  const result = await db.update(drivers).set({ active: false }).where(and(eq(drivers.id, id), eq(drivers.orgId, auth.orgId)));
  if (result.meta.changes === 0) return c.json({ error: { code: 'not_found', message: 'Driver not found' } }, 404);
  await writeAudit(db, auth.orgId, 'drivers', id, 'deactivate', {}, auth.userId);
  return c.json({ ok: true });
});
