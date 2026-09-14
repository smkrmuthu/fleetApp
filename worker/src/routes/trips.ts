import { Hono } from 'hono';
import { and, desc, eq, lt, or, gt } from 'drizzle-orm';
import { z } from 'zod';
import type { Env, Vars } from '../types';
import { getDb, newId, nowIso } from '../db';
import { trips, tripExpenses, drivers, notifications } from '../../drizzle/schema';
import { requireAuth, requireRole } from '../middleware/auth';
import { buildFilters, combine, parsePagination } from '../lib/filters';
import { writeAudit } from '../lib/audit';

export const tripRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();
tripRoutes.use('*', requireAuth);

const expenseLineSchema = z
  .object({
    id: z.string().optional(),
    spentOn: z.string().min(1),
    kind: z.enum(['diesel', 'adblue', 'toll', 'other']),
    litres: z.number().nonnegative().optional(),
    ratePaise: z.number().int().nonnegative().optional(),
    amountPaise: z.number().int().nonnegative(),
    details: z.string().optional()
  })
  .refine((l) => l.kind !== 'other' || !!l.details?.trim(), { message: "details is required when kind = 'other'", path: ['details'] });

const createTripSchema = z.object({
  id: z.string().min(1),
  vehicleId: z.string().min(1),
  driverId: z.string().optional(),
  waybillNo: z.string().optional(),
  itemNo: z.string().optional(),
  loadDate: z.string().min(1),
  unloadDate: z.string().optional(),
  fromLoc: z.string().optional(),
  toLoc: z.string().optional(),
  weightKg: z.number().int().nonnegative().optional(),
  odoStart: z.number().int().nonnegative().optional(),
  odoEnd: z.number().int().nonnegative().optional(),
  revenuePaise: z.number().int().nonnegative().default(0),
  remarks: z.string().optional(),
  expenses: z.array(expenseLineSchema).default([])
});

// Idempotent on the client-generated id: a retry after a dropped signal
// returns the existing row rather than creating a duplicate trip.
tripRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = createTripSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);
  const data = parsed.data;

  const db = getDb(c.env);
  const [existing] = await db.select().from(trips).where(and(eq(trips.id, data.id), eq(trips.orgId, auth.orgId))).limit(1);
  if (existing) return c.json(existing, 200);

  const isDriver = auth.role === 'driver';
  const driverId = isDriver ? auth.driverId : data.driverId ?? null;
  const status = isDriver ? 'pending' : 'approved';
  const now = nowIso();

  const tripValues = {
    id: data.id,
    orgId: auth.orgId,
    vehicleId: data.vehicleId,
    driverId,
    waybillNo: data.waybillNo,
    itemNo: data.itemNo,
    loadDate: data.loadDate,
    unloadDate: data.unloadDate,
    fromLoc: data.fromLoc,
    toLoc: data.toLoc,
    weightKg: data.weightKg,
    odoStart: data.odoStart,
    odoEnd: data.odoEnd,
    revenuePaise: data.revenuePaise,
    status: status as 'pending' | 'approved',
    remarks: data.remarks,
    createdBy: auth.userId,
    createdAt: now,
    updatedAt: now
  };

  const expenseRows = data.expenses.map((e) => ({
    id: e.id ?? newId(),
    orgId: auth.orgId,
    tripId: data.id,
    spentOn: e.spentOn,
    kind: e.kind,
    litres: e.litres,
    ratePaise: e.ratePaise,
    amountPaise: e.amountPaise,
    details: e.details,
    createdBy: auth.userId,
    createdAt: now
  }));

  const statements = [db.insert(trips).values(tripValues)];
  for (const row of expenseRows) statements.push(db.insert(tripExpenses).values(row) as any);
  await db.batch(statements as [any, ...any[]]);

  await writeAudit(db, auth.orgId, 'trips', data.id, 'insert', { status, expenseCount: expenseRows.length }, auth.userId);

  if (status === 'pending' && driverId) {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
    await db.insert(notifications).values({
      id: newId(),
      orgId: auth.orgId,
      kind: 'approval',
      message: `${driver?.fullName ?? 'A driver'} logged ${data.vehicleId} — pending approval`,
      tab: 'triplog',
      relatedTripId: data.id,
      read: false,
      createdAt: now
    });
  }

  return c.json({ ...tripValues, expenses: expenseRows }, 201);
});

