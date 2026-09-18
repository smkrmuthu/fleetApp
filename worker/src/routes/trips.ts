import { Hono } from 'hono';
import { and, desc, eq, lt, or, gt } from 'drizzle-orm';
import { z } from 'zod';
import type { Env, Vars } from '../types';
import { getDb, newId, nowIso } from '../db';
import { trips, tripExpenses, notifications, receipts, tripDocuments } from '../../drizzle/schema';
import { base64ToBytes, filenameFromKey, storageKeyFor } from '../lib/storage';
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

const documentInputSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  base64: z.string().min(1)
});

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
  // Driver only: create as an open trip (no approval requested yet) rather
  // than submitting straight away — see POST /:id/complete.
  draft: z.boolean().optional(),
  expenses: z.array(expenseLineSchema).default([]),
  documents: z.array(documentInputSchema).default([])
});

const completeSchema = z.object({
  odoEnd: z.number().int().nonnegative(),
  unloadDate: z.string().optional(),
  remarks: z.string().optional()
});

const MAX_DOCUMENT_BASE64_LENGTH = 12_000_000;

// Uploads one file to R2 and links it to the trip via a receipts row +
// a trip_documents row. Returns the shape the frontend renders directly.
async function uploadDocument(
  env: Env,
  db: ReturnType<typeof getDb>,
  auth: { orgId: string; userId: string },
  tripId: string,
  doc: z.infer<typeof documentInputSchema>
) {
  const receiptId = newId();
  const storageKey = storageKeyFor(auth.orgId, tripId, receiptId, doc.filename);
  await env.DOCS.put(storageKey, base64ToBytes(doc.base64), { httpMetadata: { contentType: doc.mimeType } });

  const now = nowIso();
  await db.insert(receipts).values({ id: receiptId, orgId: auth.orgId, storageKey, mimeType: doc.mimeType, uploadedBy: auth.userId, createdAt: now });
  const docId = newId();
  await db.insert(tripDocuments).values({ id: docId, orgId: auth.orgId, tripId, receiptId, docType: 'other', createdBy: auth.userId, createdAt: now });

  return { id: docId, filename: doc.filename, mimeType: doc.mimeType };
}

async function fetchDocumentsByTrip(db: ReturnType<typeof getDb>, orgId: string, tripIds: string[]) {
  const byTrip = new Map<string, { id: string; filename: string; mimeType: string | null }[]>();
  if (!tripIds.length) return byTrip;

  const docRows = (await db.select().from(tripDocuments).where(eq(tripDocuments.orgId, orgId))).filter((d) => tripIds.includes(d.tripId));
  if (!docRows.length) return byTrip;

  const receiptRows = await db.select().from(receipts).where(eq(receipts.orgId, orgId));
  const receiptById = new Map(receiptRows.map((r) => [r.id, r]));

  for (const d of docRows) {
    const receipt = receiptById.get(d.receiptId);
    if (!byTrip.has(d.tripId)) byTrip.set(d.tripId, []);
    byTrip.get(d.tripId)!.push({ id: d.id, filename: receipt ? filenameFromKey(receipt.storageKey) : 'file', mimeType: receipt?.mimeType ?? null });
  }
  return byTrip;
}

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
  if (existing) {
    const docs = (await fetchDocumentsByTrip(db, auth.orgId, [data.id])).get(data.id) ?? [];
    return c.json({ ...existing, documents: docs }, 200);
  }

  const isDriver = auth.role === 'driver';
  // A driver's own login is the account used to enter the trip, but the
  // driver named on it may be someone else — an office assistant keying
  // data for whoever's actually driving. Trust the submitted driver, only
  // falling back to the logged-in driver when none was picked.
  const driverId = isDriver ? data.driverId ?? auth.driverId : data.driverId ?? null;
  // A driver can only ever open a trip, never finalize it — see
  // POST /:id/complete, which office/manager alone may call.
  const status = isDriver ? 'draft' : 'approved';
  const now = nowIso();

  if (data.odoEnd != null && data.odoStart != null && data.odoEnd <= data.odoStart) {
    return c.json({ error: { code: 'validation_error', message: 'Odometer end must be greater than odometer start', field: 'odoEnd' } }, 422);
  }

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
    status: status as 'draft' | 'pending' | 'approved',
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

  const documentRows = [];
  for (const doc of data.documents) {
    if (doc.base64.length > MAX_DOCUMENT_BASE64_LENGTH) continue;
    documentRows.push(await uploadDocument(c.env, db, auth, data.id, doc));
  }

  return c.json({ ...tripValues, expenses: expenseRows, documents: documentRows }, 201);
});

