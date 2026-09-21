import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';

// ─────────────────────────────────────────────────────────────────────────
// Money is stored in paise (integer). Never a float — SQLite's REAL is a
// double and rounding it is how a ledger silently drifts.
//
// Every tenant-scoped table carries org_id. There is no database-level RLS
// on D1 (SQLite has none), so isolation is enforced once, centrally, in
// worker/src/middleware/auth.ts and worker/src/db.ts — every query this API
// runs is scoped to the caller's org_id from the verified JWT, never from
// the request body. Treat that middleware as load-bearing security, not a
// convenience.
//
// Every core table also carries a custom_fields JSON text column — an
// escape hatch for tenant-specific attributes (a field one client needs
// that another doesn't) without a schema migration. Query it with SQLite's
// json_extract(); index specific keys later if one becomes hot.
// ─────────────────────────────────────────────────────────────────────────

export const orgs = sqliteTable('orgs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency').notNull().default('INR'),
  fyStartMonth: integer('fy_start_month').notNull().default(4),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`)
});

export const branches = sqliteTable('branches', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  name: text('name').notNull()
});

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
    branchId: text('branch_id').references(() => branches.id),
    role: text('role', { enum: ['driver', 'office', 'manager'] }).notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    passwordHash: text('password_hash'),
    passwordSalt: text('password_salt'),
    driverId: text('driver_id').references((): any => drivers.id),
    lastSeenAt: text('last_seen_at'),
    disabledAt: text('disabled_at')
  },
  (t) => ({
    orgPhoneUnique: uniqueIndex('users_org_phone').on(t.orgId, t.phone)
  })
);

export const vehicles = sqliteTable(
  'vehicles',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
    regNo: text('reg_no').notNull(),
    model: text('model'),
    tareKg: integer('tare_kg'),
    fcDate: text('fc_date'),
    fcRenewalDue: text('fc_renewal_due'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    // Pre-fills the Driver field in Add Movement when this truck is picked.
    defaultDriver: text('default_driver').references((): any => drivers.id),
    customFields: text('custom_fields', { mode: 'json' }).$type<Record<string, unknown>>()
  },
  (t) => ({
    orgRegUnique: uniqueIndex('vehicles_org_reg').on(t.orgId, t.regNo),
    fcRenewalIdx: index('vehicles_fc_renewal_due').on(t.orgId, t.fcRenewalDue)
  })
);

export const drivers = sqliteTable(
  'drivers',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
    branchId: text('branch_id').references(() => branches.id),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    licenceNo: text('licence_no'),
    licenceExpiry: text('licence_expiry'),
    credential: text('credential'),
    defaultVehicle: text('default_vehicle').references(() => vehicles.id),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    customFields: text('custom_fields', { mode: 'json' }).$type<Record<string, unknown>>()
  },
  (t) => ({
    expiringIdx: index('drivers_expiring').on(t.orgId, t.licenceExpiry)
  })
);

// No shipment/container layer — a trip carries its own waybill and item
// reference directly. See design/handoff/README.md for why that layer was
// removed rather than kept and relabeled.
export const trips = sqliteTable(
  'trips',
  {
    id: text('id').primaryKey(), // client-generated uuid: offline-safe, idempotent
    orgId: text('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
    vehicleId: text('vehicle_id').notNull().references(() => vehicles.id),
    driverId: text('driver_id').references(() => drivers.id),
    waybillNo: text('waybill_no'),
    itemNo: text('item_no'),
    loadDate: text('load_date').notNull(),
    unloadDate: text('unload_date'),
    fromLoc: text('from_loc'),
    toLoc: text('to_loc'),
    weightKg: integer('weight_kg'),
    odoStart: integer('odo_start'),
    odoEnd: integer('odo_end'),
    revenuePaise: integer('revenue_paise').notNull().default(0),
    status: text('status', { enum: ['draft', 'pending', 'approved', 'void'] }).notNull().default('draft'),
    remarks: text('remarks'),
    customFields: text('custom_fields', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdBy: text('created_by').references(() => users.id),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
    updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`)
  },
  (t) => ({
    orgVehDateIdx: index('trips_org_veh_date').on(t.orgId, t.vehicleId, t.loadDate),
    orgDriverDateIdx: index('trips_org_driver_date').on(t.orgId, t.driverId, t.loadDate),
    pendingIdx: index('trips_pending').on(t.orgId, t.loadDate, t.status)
  })
);

