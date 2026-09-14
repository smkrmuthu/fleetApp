import type { AppNotification, DriverMaster, ExpenseCategory, MonthlyExpense, Role, TabId, Trip, UserAccount, Vehicle } from '../types';

export const VEHICLES: Vehicle[] = [
  { id: 'TN38 AB 4412', model: 'Tata Signa 4825', fcDate: '15 Mar 2025', renewalDate: '14 Mar 2027', renewalDue: false },
  { id: 'TN45 CQ 9087', model: 'Ashok Leyland 3520', fcDate: '30 Sep 2024', renewalDate: '29 Sep 2026', renewalDue: true },
  { id: 'KA01 MD 7731', model: 'BharatBenz 2823', fcDate: '05 Jan 2025', renewalDate: '04 Jan 2027', renewalDue: false },
  { id: 'TN52 BK 2290', model: 'Eicher Pro 6028', fcDate: '05 Nov 2024', renewalDate: '04 Nov 2026', renewalDue: true }
];

export const TRIPS: Trip[] = [
  {
    id: 't1', loadDate: '02 Sep', unloadDate: '03 Sep', vehicle: 'TN38 AB 4412', driver: 'Murugan S',
    waybillNo: 'EWB 2710 0345 6789', itemNo: 'ITM-4471', from: 'Chennai Yard', to: 'Sriperumbudur ICD',
    tons: 24.5, km: 342, revenue: 34500, status: 'approved',
    expenses: [
      { id: 't1x1', date: '02 Sep', kind: 'diesel', litres: 118, ratePerLitre: 95, amount: 11210 },
      { id: 't1x2', date: '02 Sep', kind: 'toll', amount: 1840 },
      { id: 't1x3', date: '03 Sep', kind: 'other', amount: 900 }
    ],
    documents: ['fuel_receipt_02sep.jpg', 'waybill_27100345.pdf']
  },
  {
    id: 't2', loadDate: '03 Sep', unloadDate: '04 Sep', vehicle: 'TN45 CQ 9087', driver: 'Rafiq A',
    waybillNo: 'EWB 3312 8890 0217', itemNo: 'ITM-5502', from: 'Tirupur Factory', to: 'Cochin Yard',
    tons: 18.0, km: 372, revenue: 31800, status: 'approved',
    expenses: [
      { id: 't2x1', date: '03 Sep', kind: 'diesel', litres: 131, ratePerLitre: 94, amount: 12314 },
      { id: 't2x2', date: '03 Sep', kind: 'toll', amount: 2100 },
      { id: 't2x3', date: '04 Sep', kind: 'other', amount: 1250 }
    ],
    documents: ['fuel_receipt_03sep.jpg']
  },
  {
    id: 't3', loadDate: '05 Sep', unloadDate: '05 Sep', vehicle: 'KA01 MD 7731', driver: 'Prakash N',
    waybillNo: 'EWB 1145 0032 8871', itemNo: 'ITM-2290', from: 'Ennore Yard', to: 'Hosur Warehouse',
    tons: 21.2, km: 208, revenue: 19400, status: 'approved',
    expenses: [
      { id: 't3x1', date: '05 Sep', kind: 'diesel', litres: 74, ratePerLitre: 96, amount: 7104 },
      { id: 't3x2', date: '05 Sep', kind: 'toll', amount: 980 },
      { id: 't3x3', date: '05 Sep', kind: 'other', amount: 450 }
    ],
    documents: []
  },
  {
    id: 't4', loadDate: '06 Sep', unloadDate: '08 Sep', vehicle: 'TN52 BK 2290', driver: 'Ilango R',
    waybillNo: 'EWB 4420 7765 1190', itemNo: 'ITM-6610', from: 'Hosur Warehouse', to: 'Cochin Yard',
    tons: 26.0, km: 692, revenue: 68200, status: 'approved',
    expenses: [
      { id: 't4x1', date: '06 Sep', kind: 'diesel', litres: 130, ratePerLitre: 95, amount: 12350 },
      { id: 't4x2', date: '06 Sep', kind: 'toll', amount: 1840 },
      { id: 't4x3', date: '07 Sep', kind: 'diesel', litres: 116, ratePerLitre: 95, amount: 11020 },
      { id: 't4x4', date: '07 Sep', kind: 'adblue', litres: 8, ratePerLitre: 75, amount: 600 },
      { id: 't4x5', date: '08 Sep', kind: 'toll', amount: 1800 },
      { id: 't4x6', date: '08 Sep', kind: 'other', amount: 2100 }
    ],
    documents: ['fuel_receipt_06sep.jpg', 'fuel_receipt_07sep.jpg', 'adblue_receipt_07sep.jpg']
  },
  {
    id: 't5', loadDate: '08 Sep', unloadDate: '09 Sep', vehicle: 'TN38 AB 4412', driver: 'Murugan S',
    waybillNo: 'EWB 2299 1173 6602', itemNo: 'ITM-4488', from: 'Chennai Yard', to: 'Vijayawada Warehouse',
    tons: 25.0, km: 456, revenue: 41900, status: 'approved',
    expenses: [
      { id: 't5x1', date: '08 Sep', kind: 'diesel', litres: 162, ratePerLitre: 95, amount: 15390 },
      { id: 't5x2', date: '08 Sep', kind: 'toll', amount: 2380 },
      { id: 't5x3', date: '09 Sep', kind: 'other', amount: 1150 }
    ],
    documents: ['fuel_receipt_08sep.jpg']
  },
  {
    id: 't6', loadDate: '09 Sep', unloadDate: '10 Sep', vehicle: 'TN45 CQ 9087', driver: 'Rafiq A',
    waybillNo: 'EWB 3366 0482 1907', itemNo: 'ITM-5521', from: 'Hyderabad Plant', to: 'Krishnapatnam Yard',
    tons: 19.5, km: 574, revenue: 47600, status: 'approved',
    expenses: [
      { id: 't6x1', date: '09 Sep', kind: 'diesel', litres: 108, ratePerLitre: 96, amount: 10368 },
      { id: 't6x2', date: '09 Sep', kind: 'toll', amount: 1600 },
      { id: 't6x3', date: '10 Sep', kind: 'diesel', litres: 97, ratePerLitre: 96, amount: 9312 },
      { id: 't6x4', date: '10 Sep', kind: 'adblue', litres: 6, ratePerLitre: 75, amount: 450 },
      { id: 't6x5', date: '10 Sep', kind: 'toll', amount: 1360 },
      { id: 't6x6', date: '10 Sep', kind: 'other', amount: 1400 }
    ],
    documents: ['fuel_receipt_09sep.jpg', 'fuel_receipt_10sep.jpg']
  },
  {
    id: 't7', loadDate: '10 Sep', unloadDate: '10 Sep', vehicle: 'KA01 MD 7731', driver: 'Prakash N',
    waybillNo: 'EWB 1198 4402 7765', itemNo: 'ITM-2295', from: 'Ennore Yard', to: 'Erode Warehouse',
    tons: 22.0, km: 98, revenue: 8600, status: 'pending',
    expenses: [
      { id: 't7x1', date: '10 Sep', kind: 'diesel', litres: 36, ratePerLitre: 95, amount: 3420 },
      { id: 't7x2', date: '10 Sep', kind: 'toll', amount: 420 },
      { id: 't7x3', date: '10 Sep', kind: 'other', amount: 260 }
    ],
    documents: []
  },
  {
    id: 't8', loadDate: '11 Sep', unloadDate: '12 Sep', vehicle: 'TN52 BK 2290', driver: 'Ilango R',
    waybillNo: 'EWB 4467 7743 0199', itemNo: 'ITM-6615', from: 'Madurai Factory', to: 'Tuticorin Yard',
    tons: 23.4, km: 268, revenue: 24800, status: 'pending',
    expenses: [
      { id: 't8x1', date: '11 Sep', kind: 'diesel', litres: 97, ratePerLitre: 95, amount: 9215 },
      { id: 't8x2', date: '11 Sep', kind: 'toll', amount: 1180 },
      { id: 't8x3', date: '12 Sep', kind: 'other', amount: 640 }
    ],
    documents: []
  }
];

