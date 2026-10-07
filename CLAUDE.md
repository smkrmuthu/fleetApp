# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Fleet Ledger for Shree Mira Trader (SMT)**: a goods-movement and expense ledger for a trucking fleet (trips against a waybill, diesel/AdBlue/toll entries, monthly fixed costs, month-end reports).

- Repo: `smkrmuthu/fleetApp`. **Production: https://smt.oneuptech.co**, used daily by a real client with live data.
- Trip numbers are `SMT-#####`. Company in the data and in exports: **Shree Mira Trader**.

### Hard rules (production)

- **The data in the production database is real**, including anything that looks odd (a 10 kg trip, inactive trucks, drivers with no trips, accounts without a password). Never call it test or sample data, never offer or run cleanups, and keep production checks read-only.
- **Never deploy, migrate or change secrets without being asked.** Web deploy = merge to `main`. API deploy and `db:migrate:remote` are manual and need an explicit go-ahead; take a backup first (Master > Data backup > Back up now).
- **Work on a branch.** Do not push to `main` or open a PR unless the user says so. The user normally says "deploy into main" after a branch has been built and checked.
- **SMT and the demo are separate.** The prospect demo lives in `smkrmuthu/FleetAppDemo` (https://fleet.oneuptech.co) with its own Worker, database, bucket and secrets. Never connect the two, never add `fleet.oneuptech.co` to `ALLOWED_ORIGIN`, never copy production data into the demo.

| Thing | Production value |
|---|---|
| Website | Cloudflare Worker `fleetapp` (static assets) at `smt.oneuptech.co`, also GitHub Pages `smkrmuthu.github.io/fleetApp` |
| API Worker | `fleet-ledger-api` (`worker/wrangler.toml`) |
| Database | D1 `fleet-ledger-db` (id in `worker/wrangler.toml`) |
| Files + nightly backups | R2 bucket `fleet-ledger-docs` (`backups/<date>/`, `backups/files/`) |
| Cron | `0 21 * * *` UTC = 02:30 IST: database + file backup, 30 days kept |
| Secrets (never in the repo) | `JWT_SECRET`, `GEMINI_API_KEY` (set with `wrangler secret put`) |

The API address is in `src/lib/api.ts` (`API_BASE`); the websites allowed to call it are `ALLOWED_ORIGIN` in `worker/wrangler.toml`. Change them together.

## Stack

- **Frontend (repo root):** Vite + React 19 + TypeScript, lucide-react icons, jsPDF/autotable and write-excel-file for exports, Capacitor wrappers (`android/`, `ios/`), PWA (`public/sw.js`). No router: `src/App.tsx` switches screens by role.
- **API (`worker/`):** Hono + Drizzle on Cloudflare Workers, D1 (SQLite) and R2, zod validation, bill scanning through Gemini.
- **Tests:** Vitest in both packages. CI (`.github/workflows/ci.yml`, Node 22) runs tsc, tests and build; the Pages deploy runs the tests first. The Cloudflare Git build of `fleetapp` is **not** gated by CI.

## Commands

Frontend (repo root):

```bash
npm install
npm run dev                  # Vite on :5173/:5180, talks to the PRODUCTION API (API_BASE)
npx tsc --noEmit -p .        # type-check
npm test                     # vitest run
npm run build                # tsc && vite build
```

API (`worker/`):

```bash
npm install
npx tsc --noEmit && npm test
npm run db:migrate:local && npm run db:seed:local    # local-only DB (fictional seed.sql)
npx wrangler dev --local --persist-to <scratch-dir>  # local API on :8787
npm run deploy               # PRODUCTION deploy: only when asked
npm run db:migrate:remote    # PRODUCTION migration: only when asked
```

Always pass `--local` to `wrangler d1 ...` when experimenting; without it the command hits the real database. To look at the UI with data, run the local API with a scratch `--persist-to` folder, point `API_BASE` at `http://127.0.0.1:8787/v1` temporarily (revert before committing) and open the site on `http://localhost:5180` (the origin the API allows). `worker/seed.sql` has fictional logins for local use (see its header).

Before pushing: `npx tsc --noEmit -p .`, `npm test`, `npm run build`, and in `worker/`: `npx tsc --noEmit`, `npm test`.

## Layout

```
src/
  App.tsx              tab wiring and state; role -> tabs via ROLE_TABS / TAB_LABELS (src/data/mockData.ts)
  index.css            design tokens and all styling
  components/          one file per screen (Dashboard, TripLog, AddMovement, MovementReview, MovementSummary,
                       MonthlyReport, MonthlyExpenses, FuelExpenses, Master, People, DataModel, ...), AppShell, SignIn
  lib/api.ts           API client             lib/reports.ts, exporter.ts   Excel/PDF exports
  utils/               calc.ts (money/date helpers), aggregate.ts (per-vehicle totals)
worker/
  src/index.ts         Hono app + scheduled backup      src/routes/   one file per resource
  src/lib/             jwt, password, rateLimit, backup, fuelAccess, authCheck, ...
  migrations/          D1 SQL migrations (Drizzle)       scripts/      download-backup.sh, restore-from-backup.mjs
docs/                  RUNBOOK.md, database-backup-and-restore.md, architecture/
```

## Roles and screens

`ROLE_TABS` in `src/data/mockData.ts` is the single source (tested in `src/data/roleTabs.test.ts`):

- **Driver:** Add Movement, Trip Log (own movements only; no fuel entry, no fixed costs).
- **Office:** Add Movement, Trip Log, Movement Summary, Monthly Expenses, Monthly Report.
- **Manager:** everything, including Dashboard, Fuel Expenses, People, Master, Data Model, Data backup.
- **Viewer:** Dashboard, Movement Summary, Monthly Report; read-only, enforced server-side in `requireAuth` (`viewerBlocked`).

Fuel Expenses is Manager-only in the UI and blocked for drivers at the API (`worker/src/lib/fuelAccess.ts`). Changing a role's tabs means updating `ROLE_TABS`, its test, and the API checks together.

## Rules that must not break

- **Money is stored as paise** (integers) and shown with two decimals; format with `rupees()` / `formatNum()` from `src/utils/calc.ts`.
- **Fastag:** a monthly expense described "Fastag" is shown as Toll (`ledgerToll`, `ledgerMonthly`, `ledgerTripExpense` in `aggregate.ts`). Total cost and profit never change because of it, and it is never counted twice.
- **Totals:** per-vehicle totals come from `sumVehicles()` in `src/utils/aggregate.ts` and are summed from the rows shown, so a Total can never disagree with the rows above it. Ratios (margin, per-km) are recomputed from the totals, never averaged. Report exports add Total rows through `withTotal` / `foot`; the full backup (`exportBackup`) must stay pure data with none.
- **Fuel without a trip:** `fuel_entries` holds diesel posted without a trip; Office assigns it later with Edit (moved atomically with `db.batch`).
- **Schema changes** are a new migration in `worker/migrations/` (`npm run db:generate`) plus the Drizzle schema. Never edit an applied migration. Deploy order: migration, then API Worker, then web.
- **Auth:** PBKDF2 passwords (minimum 8 characters for new ones), 12-hour JWT, account re-checked on every request, sign-in rate limit 5 per minute per account (stored in D1).
- Bump `CACHE_NAME` in `public/sw.js` whenever the shipped shell assets change, so installed apps drop the stale bundle.
- Anything shown as an approximation must say so. The dashboard's fleet status and route map are derived from recorded movements (there is no GPS). The route map (`RouteNetwork` / `RouteMap`, Leaflet + OpenStreetMap tiles, loaded on demand) draws each lane (loading place, stops in order, unloading place) along the likely road route, labelled "Likely road routes · not GPS". Road routes come from the public OSRM servers (`roadRoute.ts`, one request a second, only the positions of the places are sent) and are remembered in localStorage; until an answer arrives, or if none can be found, the lane is a dashed straight line and the label says so. Place names are written "CUSTOMER - AREA", so the area is what gets placed: it is looked up in the built-in list first (`routeGeo.ts`: the company's own sites and 23 Chennai-area localities, positions from OpenStreetMap), then searched on OpenStreetMap (`placeGeo.ts`, only inside Chennai and then Tamil Nadu / southern Andhra Pradesh, one search a second, only the area name is sent) and remembered in the browser's localStorage (key `fleet_place_geo_v2`); places that cannot be found are listed, never guessed.