// One row per fuel/AdBlue/toll/other stop — a 3-day trip with two diesel
// fills and an AdBlue top-up is three rows here, not one flattened total.
export const tripExpenses = sqliteTable(
  'trip_expenses',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
    tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
    spentOn: text('spent_on').notNull(),
    kind: text('kind', { enum: ['diesel', 'adblue', 'toll', 'other'] }).notNull(),
    litres: real('litres'),
    ratePaise: integer('rate_paise'),
    amountPaise: integer('amount_paise').notNull(),
    details: text('details'), // required by the API when kind = 'other'
    receiptId: text('receipt_id').references(() => receipts.id),
    createdBy: text('created_by').references(() => users.id),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`)
  },
  (t) => ({
    tripIdx: index('trip_expenses_trip').on(t.orgId, t.tripId)
  })
);

// Any supporting file beyond the fuel receipts already linked from
// trip_expenses — a waybill copy, a weighbridge slip.
export const tripDocuments = sqliteTable(
  'trip_documents',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
    tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
    receiptId: text('receipt_id').notNull().references(() => receipts.id),
    docType: text('doc_type', { enum: ['waybill', 'weighbridge', 'other'] }).notNull().default('other'),
    createdBy: text('created_by').references(() => users.id),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`)
  },
  (t) => ({
    tripIdx: index('trip_documents_trip').on(t.orgId, t.tripId)
  })
);

// Fixed vehicle-side costs: permits, insurance, EMI, halting charges — costs
// that belong to the truck for the month, not to one trip.
export const monthlyExpenses = sqliteTable(
  'monthly_expenses',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
    vehicleId: text('vehicle_id').notNull().references(() => vehicles.id),
    driverId: text('driver_id').references(() => drivers.id),
    spentOn: text('spent_on').notNull(),
    category: text('category', {
      enum: ['loading_charges', 'unloading_charges', 'weighbridge_fee', 'detention', 'maintenance',
        'insurance', 'tyres', 'permit_tax', 'loan_lease', 'fine', 'other']
    }).notNull(),
    amountPaise: integer('amount_paise').notNull(),
    remarks: text('remarks'),
    receiptId: text('receipt_id').references(() => receipts.id),
    voidedAt: text('voided_at'),
    createdBy: text('created_by').references(() => users.id),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`)
  },
  (t) => ({
    monthIdx: index('monthly_expenses_month').on(t.orgId, t.spentOn, t.category)
  })
);

export const receipts = sqliteTable('receipts', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(), // R2 object key
  mimeType: text('mime_type'),
  ocrJson: text('ocr_json', { mode: 'json' }).$type<Record<string, unknown>>(),
  confidence: real('confidence'),
  uploadedBy: text('uploaded_by').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`)
});

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['approval', 'alert'] }).notNull(),
    message: text('message').notNull(),
    tab: text('tab').notNull(),
    relatedTripId: text('related_trip_id').references(() => trips.id),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    // Manager+Office see every org-wide alert today; a targetUserId column
    // is left null-for-everyone on purpose so per-user targeting can be
    // added later without a migration that touches existing rows.
    targetUserId: text('target_user_id').references(() => users.id),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`)
  },
  (t) => ({
    orgReadIdx: index('notifications_org_read').on(t.orgId, t.read, t.createdAt)
  })
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(), // insert | update | approve | void
    diff: text('diff', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
    actorId: text('actor_id').references(() => users.id),
    at: text('at').notNull().default(sql`(current_timestamp)`)
  },
  (t) => ({
    entityIdx: index('audit_entity').on(t.orgId, t.entity, t.entityId, t.at)
  })
);

// Org-wide master values that other screens read (e.g. today's diesel and
// AdBlue price per litre). One row per key so new master values don't need a
// migration each time.
export const settings = sqliteTable(
  'settings',
  {
    orgId: text('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    updatedAt: text('updated_at').notNull(),
    updatedBy: text('updated_by').references(() => users.id)
  },
  (t) => ({
    pk: primaryKey({ columns: [t.orgId, t.key] })
  })
);
