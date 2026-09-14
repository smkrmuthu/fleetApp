import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Env, Vars } from '../types';
import { getDb } from '../db';
import { vehicles } from '../../drizzle/schema';
import { requireAuth, requireRole } from '../middleware/auth';
import { writeAudit } from '../lib/audit';

export const vehicleRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();
vehicleRoutes.use('*', requireAuth);

vehicleRoutes.get('/', async (c) => {
  const { orgId } = c.get('auth');
  const db = getDb(c.env);
  const includeInactive = c.req.query('include_inactive') === 'true';
  const conditions = [eq(vehicles.orgId, orgId)];
  if (!includeInactive) conditions.push(eq(vehicles.active, true));
  const rows = await db.select().from(vehicles).where(and(...conditions));

  const in60Days = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);
  return c.json({
    vehicles: rows.map((v) => ({ ...v, renewalDue: !!v.fcRenewalDue && v.fcRenewalDue <= in60Days }))
  });
});

const createSchema = z.object({
  regNo: z.string().min(1),
  model: z.string().optional(),
  fcDate: z.string().optional(),
  fcRenewalDue: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional()
});

vehicleRoutes.post('/', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);

  const db = getDb(c.env);
  // The registration number *is* the id — every screen already treats a
  // vehicle's plate number as its identity, so a separate surrogate id
  // would just be a join everyone has to remember to do.
  const id = parsed.data.regNo;
  await db.insert(vehicles).values({ id, orgId: auth.orgId, active: true, ...parsed.data });
  await writeAudit(db, auth.orgId, 'vehicles', id, 'insert', parsed.data, auth.userId);

  const [row] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return c.json(row, 201);
});

// Soft delete — a vehicle with existing trips is deactivated, never removed,
// so historical trips still resolve their vehicle reference.
vehicleRoutes.delete('/:id', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const db = getDb(c.env);
  const result = await db.update(vehicles).set({ active: false }).where(and(eq(vehicles.id, id), eq(vehicles.orgId, auth.orgId)));
  if (result.meta.changes === 0) return c.json({ error: { code: 'not_found', message: 'Vehicle not found' } }, 404);
  await writeAudit(db, auth.orgId, 'vehicles', id, 'deactivate', {}, auth.userId);
  return c.json({ ok: true });
});
