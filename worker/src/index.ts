import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Vars } from './types';
import { authRoutes } from './routes/auth';
import { tripRoutes } from './routes/trips';
import { vehicleRoutes } from './routes/vehicles';
import { driverRoutes } from './routes/drivers';
import { monthlyExpenseRoutes } from './routes/monthlyExpenses';
import { userRoutes } from './routes/users';
import { notificationRoutes } from './routes/notifications';
import { receiptRoutes } from './routes/receipts';
import { settingsRoutes } from './routes/settings';
import { driverLeaveRoutes } from './routes/driverLeaves';
import { expenseCategoryRoutes } from './routes/expenseCategories';
import { vehicleUnavailabilityRoutes } from './routes/vehicleUnavailability';
import { transporterRoutes } from './routes/transporters';
import { tripExpenseCategoryRoutes } from './routes/tripExpenseCategories';
import { adminRoutes } from './routes/admin';
import { fuelEntryRoutes } from './routes/fuelEntries';
import { syncRoutes } from './routes/sync';
import { bumpDataVersion, changesData } from './lib/dataVersion';
import { getDb } from './db';
import { runBackup } from './lib/backup';
import { purgeExpiredRateLimits } from './lib/rateLimit';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use('*', async (c, next) => {
  const allowed = c.env.ALLOWED_ORIGIN.split(',').map((o) => o.trim());
  return cors({ origin: allowed, allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], maxAge: 600 })(c, next);
});

app.get('/', (c) => c.json({ name: 'fleet-ledger-api', ok: true }));

// After any successful save by a signed-in user, move the change stamp so other
// open screens know to reload (see routes/sync.ts). It runs after the response
// is built and must never turn a good save into an error.
app.use('/v1/*', async (c, next) => {
  await next();
  try {
    const auth = c.get('auth');
    if (auth && changesData(c.req.method, c.req.path, c.res.status)) {
      const work = bumpDataVersion(getDb(c.env), auth.orgId, auth.userId).catch((e) => console.error('data version', e));
      try { c.executionCtx.waitUntil(work); } catch { await work; }
    }
  } catch (e) {
    console.error('data version', e);
  }
});

app.route('/v1/auth', authRoutes);
app.route('/v1/trips', tripRoutes);
app.route('/v1/vehicles', vehicleRoutes);
app.route('/v1/drivers', driverRoutes);
app.route('/v1/monthly-expenses', monthlyExpenseRoutes);
app.route('/v1/users', userRoutes);
app.route('/v1/notifications', notificationRoutes);
app.route('/v1/receipts', receiptRoutes);
app.route('/v1/settings', settingsRoutes);
app.route('/v1/driver-leaves', driverLeaveRoutes);
app.route('/v1/expense-categories', expenseCategoryRoutes);
app.route('/v1/vehicle-unavailability', vehicleUnavailabilityRoutes);
app.route('/v1/transporters', transporterRoutes);
app.route('/v1/trip-expense-categories', tripExpenseCategoryRoutes);
app.route('/v1/admin', adminRoutes);
app.route('/v1/fuel-entries', fuelEntryRoutes);
app.route('/v1/sync', syncRoutes);

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'No such route' } }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: { code: 'internal_error', message: 'Something went wrong' } }, 500);
});

export default {
  fetch: app.fetch,
  // Runs on the cron schedule in wrangler.toml: the nightly backup, then a
  // tidy-up of expired rate-limit counters. A failure is recorded by the
  // backup itself (and shown in Master), so it is only logged here.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      try {
        await runBackup(env);
      } catch (err) {
        console.error('nightly backup failed', err);
      }
      await purgeExpiredRateLimits(env.DB).catch((err) => console.error('rate limit cleanup failed', err));
    })());
  }
};