## Conventions

- Match the surrounding code: comment density, naming, and the inline-style vs CSS-class idiom of the file. Comments are sparing and explain *why*.
- Use the design tokens in `src/index.css` (`var(--color-...)`, `var(--font-heading)`) instead of hard-coded colours. Tables use `<table className="table">`; a `<tfoot>` row renders as the bold Total row.
- Keep SMT's own labels ("Fuel Expenses", "Master", "Add Movement"), name and logo (`src/assets/`).
- zsh pitfalls on this machine: do not name a variable `path`; unquoted `$var` is not word-split (use arrays); `sed -i ''` on macOS.

## Backups and domains

- Nightly backups run by themselves; the Manager sees the state under Master > Data backup (red if older than a day). Restore steps are in `docs/RUNBOOK.md` and `docs/database-backup-and-restore.md`. Copies sit in the same Cloudflare account, so a monthly off-site download (`worker/scripts/download-backup.sh`) is still manual.
- `smt.oneuptech.co` is a Route `smt.oneuptech.co/*` on the `fleetapp` Worker plus a proxied AAAA `100::` record (the dashboard's "Add Domain" dialog did nothing on this account). The zone is `oneuptech.co`. After a CORS or `ALLOWED_ORIGIN` change allow 20-40 seconds to propagate.

## Known gaps

- No second-factor sign-in, no "forgot password" email or SMS, no alert emails if the app or the nightly backup fails.
- Screens load all records for the company (fine for thousands of trips, needs paging later). One company per deployment.
- Multi-page bill scanning only reads the first page. Android is a debug APK only; there is no iPhone build and no Play Store release.

## Working with the user

- Ask before anything outward-facing or hard to reverse: deploys, migrations, secrets, DNS or domain changes, deleting branches or resources.
- Report outcomes faithfully (failing tests, skipped steps, what was not verified).
- Keep `docs/RUNBOOK.md` and the Google Doc for the app updated when meaningful work lands.
