# Exim Ledger — API contract

Base: `/v1`. JSON. Bearer token (JWT) with `org_id`, `user_id`, `role`, `driver_id`.
The server sets `app.org_id` / `app.role` / `app.driver_id` per connection from the
token — **never from the request body**. Money is sent and received in **paise (integer)**.

## Auth
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/otp:request` | `{phone}` → sends OTP. Rate-limited per phone and IP. |
| POST | `/auth/otp:verify` | `{phone, code}` → `{access, refresh, user}`. |
| POST | `/auth/password` | office/manager fallback. |
| POST | `/auth/refresh` | rotating refresh tokens; long-lived on mobile. |

## Movements
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/trips` | Body carries a **client-generated uuid**. Idempotent on it — a retry after signal returns the same row, never a duplicate. Driver tokens force `status: pending` and `driver_id = self`. |
| GET | `/trips` | `?from&to&vehicle_id&driver_id&direction&shipment_id&status&cursor&limit`. **Keyset** pagination on `(load_date desc, id)` — no offset. Drivers only ever receive their own rows. |
| GET | `/trips/:id` | Includes cost lines and receipts. |
| PATCH | `/trips/:id` | Office/manager. Writes an `audit_log` diff. 409 if the month is closed. |
| POST | `/trips/:id:approve` | Manager (and office, if configured). Bulk variant: `POST /trips:approve {ids[]}`. |
| POST | `/trips/:id/expenses` | One row per cost line (`diesel` / `toll` / `other`). |

## Shipments
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/shipments?direction&port&cleared&cursor` | List. |
| GET | `/shipments/:bl` | One BL with its containers, movements and cost lines — the landed cost of a consignment. |
| POST | `/shipments` · `/shipments/:id/containers` | Documentation and manager. |

## Expenses
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/monthly-expenses` | Documentation + manager. Requires a vehicle **or** a shipment. |
| GET | `/monthly-expenses?from&to&vehicle_id&shipment_id&category&cursor` | |
| DELETE | `/monthly-expenses/:id` | Soft void + audit row. |

## Receipts (OCR)
1. `POST /receipts:upload-url` → `{receipt_id, url, fields}`. The file goes straight to
   object storage; it never passes through the API.
2. Client PUTs the file, then `POST /receipts/:id:commit`.
3. OCR runs as a queued job and writes `ocr_json` + `confidence`.
4. `GET /receipts/:id` → parsed fields. Below 0.8 confidence the client must show the
   low-confidence warning and require field-by-field confirmation.

## Reporting
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/summary?month&vehicle_id&driver_id&direction` | Reads `vehicle_month` — constant cost as the log grows. |
| GET | `/reports/monthly?month` | Vehicle-wise ledger: cost split, revenue, profit, margin, ₹/km, ₹/ton. |
| GET | `/reports/monthly.xlsx?month` · `.pdf` | Server-rendered export. |
| POST | `/months/:yyyy-mm:close` | Manager only. Freezes the month; later corrections become adjustment rows, never silent rewrites. |

## People
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/users` · `POST /users:invite` · `PATCH /users/:id` | Manager manages; documentation reads. |
| GET | `/drivers` | Includes month aggregates and a `licence_expiring` flag (≤ 60 days). |
| POST | `/drivers` · `PATCH /drivers/:id` | |

## Conventions
- Errors: `{error: {code, message, field?}}` with real HTTP status. `409` for closed
  months and idempotency conflicts, `422` for validation.
- Every mutation writes `audit_log` with the actor and a JSON diff.
- Lists are cursor-paginated, default limit 50, max 200.
- `If-None-Match` / ETag on summary and report endpoints; they are cache-friendly.
- Background jobs: nightly licence-expiry notification, rollup refresh, OCR queue,
  month-close reminder on the 1st.