export const MONTHLY_EXPENSES: MonthlyExpense[] = [
  { id: 'e1', date: '01 Sep', vehicle: 'TN38 AB 4412', driver: 'Murugan S', category: 'Detention / halting charges', amount: 28600, remarks: 'EWB 2710 0345 6789 · yard halt' },
  { id: 'e2', date: '02 Sep', vehicle: 'TN45 CQ 9087', driver: 'Rafiq A', category: 'Permit / tax', amount: 12400, remarks: 'Sept transit permit' },
  { id: 'e3', date: '04 Sep', vehicle: 'KA01 MD 7731', driver: 'Prakash N', category: 'Detention / halting charges', amount: 19800, remarks: '2 days, EWB 1145 0032 8871' },
  { id: 'e4', date: '06 Sep', vehicle: 'TN52 BK 2290', driver: 'Ilango R', category: 'Loan / lease', amount: 56200, remarks: 'EMI' },
  { id: 'e5', date: '07 Sep', vehicle: 'TN38 AB 4412', driver: 'Murugan S', category: 'Insurance', amount: 18400, remarks: 'Goods-in-transit insurance, Q3' },
  { id: 'e6', date: '09 Sep', vehicle: 'TN45 CQ 9087', driver: 'Rafiq A', category: 'Maintenance', amount: 5200, remarks: 'Oil change' }
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Loading charges', 'Unloading charges', 'Weighbridge fee', 'Detention / halting charges', 'Maintenance',
  'Insurance', 'Tyres', 'Permit / tax', 'Loan / lease', 'Fine', 'Other'
];

