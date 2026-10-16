import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Env, Vars } from '../types';
import { getDb } from '../db';
import { tripExpenseCategories } from '../../drizzle/schema';
import { requireAuth, requireRole } from '../middleware/auth';
import { writeAudit } from '../lib/audit';

export const tripExpenseCategoryRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();
tripExpenseCategoryRoutes.use('*', requireAuth);

// 'Other' is the fallback every entry can use, so it can never be removed.
const PROTECTED = 'Other';

// Any signed-in role may read: Add Movement offers these in a dropdown and a driver
// login can enter movements too. Only Office/Manager add or remove one.
tripExpenseCategoryRoutes.get('/', async (c) => {
  const { orgId } = c.get('auth');
  const rows = await getDb(c.env).select().from(tripExpenseCategories)
    .where(and(eq(tripExpenseCategories.orgId, orgId), eq(tripExpenseCategories.active, true))).orderBy(sql`rowid`);
  return c.json({ categories: rows.map((r) => r.name) });
});

const createSchema = z.object({ name: z.string().trim().min(1).max(60) });

tripExpenseCategoryRoutes.post('/', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: 'Enter a category name of up to 60 characters' } }, 422);

  const db = getDb(c.env);
  const name = parsed.data.name;
  // Names are compared ignoring capitals, so "diesel" and "Diesel" are one category.
  const all = await db.select().from(tripExpenseCategories).where(eq(tripExpenseCategories.orgId, auth.orgId));
  const existing = all.find((r) => r.name.toLowerCase() === name.toLowerCase());
  if (existing?.active) return c.json({ error: { code: 'conflict', message: `"${existing.name}" already exists` } }, 409);
  if (existing) {
    await db.update(tripExpenseCategories).set({ active: true }).where(and(eq(tripExpenseCategories.orgId, auth.orgId), eq(tripExpenseCategories.name, existing.name)));
    await writeAudit(db, auth.orgId, 'trip_expense_categories', existing.name, 'reactivate', {}, auth.userId);
    return c.json({ name: existing.name }, 201);
  }
  await db.insert(tripExpenseCategories).values({ orgId: auth.orgId, name, active: true });
  await writeAudit(db, auth.orgId, 'trip_expense_categories', name, 'insert', {}, auth.userId);
  return c.json({ name }, 201);
});

// Soft delete: entries already saved under a category keep its name; it just stops being offered.
tripExpenseCategoryRoutes.delete('/:name', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const name = c.req.param('name')!;
  if (name.toLowerCase() === PROTECTED.toLowerCase()) {
    return c.json({ error: { code: 'invalid_state', message: `"${PROTECTED}" is the fallback category and cannot be removed` } }, 409);
  }
  const db = getDb(c.env);
  const result = await db.update(tripExpenseCategories).set({ active: false })
    .where(and(eq(tripExpenseCategories.orgId, auth.orgId), eq(tripExpenseCategories.name, name)));
  if (result.meta.changes === 0) return c.json({ error: { code: 'not_found', message: 'Category not found' } }, 404);
  await writeAudit(db, auth.orgId, 'trip_expense_categories', name, 'deactivate', {}, auth.userId);
  return c.json({ ok: true });
});
