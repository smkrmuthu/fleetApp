import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Env, Vars } from '../types';
import { getDb, nowIso } from '../db';
import { settings } from '../../drizzle/schema';
import { requireAuth, requireRole } from '../middleware/auth';
import { writeAudit } from '../lib/audit';

export const settingsRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();
settingsRoutes.use('*', requireAuth);

const KEY = { dieselRate: 'diesel_rate', adblueRate: 'adblue_rate' } as const;

// Every role reads these — a driver logging fuel in Add Movement needs the
// current price — but only Office/Manager change them.
settingsRoutes.get('/', async (c) => {
  const { orgId } = c.get('auth');
  const db = getDb(c.env);
  const rows = await db.select().from(settings).where(eq(settings.orgId, orgId));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string) => (byKey.has(k) ? Number(byKey.get(k)) : null);
  return c.json({ dieselRate: num(KEY.dieselRate), adblueRate: num(KEY.adblueRate) });
});

const rate = z
  .number()
  .positive()
  .max(1000)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, { message: 'Use at most 2 decimal places' })
  .nullable()
  .optional();

const patchSchema = z.object({ dieselRate: rate, adblueRate: rate });

settingsRoutes.patch('/', requireRole('office', 'manager'), async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'validation_error', message: 'Enter a rate above 0, with at most 2 decimal places' } }, 422);
  }

  const db = getDb(c.env);
  const now = nowIso();
  const changes: Record<string, number | null> = {};
  for (const [field, key] of Object.entries(KEY) as [keyof typeof KEY, string][]) {
    const v = parsed.data[field];
    if (v === undefined) continue;
    changes[field] = v;
    if (v === null) {
      await db.delete(settings).where(and(eq(settings.orgId, auth.orgId), eq(settings.key, key)));
    } else {
      await db
        .insert(settings)
        .values({ orgId: auth.orgId, key, value: String(v), updatedAt: now, updatedBy: auth.userId })
        .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: String(v), updatedAt: now, updatedBy: auth.userId } });
    }
  }
  if (Object.keys(changes).length === 0) return c.json({ error: { code: 'validation_error', message: 'Nothing to update' } }, 422);
  await writeAudit(db, auth.orgId, 'settings', 'rates', 'update', changes, auth.userId);

  const rows = await db.select().from(settings).where(eq(settings.orgId, auth.orgId));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string) => (byKey.has(k) ? Number(byKey.get(k)) : null);
  return c.json({ dieselRate: num(KEY.dieselRate), adblueRate: num(KEY.adblueRate) });
});