// Keyset pagination on (load_date desc, id) — no offset scans as the log
// grows. Drivers are forced to their own rows regardless of what a client
// sends; every other filter is optional and order in the URL never matters.
tripRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const db = getDb(c.env);
  const query = new URL(c.req.url).searchParams;
  const { limit, cursor } = parsePagination(query);

  const conditions = [eq(trips.orgId, auth.orgId), ...buildFilters(query, {
    vehicle_id: { column: trips.vehicleId, op: 'eq' },
    driver_id: { column: trips.driverId, op: 'eq' },
    status: { column: trips.status, op: 'eq' },
    from: { column: trips.loadDate, op: 'gte' },
    to: { column: trips.loadDate, op: 'lte' }
  })];
  if (auth.role === 'driver') conditions.push(eq(trips.driverId, auth.driverId ?? ''));

  if (cursor) {
    const [cursorDate, cursorId] = cursor.split('|');
    conditions.push(or(lt(trips.loadDate, cursorDate), and(eq(trips.loadDate, cursorDate), gt(trips.id, cursorId)))!);
  }

  const rows = await db.select().from(trips).where(combine(conditions)).orderBy(desc(trips.loadDate), trips.id).limit(limit);
  const nextCursor = rows.length === limit ? `${rows[rows.length - 1].loadDate}|${rows[rows.length - 1].id}` : null;

  const tripIds = rows.map((t) => t.id);
  const expenseRows = tripIds.length
    ? await db.select().from(tripExpenses).where(eq(tripExpenses.orgId, auth.orgId))
    : [];
  const byTrip = new Map<string, typeof expenseRows>();
  for (const e of expenseRows) {
    if (!tripIds.includes(e.tripId)) continue;
    if (!byTrip.has(e.tripId)) byTrip.set(e.tripId, []);
    byTrip.get(e.tripId)!.push(e);
  }

  return c.json({ trips: rows.map((t) => ({ ...t, expenses: byTrip.get(t.id) ?? [] })), nextCursor });
});

tripRoutes.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const db = getDb(c.env);
  const [trip] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId))).limit(1);
  if (!trip) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);
  if (auth.role === 'driver' && trip.driverId !== auth.driverId) {
    return c.json({ error: { code: 'forbidden', message: 'Not your trip' } }, 403);
  }
  const expenses = await db.select().from(tripExpenses).where(eq(tripExpenses.tripId, id));
  return c.json({ ...trip, expenses });
});

tripRoutes.post('/:id/expenses', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const body = await c.req.json().catch(() => null);
  const parsed = expenseLineSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);

  const db = getDb(c.env);
  const [trip] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId))).limit(1);
  if (!trip) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);

  const row = { id: parsed.data.id ?? newId(), orgId: auth.orgId, tripId: id, createdBy: auth.userId, createdAt: nowIso(), ...parsed.data };
  await db.insert(tripExpenses).values(row);
  await writeAudit(db, auth.orgId, 'trip_expenses', row.id, 'insert', { tripId: id, kind: row.kind }, auth.userId);
  return c.json(row, 201);
});

// Office/manager only — a month-close guard (409 if the month is frozen) is
// future work once /months/:yyyy-mm:close exists.
tripRoutes.patch('/:id', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const body = await c.req.json().catch(() => null);
  const parsed = createTripSchema.omit({ id: true, expenses: true }).partial().safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);

  const db = getDb(c.env);
  const result = await db.update(trips).set({ ...parsed.data, updatedAt: nowIso() }).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId)));
  if (result.meta.changes === 0) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);
  await writeAudit(db, auth.orgId, 'trips', id, 'update', parsed.data, auth.userId);

  const [row] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return c.json(row);
});

tripRoutes.post('/:id/approve', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const db = getDb(c.env);
  const result = await db.update(trips).set({ status: 'approved', updatedAt: nowIso() }).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId)));
  if (result.meta.changes === 0) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);
  await writeAudit(db, auth.orgId, 'trips', id, 'approve', {}, auth.userId);
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.relatedTripId, id), eq(notifications.orgId, auth.orgId)));
  return c.json({ ok: true });
});
