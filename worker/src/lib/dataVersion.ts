import { and, eq } from 'drizzle-orm';
import type { Db } from '../db';
import { nowIso } from '../db';
import { settings } from '../../drizzle/schema';

// A stamp that changes whenever anyone saves something, so open screens can tell
// cheaply (one row) that they should reload, instead of re-reading everything on
// a timer. It lives in the existing settings table under its own key.
const KEY = 'data_version';

// Which requests count as a change: a successful write, other than signing in
// and the bill-scan lookup (neither saves anything).
export function changesData(method: string, path: string, status: number): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  if (status >= 400) return false;
  if (path.startsWith('/v1/auth/')) return false;
  if (path === '/v1/receipts/scan') return false;
  return true;
}

export async function bumpDataVersion(db: Db, orgId: string, userId: string | null): Promise<void> {
  const now = nowIso();
  const value = `${now}-${Math.random().toString(36).slice(2, 8)}`;
  await db
    .insert(settings)
    .values({ orgId, key: KEY, value, updatedAt: now, updatedBy: userId })
    .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value, updatedAt: now, updatedBy: userId } });
}

export async function readDataVersion(db: Db, orgId: string): Promise<string> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, KEY))).limit(1);
  return row?.value ?? '0';
}