// Keyset pagination on (created_at desc, id) — newest-entered first, no
// offset scans as the log grows. Drivers are forced to their own rows
// regardless of what a client sends; every other filter is optional and
// order in the URL never matters.
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
  // Scoped by who logged the trip (their account), not who it's attributed
  // to — an office assistant keying data on a driver's behalf picks whoever
  // actually drove from the dropdown, and that shouldn't hide the trip from
  // the login that entered it.
  if (auth.role === 'driver') conditions.push(eq(trips.createdBy, auth.userId));

  if (cursor) {
    const [cursorCreatedAt, cursorId] = cursor.split('|');
    conditions.push(or(lt(trips.createdAt, cursorCreatedAt), and(eq(trips.createdAt, cursorCreatedAt), gt(trips.id, cursorId)))!);
  }

  // Newest-entered first — the trip's own load date doesn't drive order,
  // so a movement logged just now always lands at the top of the list.
  const rows = await db.select().from(trips).where(combine(conditions)).orderBy(desc(trips.createdAt), trips.id).limit(limit);
  const nextCursor = rows.length === limit ? `${rows[rows.length - 1].createdAt}|${rows[rows.length - 1].id}` : null;

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
  const docsByTrip = await fetchDocumentsByTrip(db, auth.orgId, tripIds);

  return c.json({ trips: rows.map((t) => ({ ...t, expenses: byTrip.get(t.id) ?? [], documents: docsByTrip.get(t.id) ?? [] })), nextCursor });
});

tripRoutes.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const db = getDb(c.env);
  const [trip] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId))).limit(1);
  if (!trip) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);
  if (auth.role === 'driver' && trip.createdBy !== auth.userId) {
    return c.json({ error: { code: 'forbidden', message: 'Not your trip' } }, 403);
  }
  const expenses = await db.select().from(tripExpenses).where(eq(tripExpenses.tripId, id));
  const documents = (await fetchDocumentsByTrip(db, auth.orgId, [id])).get(id) ?? [];
  return c.json({ ...trip, expenses, documents });
});

// A driver may only add stops to their own trip while it's still open
// (draft); once it's submitted for approval the log for that trip is
// closed. Office/manager can add a cost line to any trip at any time.
tripRoutes.post('/:id/expenses', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const body = await c.req.json().catch(() => null);
  const parsed = expenseLineSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);

  const db = getDb(c.env);
  const [trip] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId))).limit(1);
  if (!trip) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);
  if (auth.role === 'driver' && (trip.createdBy !== auth.userId || trip.status === 'approved')) {
    return c.json({ error: { code: 'forbidden', message: 'Can only add to your own open movement' } }, 403);
  }

  const row = { id: parsed.data.id ?? newId(), orgId: auth.orgId, tripId: id, createdBy: auth.userId, createdAt: nowIso(), ...parsed.data };
  await db.insert(tripExpenses).values(row);
  await writeAudit(db, auth.orgId, 'trip_expenses', row.id, 'insert', { tripId: id, kind: row.kind }, auth.userId);
  return c.json(row, 201);
});

// Same ownership/open-trip rule as expense lines above: a driver can only
// attach files to their own trip while it's still a draft.
tripRoutes.post('/:id/documents', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const body = await c.req.json().catch(() => null);
  const parsed = documentInputSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);
  if (parsed.data.base64.length > MAX_DOCUMENT_BASE64_LENGTH) {
    return c.json({ error: { code: 'payload_too_large', message: 'File is too large' } }, 413);
  }

  const db = getDb(c.env);
  const [trip] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId))).limit(1);
  if (!trip) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);
  if (auth.role === 'driver' && (trip.createdBy !== auth.userId || trip.status === 'approved')) {
    return c.json({ error: { code: 'forbidden', message: 'Can only attach files to your own open movement' } }, 403);
  }

  const doc = await uploadDocument(c.env, db, auth, id, parsed.data);
  await writeAudit(db, auth.orgId, 'trip_documents', doc.id, 'insert', { tripId: id, filename: doc.filename }, auth.userId);
  return c.json(doc, 201);
});

