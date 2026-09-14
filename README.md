# Fleet Ledger

Goods movement & expense log for a trucking fleet. Drivers log trips against
a waybill and item reference — plain domestic haulage, not export/import
trade documentation — recording fuel, AdBlue and toll stops as they happen
across however many days a trip takes. Documentation posts the fixed costs
(permits, insurance, EMI). Managers close the month — all from the same
ledger.

This is a **frontend prototype**: nine screens wired to in-memory mock data,
faithfully recreating the design handoff in `design/handoff/`. There is no
backend yet — see `design/handoff/SCHEMA.sql` and `design/handoff/API.md` for
the intended Postgres schema and API contract. Built as a base to extend to
other transport companies and larger fleets (100+ vehicles) — the schema is
already multi-tenant (`org_id` on every table) and partitioned for scale.

## Live prototype

**[smkrmuthu.github.io/fleetApp](https://smkrmuthu.github.io/fleetApp/)**
— the same mock sign-in and all nine screens, publicly viewable, no install
required. Redeploys automatically on every push to `main` via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## Stack

Vite + React 19 + TypeScript, installable as a PWA (manifest + service
worker), wrapped for iOS and Android with Capacitor — the same setup used by
the sibling `EMB_App` project.

## Screens

Sign in · Movement Summary · Add Movement (multiple fuel/AdBlue/toll stops
per trip, document upload, a mock receipt-scan flow) · Trip Log · Monthly
Expenses · Monthly Report (manager only) · People (trucks, drivers, user
accounts) · Data Model (reference).

Role switching is a prototype affordance in the header — in production the
role comes from the authenticated session, never the client.

## Commands

```bash
npm run dev             # local dev server
npm run build            # typecheck + production build
npm run cap:sync         # build + copy web assets into ios/ and android/
npm run cap:open:ios     # open the Xcode project
npm run cap:open:android # open the Android Studio project
```

Building the Android APK from the CLI needs JDK 21 and the Android SDK on
`PATH`/`JAVA_HOME` — see the sibling project's toolchain notes if you don't
already have them installed.

## What's next

- A real backend implementing `design/handoff/SCHEMA.sql` and
  `design/handoff/API.md` (auth, persistence, OCR queue, month-close).
- Wiring "Scan receipt" and the document uploader to a real camera/OCR
  pipeline and object storage (EMB_App already has a working scan pipeline
  to borrow patterns from).
- Reading the odometer automatically from a dashboard photo, the same OCR
  pipeline applied to a different reading.
- Reject (not just approve) a pending movement — workflow still to be
  decided: who can reject, whether it needs a reason, whether it returns to
  the driver as an edit request.
- Offline queueing for drivers (client-generated UUIDs, idempotent posts).
- Vehicle tracking — either phone-based GPS from the driver's own app, or
  integrating an already-fitted hardware tracker's API/webhook feed. Either
  way it lands in the same `vehicle_positions`/`trip_pings` shape once a
  vendor and its data contract are picked.