export const CATEGORY_TINT: Record<string, string> = {
  'Loading charges': 'var(--color-accent-700)',
  'Unloading charges': 'var(--color-accent-500)',
  'Weighbridge fee': 'var(--color-neutral-900)',
  'Detention / halting charges': 'var(--color-accent)',
  'Maintenance': 'var(--color-neutral-500)',
  'Insurance': 'var(--color-neutral-800)',
  'Tyres': 'var(--color-accent-300)',
  'Permit / tax': 'var(--color-neutral-300)',
  'Loan / lease': 'var(--color-accent-400)',
  'Fine': 'var(--color-accent-600)'
};

export const TRIP_EXPENSE_TINT: Record<string, string> = {
  diesel: 'var(--color-accent-700)',
  adblue: 'var(--color-neutral-600)',
  toll: 'var(--color-accent-400)',
  other: 'var(--color-neutral-400)'
};

export const TRIP_EXPENSE_LABEL: Record<string, string> = {
  diesel: 'Diesel',
  adblue: 'AdBlue',
  toll: 'Toll',
  other: 'Other'
};

export const ROLE_TABS: Record<Role, TabId[]> = {
  Driver: ['addtrip', 'triplog'],
  Office: ['addtrip', 'triplog', 'summary', 'expenses', 'people'],
  Manager: ['summary', 'triplog', 'expenses', 'report', 'people', 'schema']
};

export const TAB_LABELS: Record<TabId, string> = {
  summary: 'Movement Summary',
  addtrip: 'Add Movement',
  triplog: 'Trip Log',
  expenses: 'Monthly Expenses',
  report: 'Monthly Report',
  people: 'People',
  schema: 'Data Model'
};

export const DEMO_DRIVER_NAME = 'Murugan S';

