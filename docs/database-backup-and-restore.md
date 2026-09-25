# Fleet Ledger: Database storage, backup and restore

Last verified: 2026-09-25 (restore drill described in section 6).

## 1. Where the data lives

| What | Where | Identifier |
|---|---|---|
| Database (all trips, vehicles, drivers, users, expenses, Master settings, audit log) | Cloudflare **D1** (managed SQLite) | name `fleet-ledger-db`, id `63109d18-28d1-4331-911d-a34ee5e3f48c`, region APAC, created 2026-09-14 |
| Uploaded files (receipt photos, PDFs) | Cloudflare **R2** bucket | `fleet-ledger-docs`, region APAC, Standard storage |
| API that reads and writes both | Cloudflare **Worker** | `fleet-ledger-api`, `https://fleet-ledger-api.smkrmuthu.workers.dev/v1` |
| Secrets (`JWT_SECRET`, `GEMINI_API_KEY`) | Worker secrets | not in the database, not in any dump |
| Source code and migrations | GitHub `smkrmuthu/fleetApp` | `worker/migrations/*.sql` |

- The database is **not** on any user's phone or on GitHub Pages. The web app and the Android app hold only a login token and call the Worker; the Worker is the only thing that touches D1 and R2 (bindings `DB` and `DOCS` in `worker/wrangler.toml`).
- A D1 database is one logical database managed by Cloudflare, which keeps it durable and replicated on its side. You cannot open a file on a server, so backups are taken through Cloudflare's tools (below).
- The database stores only a **pointer** to each uploaded file (`receipts.storage_key`, format `<orgId>/<tripId>/<receiptId>__<filename>`). The file itself is in R2. **A database backup does not contain the files.**

Schema: 18 tables, defined in `worker/drizzle/schema.ts` and built by migrations `0000` to `0007` in `worker/migrations/`. The `d1_migrations` table records which have run. The trip-number sequence (`SMT-#####`) lives in the `counters` table, so any restore of the database also restores the sequence.

## 2. Backup layers

| # | Layer | Automatic? | Covers | Retention | Use it for |
|---|---|---|---|---|---|
| 1 | D1 **Time Travel** | Yes, always on | Database only | 30 days on Workers Paid, 7 days on Free (confirm your plan in the Cloudflare dashboard) | "Undo" a bad change from the last few weeks |
| 2 | **SQL export** (`wrangler d1 export`) | No, manual today | Database only | Forever, wherever you store the file | Off-Cloudflare copy, moving to a new database or account |
| 3 | In-app **Backup data** (Manager) | No, manual | Trips, vehicles, drivers, users, Master settings as a readable file | Wherever you keep it | Reading or analysing data in Excel. **Not** for restoring the database |
| 4 | **R2 files** | No | Uploaded documents | R2 has no built-in backup or versioning | Copy the files yourself (section 5) |

Current state: layer 1 is the only automatic protection. Copies from layer 2 exist only on the developer's Mac (`~/FleetLedger-backups/`). There is no scheduled backup and no off-machine copy yet (see section 8).

## 3. Taking a backup

Run from the `worker/` folder (needs `wrangler login` once).

**Data-only export. This is the format the tested restore uses. Take this one.**

```bash
npx wrangler d1 export fleet-ledger-db --remote --no-schema \
  --output ~/FleetLedger-backups/fleet-ledger-db-DATA-$(date +%Y%m%d-%H%M).sql
chmod 600 ~/FleetLedger-backups/*.sql
```

Optional full export (schema plus data), useful as a readable reference:

```bash
npx wrangler d1 export fleet-ledger-db --remote \
  --output ~/FleetLedger-backups/fleet-ledger-db-$(date +%Y%m%d-%H%M).sql
```

> **The full export cannot be replayed as-is.** D1's importer fails on it with a foreign-key error because the file lists tables in an order that puts child rows before their parents. Restore from the data-only export plus the migrations (section 4B).

**Security:** every dump contains user password hashes and salts, all trip and pricing data, and the audit log. Keep it out of the repo, restrict permissions, and store any off-machine copy encrypted.

## 4. Restoring the database

Before any restore that overwrites data, take a fresh export first (section 3).

### A. Undo recent changes in place: Time Travel

Restores the same database to an earlier moment (within the retention window). It replaces the current contents.

```bash
# See the current bookmark (a marker for "now"). Save it so you can return to it.
npx wrangler d1 time-travel info fleet-ledger-db

# Restore to a moment in time (RFC 3339 or Unix seconds), or to a bookmark
npx wrangler d1 time-travel restore fleet-ledger-db --timestamp 2026-09-25T06:00:00Z
npx wrangler d1 time-travel restore fleet-ledger-db --bookmark <bookmark>
```

The restore prints the bookmark of the state you just replaced; restoring to that bookmark undoes the restore. `time-travel info` was run against production and works; a real `restore` has **not** been run on production (it overwrites live data), so treat the first use as a controlled exercise.

Time Travel does not touch R2 files.