tripRoutes.delete('/:id/documents/:docId', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const docId = c.req.param('docId')!;
  const db = getDb(c.env);

  const [trip] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId))).limit(1);
  if (!trip) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);
  if (auth.role === 'driver' && (trip.createdBy !== auth.userId || trip.status === 'approved')) {
    return c.json({ error: { code: 'forbidden', message: 'Can only remove files from your own open movement' } }, 403);
  }

  const [doc] = await db.select().from(tripDocuments).where(and(eq(tripDocuments.id, docId), eq(tripDocuments.orgId, auth.orgId), eq(tripDocuments.tripId, id))).limit(1);
  if (!doc) return c.json({ error: { code: 'not_found', message: 'Document not found' } }, 404);

  const [receipt] = await db.select().from(receipts).where(eq(receipts.id, doc.receiptId)).limit(1);
  // trip_documents.receipt_id has no ON DELETE cascade, so the child row
  // must go before its parent receipt.
  await db.delete(tripDocuments).where(eq(tripDocuments.id, docId));
  if (receipt) {
    await c.env.DOCS.delete(receipt.storageKey).catch(() => {});
    await db.delete(receipts).where(eq(receipts.id, receipt.id));
  }
  await writeAudit(db, auth.orgId, 'trip_documents', docId, 'delete', { tripId: id }, auth.userId);
  return c.json({ ok: true });
});

tripRoutes.get('/:id/documents/:docId/file', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const docId = c.req.param('docId')!;
  const db = getDb(c.env);

  const [trip] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId))).limit(1);
  if (!trip) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);
  if (auth.role === 'driver' && trip.createdBy !== auth.userId) {
    return c.json({ error: { code: 'forbidden', message: 'Not your movement' } }, 403);
  }

  const [doc] = await db.select().from(tripDocuments).where(and(eq(tripDocuments.id, docId), eq(tripDocuments.orgId, auth.orgId), eq(tripDocuments.tripId, id))).limit(1);
  if (!doc) return c.json({ error: { code: 'not_found', message: 'Document not found' } }, 404);
  const [receipt] = await db.select().from(receipts).where(eq(receipts.id, doc.receiptId)).limit(1);
  if (!receipt) return c.json({ error: { code: 'not_found', message: 'File not found' } }, 404);

  const object = await c.env.DOCS.get(receipt.storageKey);
  if (!object) return c.json({ error: { code: 'not_found', message: 'File not found in storage' } }, 404);
  return new Response(object.body, { headers: { 'Content-Type': receipt.mimeType ?? 'application/octet-stream' } });
});

// Office/manager may edit any trip at any time. A driver may only edit
// their own trip, and only until it's approved — once office has closed it
// out it's locked from their side. A month-close guard (409 if the month is
// frozen) is future work once /months/:yyyy-mm:close exists.
tripRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const db = getDb(c.env);
  const [existing] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId))).limit(1);
  if (!existing) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);
  if (auth.role === 'driver' && (existing.createdBy !== auth.userId || existing.status === 'approved')) {
    return c.json({ error: { code: 'forbidden', message: 'Can only edit your own open movement' } }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const baseSchema = createTripSchema.omit({ id: true, expenses: true, draft: true, documents: true }).partial();
  // A driver edits their own facts about the trip, never who it belongs to.
  const schema = auth.role === 'driver' ? baseSchema.omit({ driverId: true }) : baseSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);

  const odoStart = ('odoStart' in parsed.data ? parsed.data.odoStart : undefined) ?? existing.odoStart;
  const odoEnd = ('odoEnd' in parsed.data ? parsed.data.odoEnd : undefined) ?? existing.odoEnd;
  if (odoEnd != null && odoStart != null && odoEnd <= odoStart) {
    return c.json({ error: { code: 'validation_error', message: 'Odometer end must be greater than odometer start', field: 'odoEnd' } }, 422);
  }

  await db.update(trips).set({ ...parsed.data, updatedAt: nowIso() }).where(eq(trips.id, id));
  await writeAudit(db, auth.orgId, 'trips', id, 'update', parsed.data, auth.userId);

  const [row] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return c.json(row);
});