export const ROLE_USER: Record<Role, string> = {
  Driver: `${DEMO_DRIVER_NAME} · Driver`,
  Office: 'Kavitha R · Documentation',
  Manager: 'A. Balan · Manager'
};

export const ROLE_NOTE: Record<Role, string> = {
  Driver: 'Driver view — enter trips, see your own log.',
  Office: 'Documentation view — enter movements for any driver, post fixed costs, read the summary.',
  Manager: 'Manager view — full access including the monthly report and the data model.'
};

export const DEMO_ACCOUNTS: { name: string; role: string; key: Role }[] = [
  { name: 'Murugan S · +91 98431 20114', role: 'Driver', key: 'Driver' },
  { name: 'Kavitha R · +91 90031 77402', role: 'Documentation', key: 'Office' },
  { name: 'A. Balan · +91 94440 61928', role: 'Manager', key: 'Manager' }
];

export const USER_ROWS: UserAccount[] = [
  { name: 'A. Balan', role: 'Manager', phone: '+91 94440 61928', branch: 'Chennai HQ', seen: 'Today, 09:12', access: 'All screens, month close', isManager: true },
  { name: 'Kavitha R', role: 'Documentation', phone: '+91 90031 77402', branch: 'Chennai HQ', seen: 'Today, 08:40', access: 'Movements, expenses, summary', isManager: false },
  { name: 'Suresh V', role: 'Documentation', phone: '+91 98847 30215', branch: 'Cochin', seen: 'Yesterday, 18:22', access: 'Movements, expenses, summary', isManager: false },
  { name: 'Murugan S', role: 'Driver', phone: '+91 98431 20114', branch: 'Chennai HQ', seen: 'Today, 07:05', access: 'Own movements only', isManager: false },
  { name: 'Rafiq A', role: 'Driver', phone: '+91 99401 55380', branch: 'Cochin', seen: 'Today, 06:48', access: 'Own movements only', isManager: false },
  { name: 'Prakash N', role: 'Driver', phone: '+91 94433 71206', branch: 'Hosur', seen: '2 days ago', access: 'Own movements only', isManager: false },
  { name: 'Ilango R', role: 'Driver', phone: '+91 90805 44117', branch: 'Chennai HQ', seen: 'Today, 11:30', access: 'Own movements only', isManager: false }
];

export const DRIVER_MASTER: DriverMaster[] = [
  { name: 'Murugan S', licence: 'TN38 20110004412', expiry: '14 Mar 2028', expiring: false, vehicle: 'TN38 AB 4412', credential: 'Yard pass · valid' },
  { name: 'Rafiq A', licence: 'KL07 20140091877', expiry: '02 Nov 2026', expiring: true, vehicle: 'TN45 CQ 9087', credential: 'Yard pass · valid' },
  { name: 'Prakash N', licence: 'KA01 20090037741', expiry: '27 Jun 2027', expiring: false, vehicle: 'KA01 MD 7731', credential: 'Hazmat endorsed' },
  { name: 'Ilango R', licence: 'TN52 20160112290', expiry: '09 Oct 2026', expiring: true, vehicle: 'TN52 BK 2290', credential: 'Yard pass · renew' }
];

export const NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', kind: 'approval', message: 'Ilango R logged TN52 BK 2290 — pending approval', tab: 'triplog', createdAt: '11 Sep, 12:40', read: false, relatedTripId: 't8' },
  { id: 'n2', kind: 'approval', message: 'Prakash N logged KA01 MD 7731 — pending approval', tab: 'triplog', createdAt: '10 Sep, 10:15', read: false, relatedTripId: 't7' },
  { id: 'n3', kind: 'alert', message: "Ilango R's licence expires 09 Oct 2026", tab: 'people', createdAt: '10 Sep, 06:00', read: false },
  { id: 'n4', kind: 'alert', message: "Rafiq A's licence expires 02 Nov 2026", tab: 'people', createdAt: '10 Sep, 06:00', read: false },
  { id: 'n5', kind: 'alert', message: 'TN52 BK 2290 fitness certificate renewal due 04 Nov 2026', tab: 'people', createdAt: '10 Sep, 06:00', read: false },
  { id: 'n6', kind: 'alert', message: 'TN45 CQ 9087 fitness certificate renewal due 29 Sep 2026', tab: 'people', createdAt: '10 Sep, 06:00', read: false }
];