### B. Rebuild from a SQL backup into a new database (tested)

Use this for a lost or corrupted database, moving accounts, or a practice restore.

```bash
cd worker

# 1. Create the empty database and note the database_id it prints
npx wrangler d1 create fleet-ledger-db-restored

# 2. Point worker/wrangler.toml at it (database_name and database_id under [[d1_databases]])

# 3. Build the schema from the migrations (this also fills d1_migrations)
npx wrangler d1 migrations apply fleet-ledger-db-restored --remote

# 4. Put the data-only backup into parent-before-child order, then load it
python3 scripts/order-dump.py ~/FleetLedger-backups/fleet-ledger-db-DATA-YYYYMMDD-HHMM.sql > /tmp/ordered.sql
npx wrangler d1 execute fleet-ledger-db-restored --remote --yes --file /tmp/ordered.sql
rm /tmp/ordered.sql

# 5. Deploy the Worker so it uses the restored database
npx wrangler deploy
```

Why `scripts/order-dump.py`: D1's import commits in batches, so a child row loaded before its parent (`users` before `drivers`, `audit_log` before `users`) fails with `FOREIGN KEY constraint failed` and the whole import rolls back. The script loads parents first and drops the `d1_migrations` rows (step 3 already created them). If you add a table to the schema, add it to the `ORDER` list in that script.

### C. Verify a restore

Run the same counts on the source and the restored database; they must match, and the foreign-key check must return no rows:

```sql
SELECT (SELECT count(*) FROM trips) trips, (SELECT count(*) FROM users) users,
       (SELECT count(*) FROM vehicles) vehicles, (SELECT count(*) FROM drivers) drivers,
       (SELECT count(*) FROM audit_log) audit,
       (SELECT value FROM counters WHERE key='trip_no') trip_counter,
       (SELECT count(*) FROM d1_migrations) migrations;
PRAGMA foreign_key_check;
```

```bash
npx wrangler d1 execute <database> --remote --command "<the SQL above>"
```

Then sign in to the app, open the Trip Log and confirm the latest trips and the next trip number look right.

## 5. Uploaded files (R2)

The bucket holds the receipt photos and PDFs (2 objects, about 5 MB at the time of writing). Find which files the database expects:

```bash
npx wrangler d1 execute fleet-ledger-db --remote --command "SELECT storage_key FROM receipts"
```

Download one, or upload one back:

```bash
npx wrangler r2 object get  fleet-ledger-docs/<storage_key> --remote --file ./file.jpg
npx wrangler r2 object put  fleet-ledger-docs/<storage_key> --remote --file ./file.jpg
```

For a full copy of the bucket, use `rclone` against R2's S3-compatible endpoint (create an R2 API token in the Cloudflare dashboard). A restored database only works with attachments if the objects exist under the same keys.

## 6. What was tested (2026-09-25)

A restore drill was run against a temporary, separate D1 database (created and deleted for the test; production was only read):

- Replaying the **full** export directly: **failed** (foreign-key ordering, as described above).
- Migrations, then the **data-only** export loaded through `order-dump.py`: **succeeded**. The restored copy matched production: 12 trips, 7 users, 8 vehicles, 10 drivers, 18 trip expense lines, 308 audit rows, trip counter 8, 8 migrations, and `PRAGMA foreign_key_check` returned no rows.
- Time Travel: `info` confirmed. `restore` not exercised.
- R2 download and upload: commands not exercised.

## 7. Full disaster recovery (new Cloudflare account or lost project)

1. Install Node and Wrangler, then `wrangler login` to the new account.
2. Get the code: `git clone git@github.com:smkrmuthu/fleetApp.git`, then `npm install` in the root and in `worker/`.
3. Create the R2 bucket `fleet-ledger-docs`, and the D1 database (section 4B steps 1 to 4).
4. Put the new `database_id` in `worker/wrangler.toml`.
5. Set the secrets: `npx wrangler secret put JWT_SECRET` (any long random value; existing logins simply expire and users sign in again, passwords are unaffected) and `npx wrangler secret put GEMINI_API_KEY` (from your Google AI account).
6. `npx wrangler deploy` and note the new Worker URL.
7. If the URL changed, update `API_BASE` in `src/lib/api.ts` and `ALLOWED_ORIGIN` in `worker/wrangler.toml`, rebuild, push (GitHub Pages redeploys) and rebuild the Android app.
8. Restore the R2 files (section 5) and verify (section 4C).

## 8. Recommended next steps

1. **Schedule a backup** (weekly at least, daily is cheap at this size) that runs the data-only export and stores it off the Mac, encrypted. This is the largest gap today.
2. **Back up R2** with `rclone` on the same schedule; nothing protects the files right now.
3. **Confirm the Cloudflare plan** to know whether Time Travel keeps 7 or 30 days.
4. **Repeat the restore drill** (section 4B into a scratch database) every quarter and after any schema change.
5. Keep at least one backup that is **older than the Time Travel window**.
