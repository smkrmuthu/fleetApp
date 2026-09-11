# Exim Ledger

Container movement & expense log for an import/export trucking operation.
Drivers log movements at the port gate, documentation posts shipment costs
(CFS, CHA, customs duty, detention), and managers close the month — all from
the same ledger.

This is a **frontend prototype**: nine screens wired to in-memory mock data,
faithfully recreating the design handoff in `design/handoff/`. There is no
backend yet — see `design/handoff/SCHEMA.sql` and `design/handoff/API.md` for
the intended Postgres schema and API contract.

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

Sign in · Movement Summary · Add Movement (with a mock receipt-scan flow) ·
Trip Log · Monthly Expenses · Monthly Report (manager only) · People · Data
Model (reference).

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
- Wiring the "Scan receipt" action to a real camera/OCR pipeline (EMB_App
  already has a working scan pipeline to borrow patterns from).
- Offline queueing for drivers (client-generated UUIDs, idempotent posts).