export const SCAN_FIELDS = [
  { label: 'Vendor', value: 'IOCL Krishnagiri' },
  { label: 'Date', value: '11 Sep 2026' },
  { label: 'Diesel litres', value: '162.40' },
  { label: 'Price / litre', value: '₹95.00' },
  { label: 'Amount', value: '₹15,428' },
  { label: 'Vehicle on bill', value: 'TN38 AB 4412' }
];

export const SCHEMA_ENTITIES = [
  { name: 'orgs', tag: 'tenant root', note: 'Every other table carries org_id; row-level security keys off it. One org can be one transporter or one client company — the same schema serves either.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'name', t: 'text' }, { n: 'currency', t: 'char(3)' }, { n: 'fy_start_month', t: 'int' }] },
  { name: 'users', tag: 'auth', note: 'Role decides which screens and which rows are visible.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'role', t: 'driver|office|manager' }, { n: 'phone', t: 'text unique' }, { n: 'driver_id', t: 'fk drivers' }] },
  { name: 'vehicles', tag: 'master', note: 'Soft-deleted, never removed — old trips must still resolve. Fitness certificate renewal drives a reminder job, same as licence expiry.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'reg_no', t: 'text' }, { n: 'model', t: 'text' }, { n: 'tare_kg', t: 'int' }, { n: 'fc_date', t: 'date' }, { n: 'fc_renewal_due', t: 'date' }, { n: 'active', t: 'bool' }] },
  { name: 'drivers', tag: 'master', note: 'Licence expiry drives a reminder job.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'name', t: 'text' }, { n: 'licence_no', t: 'text' }, { n: 'licence_expiry', t: 'date' }] },
  { name: 'trips', tag: 'fact · hot', note: 'The whole trade record now lives directly on the trip — a plain waybill and item reference, not a shipment/container hierarchy. Partitioned monthly on load_date.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'vehicle_id', t: 'fk vehicles' }, { n: 'driver_id', t: 'fk drivers' }, { n: 'waybill_no', t: 'text' }, { n: 'item_no', t: 'text' }, { n: 'load_date', t: 'date' }, { n: 'unload_date', t: 'date' }, { n: 'from_loc / to_loc', t: 'text' }, { n: 'weight_kg', t: 'int' }, { n: 'odo_start / odo_end', t: 'int' }, { n: 'revenue_paise', t: 'bigint' }, { n: 'status', t: 'draft|pending|approved' }] },
  { name: 'trip_expenses', tag: 'fact · hot', note: "One row per fuel stop or cost line, so a 3-day trip with two diesel fill-ups and an AdBlue top-up is three rows, not one flattened total. details is required when kind = 'other'.", fields: [{ n: 'id', t: 'uuid pk' }, { n: 'trip_id', t: 'fk trips' }, { n: 'spent_on', t: 'date' }, { n: 'kind', t: 'diesel|adblue|toll|other' }, { n: 'litres', t: 'numeric' }, { n: 'rate_paise', t: 'bigint' }, { n: 'amount_paise', t: 'bigint' }, { n: 'details', t: 'text' }, { n: 'receipt_id', t: 'fk receipts' }] },
  { name: 'trip_documents', tag: 'fact', note: 'Any supporting file a driver attaches to a trip — waybill copy, weighbridge slip — beyond the fuel receipts already linked from trip_expenses.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'trip_id', t: 'fk trips' }, { n: 'receipt_id', t: 'fk receipts' }, { n: 'doc_type', t: 'waybill|weighbridge|other' }] },
  { name: 'monthly_expenses', tag: 'fact', note: 'Fixed vehicle-side costs: permits, insurance, EMI, halting charges — costs that belong to the truck for the month, not to one trip.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'vehicle_id', t: 'fk vehicles' }, { n: 'spent_on', t: 'date' }, { n: 'category', t: 'enum' }, { n: 'amount_paise', t: 'bigint' }, { n: 'remarks', t: 'text' }] },
  { name: 'receipts', tag: 'blob + OCR', note: 'File in object storage; parsed fields kept with a confidence score — fuel bills today, odometer photos next.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'storage_key', t: 'text' }, { n: 'ocr_json', t: 'jsonb' }, { n: 'confidence', t: 'numeric' }, { n: 'uploaded_by', t: 'fk users' }] },
  { name: 'audit_log', tag: 'append only', note: "Who changed what, when — a closed month can still be explained.", fields: [{ n: 'id', t: 'bigserial pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'entity / entity_id', t: 'text / uuid' }, { n: 'action', t: 'text' }, { n: 'diff', t: 'jsonb' }, { n: 'actor_id', t: 'fk users' }, { n: 'at', t: 'timestamptz' }] }
];

export const SCHEMA_RELATIONS = [
  'orgs 1 ──< users · vehicles · drivers · trips · monthly_expenses',
  'vehicles 1 ──< trips ──< trip_expenses >── receipts',
  'trips 1 ──< trip_documents >── receipts',
  'drivers 1 ──< trips (driver_id nullable for office entries)',
  'vehicles 1 ──< monthly_expenses (no trip link — fixed cost)',
  'users 1 ──< audit_log (actor_id) · receipts (uploaded_by)'
];

export const SCHEMA_ENDPOINTS = [
  { method: 'POST', path: '/trips', desc: 'Idempotent on the client uuid — safe to retry from a phone with no signal.' },
  { method: 'GET', path: '/trips?from&to&vehicle&driver&cursor', desc: 'Keyset pagination on (load_date, id). No offset scans.' },
  { method: 'POST', path: '/trips/:id/expenses', desc: 'Add one fuel/AdBlue/toll/other line to an open trip — called once per stop, not once per trip.' },
  { method: 'POST', path: '/receipts:upload-url', desc: 'Signed URL; the file never passes through the API. OCR runs as a queued job.' },
  { method: 'POST', path: '/trips/:id/documents', desc: 'Attach an uploaded receipt as a general trip document (waybill copy, weighbridge slip).' },
  { method: 'GET', path: '/summary?month&vehicle', desc: 'Reads vehicle_month, not raw trips — constant cost as the log grows.' },
  { method: 'POST', path: '/monthly-expenses', desc: 'Office and manager only; writes an audit_log row with the diff.' },
  { method: 'POST', path: '/months/2026-09:close', desc: 'Freezes the month; later edits become adjustments, never silent rewrites.' }
];

export const SCHEMA_SCALING = [
  { label: 'Multi-tenant by design', body: 'org_id on every table plus row-level security means one deployment can host many transport companies — or many fleets within one — without cross-tenant leakage.' },
  { label: 'Partitioning', body: 'trips and trip_expenses partition by month. A query for September touches one partition; closed months can be moved to cheaper storage untouched. Holds at 100+ vehicles per org the same way it holds at 4.' },
  { label: 'Read path', body: 'Summary and report screens read a materialised monthly rollup per vehicle, refreshed on write. Dashboards never scan raw trips.' },
  { label: 'Offline first', body: 'iOS and Android queue trips and expense lines locally with a client-generated uuid; the API is idempotent on that id, so a retry after signal returns never duplicates a trip or a fuel stop.' },
  { label: 'Files', body: 'Receipts and documents go to object storage with a signed upload URL; OCR runs as a queued job and writes back to receipts.ocr_json — the same pipeline for fuel bills today and odometer photos next.' }
];