// Finalizes an open trip (draft, or a pending one left over from the old
// driver-approval flow): sets the closing odometer reading and marks it
// approved. Office/manager only — a driver can open and add to a movement
// but never finalize it themselves, and finalizing needs no separate
// approval step.
tripRoutes.post('/:id/complete', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const db = getDb(c.env);
  const [existing] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId))).limit(1);
  if (!existing) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);
  if (existing.status === 'approved') {
    return c.json({ error: { code: 'invalid_state', message: 'This movement is already approved' } }, 409);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: parsed.error.message } }, 422);

  const odoStart = existing.odoStart ?? 0;
  if (parsed.data.odoEnd <= odoStart) {
    return c.json({ error: { code: 'validation_error', message: 'Odometer end must be greater than odometer start', field: 'odoEnd' } }, 422);
  }

  const now = nowIso();
  await db.update(trips).set({
    odoEnd: parsed.data.odoEnd,
    unloadDate: parsed.data.unloadDate ?? existing.unloadDate,
    remarks: parsed.data.remarks ?? existing.remarks,
    status: 'approved',
    updatedAt: now
  }).where(eq(trips.id, id));
  await writeAudit(db, auth.orgId, 'trips', id, 'complete', { status: 'approved' }, auth.userId);

  const [row] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return c.json(row);
});

// A driver may delete only their own still-open (draft) movement — once it
// is complete (pending or approved) it is locked from their side. Office/
// manager may delete any trip that isn't yet approved. Once approved it's
// locked for everyone; there is no undo, so this is a hard delete of the
// trip and its expense lines.
tripRoutes.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id')!;
  const db = getDb(c.env);
  const [existing] = await db.select().from(trips).where(and(eq(trips.id, id), eq(trips.orgId, auth.orgId))).limit(1);
  if (!existing) return c.json({ error: { code: 'not_found', message: 'Trip not found' } }, 404);
  if (auth.role === 'driver' && existing.createdBy !== auth.userId) {
    return c.json({ error: { code: 'forbidden', message: 'Not your movement' } }, 403);
  }
  if (auth.role === 'driver' && existing.status !== 'draft') {
    return c.json({ error: { code: 'invalid_state', message: 'A completed movement cannot be deleted by a driver' } }, 409);
  }
  if (existing.status === 'approved') {
    return c.json({ error: { code: 'invalid_state', message: 'An approved movement cannot be deleted' } }, 409);
  }

  const docRows = await db.select().from(tripDocuments).where(and(eq(tripDocuments.tripId, id), eq(tripDocuments.orgId, auth.orgId)));
  const receiptIds = docRows.map((d) => d.receiptId);
  const relevantReceipts = receiptIds.length
    ? (await db.select().from(receipts).where(eq(receipts.orgId, auth.orgId))).filter((r) => receiptIds.includes(r.id))
    : [];

  // trip_documents.receipt_id has no ON DELETE cascade, so the child rows
  // must go before their parent receipts (and before the R2 objects, so a
  // crash mid-cleanup never leaves a dangling DB row pointing at nothing).
  await db.batch([
    db.delete(tripDocuments).where(eq(tripDocuments.tripId, id)),
    db.delete(tripExpenses).where(eq(tripExpenses.tripId, id)),
    db.delete(notifications).where(and(eq(notifications.relatedTripId, id), eq(notifications.orgId, auth.orgId))),
    db.delete(trips).where(eq(trips.id, id))
  ]);

  if (relevantReceipts.length) {
    await Promise.all(relevantReceipts.map((r) => c.env.DOCS.delete(r.storageKey).catch(() => {})));
    await db.batch(relevantReceipts.map((r) => db.delete(receipts).where(eq(receipts.id, r.id))) as [any, ...any[]]);
  }
  await writeAudit(db, auth.orgId, 'trips', id, 'delete', { status: existing.status }, auth.userId);
  return c.json({ ok: true });
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
