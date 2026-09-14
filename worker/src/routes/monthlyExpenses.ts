import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Env, Vars } from '../types';
import { getDb, newId, nowIso } from '../db';
import { monthlyExpenses } from '../../drizzle/schema';
import { requireAuth, requireRole } from '../middleware/auth';
import { buildFilters, combine } from '../lib/filters';
import { writeAudit } from '../lib/audit';

export const monthlyExpenseRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();
monthlyExpenseRoutes.use('*', requireAuth);

monthlyExpenseRoutes.get('/', async (c) => {
  const { orgId } = c.get('auth');
  const db = getDb(c.env);
  const query = new URL(c.req.url).searchParams;

  const conditions = [eq(monthlyExpenses.orgId, orgId), isNull(monthlyExpenses.voidedAt), ...buildFilters(query, {
    vehicle_id: { column: monthlyExpenses.vehicleId, op: 'eq' },
    category: { column: monthlyExpenses.category, op: 'eq' },
    from: { column: monthlyExpenses.spentOn, op: 'gte' },
    to: { column: monthlyExpenses.spentOn, op: 'lte' }
  })];

  const rows = await db.select().from(monthlyExpenses).where(combine(conditions));
  return c.json({ monthlyExpenses: rows });
});

const createSchema = z.object({
  vehicleId: z.string().min(1),
  driverId: z.string().optional(),
  spentOn: z.string().min(1),
  category: z.enum(['loading_charges', 'unloading_charges', 'weighbridge_fee', 'detention', 'maintenance',
    'insurance', 'tyres', 'permit_tax', 'loan_lease', 'fine', 'other']),
  amountPaise: z.number().int().nonnegative(),
  remarks: z.string().optional()
});

monthlyExpenseRoutes.post('/', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);

  const db = getDb(c.env);
  const id = newId();
  await db.insert(monthlyExpenses).values({ id, orgId: auth.orgId, createdBy: auth.userId, ...parsed.data });
  await writeAudit(db, auth.orgId, 'monthly_expenses', id, 'insert', parsed.data, auth.userId);

  const [row] = await db.select().from(monthlyExpenses).where(eq(monthlyExpenses.id, id)).limit(1);
  return c.json(row, 201);
});

// Soft void, never a hard delete — a removed cost line must still be
// explainable from the audit trail.
monthlyExpenseRoutes.delete('/:id', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const db = getDb(c.env);
  const result = await db.update(monthlyExpenses).set({ voidedAt: nowIso() }).where(and(eq(monthlyExpenses.id, id), eq(monthlyExpenses.orgId, auth.orgId)));
  if (result.meta.changes === 0) return c.json({ error: { code: 'not_found', message: 'Expense not found' } }, 404);
  await writeAudit(db, auth.orgId, 'monthly_expenses', id, 'void', {}, auth.userId);
  return c.json({ ok: true });
});
