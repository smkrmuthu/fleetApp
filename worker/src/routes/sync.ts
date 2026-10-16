import { Hono } from 'hono';
import type { Env, Vars } from '../types';
import { getDb } from '../db';
import { requireAuth } from '../middleware/auth';
import { readDataVersion } from '../lib/dataVersion';

// Open screens ask this every few seconds. It returns only the change stamp (no
// records), so it is one row read however much data there is; the app reloads
// everything only when the stamp has moved.
export const syncRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();
syncRoutes.use('*', requireAuth);

syncRoutes.get('/', async (c) => {
  const { orgId } = c.get('auth');
  c.header('Cache-Control', 'no-store');
  return c.json({ version: await readDataVersion(getDb(c.env), orgId) });
});
