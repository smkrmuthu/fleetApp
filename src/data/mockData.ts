import type { ExpenseCategory, MonthlyExpense, Role, TabId, Trip, Vehicle } from '../types';

export const VEHICLES: Vehicle[] = [
  { id: 'TN38 AB 4412', model: 'Tata Signa 4825' },
  { id: 'TN45 CQ 9087', model: 'Ashok Leyland 3520' },
  { id: 'KA01 MD 7731', model: 'BharatBenz 2823' },
  { id: 'TN52 BK 2290', model: 'Eicher Pro 6028' }
];

export const TRIPS: Trip[] = [
  { id: 't1', loadDate: '02 Sep', unloadDate: '03 Sep', vehicle: 'TN38 AB 4412', driver: 'Murugan S', direction: 'Import', bl: 'MAEU-2290184', container: 'MSKU 704118-2', from: 'Chennai Port', to: 'Sriperumbudur ICD', tons: 24.5, km: 342, litres: 118, pricePerLitre: 95, toll: 1840, other: 900, revenue: 34500, status: 'approved' },
  { id: 't2', loadDate: '03 Sep', unloadDate: '04 Sep', vehicle: 'TN45 CQ 9087', driver: 'Rafiq A', direction: 'Export', bl: 'CMDU-7741903', container: 'CMAU 338206-4', from: 'Tirupur factory', to: 'Cochin Port', tons: 18.0, km: 372, litres: 131, pricePerLitre: 94, toll: 2100, other: 1250, revenue: 31800, status: 'approved' },
  { id: 't3', loadDate: '05 Sep', unloadDate: '05 Sep', vehicle: 'KA01 MD 7731', driver: 'Prakash N', direction: 'Import', bl: 'HLCU-5512760', container: 'HLXU 901744-8', from: 'Ennore Port', to: 'Hosur warehouse', tons: 21.2, km: 208, litres: 74, pricePerLitre: 96, toll: 980, other: 450, revenue: 19400, status: 'approved' },
  { id: 't4', loadDate: '06 Sep', unloadDate: '08 Sep', vehicle: 'TN52 BK 2290', driver: 'Ilango R', direction: 'Export', bl: 'ONEY-3308472', container: 'TCNU 662015-3', from: 'Hosur warehouse', to: 'Cochin Port', tons: 26.0, km: 692, litres: 246, pricePerLitre: 95, toll: 3640, other: 2100, revenue: 68200, status: 'approved' },
  { id: 't5', loadDate: '08 Sep', unloadDate: '09 Sep', vehicle: 'TN38 AB 4412', driver: 'Murugan S', direction: 'Import', bl: 'MAEU-2291736', container: 'MRKU 448190-1', from: 'Chennai Port', to: 'Vijayawada CFS', tons: 25.0, km: 456, litres: 162, pricePerLitre: 95, toll: 2380, other: 1150, revenue: 41900, status: 'approved' },
  { id: 't6', loadDate: '09 Sep', unloadDate: '10 Sep', vehicle: 'TN45 CQ 9087', driver: 'Rafiq A', direction: 'Export', bl: 'MSCU-6604821', container: 'MSCU 512377-6', from: 'Hyderabad plant', to: 'Krishnapatnam Port', tons: 19.5, km: 574, litres: 205, pricePerLitre: 96, toll: 2960, other: 1400, revenue: 47600, status: 'approved' },
  { id: 't7', loadDate: '10 Sep', unloadDate: '10 Sep', vehicle: 'KA01 MD 7731', driver: 'Prakash N', direction: 'Import', bl: 'HLCU-5514028', container: 'HLBU 220964-7', from: 'Ennore Port', to: 'Erode CFS', tons: 22.0, km: 98, litres: 36, pricePerLitre: 95, toll: 420, other: 260, revenue: 8600, status: 'pending' },
  { id: 't8', loadDate: '11 Sep', unloadDate: '12 Sep', vehicle: 'TN52 BK 2290', driver: 'Ilango R', direction: 'Export', bl: 'ONEY-3309915', container: 'TGHU 774301-9', from: 'Madurai factory', to: 'Tuticorin Port', tons: 23.4, km: 268, litres: 97, pricePerLitre: 95, toll: 1180, other: 640, revenue: 24800, status: 'pending' }
];

export const MONTHLY_EXPENSES: MonthlyExpense[] = [
  { id: 'e1', date: '01 Sep', vehicle: 'TN38 AB 4412', driver: 'Murugan S', category: 'CFS / port charges', amount: 28600, remarks: 'MAEU-2290184 · ground rent' },
  { id: 'e2', date: '02 Sep', vehicle: 'TN45 CQ 9087', driver: 'Rafiq A', category: 'CHA fee', amount: 12400, remarks: 'Sept clearances' },
  { id: 'e3', date: '04 Sep', vehicle: 'KA01 MD 7731', driver: 'Prakash N', category: 'Detention / demurrage', amount: 19800, remarks: '2 days, HLCU-5512760' },
  { id: 'e4', date: '06 Sep', vehicle: 'TN52 BK 2290', driver: 'Ilango R', category: 'Loan / lease', amount: 56200, remarks: 'EMI' },
  { id: 'e5', date: '07 Sep', vehicle: 'TN38 AB 4412', driver: 'Murugan S', category: 'Insurance', amount: 18400, remarks: 'Marine cargo, Q3' },
  { id: 'e6', date: '09 Sep', vehicle: 'TN45 CQ 9087', driver: 'Rafiq A', category: 'Maintenance', amount: 5200, remarks: 'Oil change' }
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'CFS / port charges', 'Customs duty', 'CHA fee', 'Detention / demurrage', 'Maintenance',
  'Insurance', 'Tyres', 'Permit / tax', 'Loan / lease', 'Fine', 'Other'
];

export const CATEGORY_TINT: Record<string, string> = {
  'CFS / port charges': 'var(--color-accent-700)',
  'Customs duty': 'var(--color-neutral-900)',
  'CHA fee': 'var(--color-neutral-600)',
  'Detention / demurrage': 'var(--color-accent)',
  'Maintenance': 'var(--color-neutral-500)',
  'Insurance': 'var(--color-neutral-800)',
  'Tyres': 'var(--color-accent-300)',
  'Permit / tax': 'var(--color-neutral-300)',
  'Loan / lease': 'var(--color-accent-400)',
  'Fine': 'var(--color-accent-600)'
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

export const ROLE_USER: Record<Role, string> = {
  Driver: 'Murugan S · Driver',
  Office: 'Kavitha R · Documentation',
  Manager: 'A. Balan · Manager'
};

export const ROLE_NOTE: Record<Role, string> = {
  Driver: 'Driver view — enter trips, see your own log.',
  Office: 'Documentation view — enter movements for any driver, post shipment costs, read the summary.',
  Manager: 'Manager view — full access including the monthly report and the data model.'
};

export const DEMO_ACCOUNTS: { name: string; role: string; key: Role }[] = [
  { name: 'Murugan S · +91 98431 20114', role: 'Driver', key: 'Driver' },
  { name: 'Kavitha R · +91 90031 77402', role: 'Documentation', key: 'Office' },
  { name: 'A. Balan · +91 94440 61928', role: 'Manager', key: 'Manager' }
];

export const USER_ROWS = [
  { name: 'A. Balan', role: 'Manager', phone: '+91 94440 61928', branch: 'Chennai HQ', seen: 'Today, 09:12', access: 'All screens, month close', isManager: true },
  { name: 'Kavitha R', role: 'Documentation', phone: '+91 90031 77402', branch: 'Chennai HQ', seen: 'Today, 08:40', access: 'Movements, expenses, summary', isManager: false },
  { name: 'Suresh V', role: 'Documentation', phone: '+91 98847 30215', branch: 'Cochin', seen: 'Yesterday, 18:22', access: 'Movements, expenses, summary', isManager: false },
  { name: 'Murugan S', role: 'Driver', phone: '+91 98431 20114', branch: 'Chennai HQ', seen: 'Today, 07:05', access: 'Own movements only', isManager: false },
  { name: 'Rafiq A', role: 'Driver', phone: '+91 99401 55380', branch: 'Cochin', seen: 'Today, 06:48', access: 'Own movements only', isManager: false },
  { name: 'Prakash N', role: 'Driver', phone: '+91 94433 71206', branch: 'Hosur', seen: '2 days ago', access: 'Own movements only', isManager: false },
  { name: 'Ilango R', role: 'Driver', phone: '+91 90805 44117', branch: 'Chennai HQ', seen: 'Today, 11:30', access: 'Own movements only', isManager: false }
];

export const DRIVER_MASTER = [
  { name: 'Murugan S', licence: 'TN38 20110004412', expiry: '14 Mar 2028', expiring: false, vehicle: 'TN38 AB 4412', credential: 'Port pass · valid' },
  { name: 'Rafiq A', licence: 'KL07 20140091877', expiry: '02 Nov 2026', expiring: true, vehicle: 'TN45 CQ 9087', credential: 'Port pass · valid' },
  { name: 'Prakash N', licence: 'KA01 20090037741', expiry: '27 Jun 2027', expiring: false, vehicle: 'KA01 MD 7731', credential: 'Hazmat endorsed' },
  { name: 'Ilango R', licence: 'TN52 20160112290', expiry: '09 Oct 2026', expiring: true, vehicle: 'TN52 BK 2290', credential: 'Port pass · renew' }
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
  { name: 'orgs', tag: 'tenant root', note: 'Every other table carries org_id; row-level security keys off it.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'name', t: 'text' }, { n: 'currency', t: 'char(3)' }, { n: 'fy_start_month', t: 'int' }] },
  { name: 'users', tag: 'auth', note: 'Role decides which screens and which rows are visible.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'role', t: 'driver|office|manager' }, { n: 'phone', t: 'text unique' }, { n: 'driver_id', t: 'fk drivers' }] },
  { name: 'vehicles', tag: 'master', note: 'Soft-deleted, never removed — old trips must still resolve.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'reg_no', t: 'text' }, { n: 'model', t: 'text' }, { n: 'tare_kg', t: 'int' }, { n: 'active', t: 'bool' }] },
  { name: 'drivers', tag: 'master', note: 'Licence expiry drives a reminder job.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'name', t: 'text' }, { n: 'licence_no', t: 'text' }, { n: 'licence_expiry', t: 'date' }] },
  { name: 'shipments', tag: 'trade root', note: 'A BL can need several movements; costs hang off the shipment, not the truck.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'bl_no', t: 'text' }, { n: 'direction', t: 'import|export' }, { n: 'port_code', t: 'text (UN/LOCODE)' }, { n: 'consignee_id', t: 'fk parties' }, { n: 'cha_id', t: 'fk parties' }, { n: 'cleared_on', t: 'date' }, { n: 'incoterm', t: 'text' }] },
  { name: 'containers', tag: 'master', note: 'One shipment, many containers; size decides the haulage rate.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'shipment_id', t: 'fk shipments' }, { n: 'container_no', t: 'text' }, { n: 'size_type', t: '20GP|40HC|…' }, { n: 'seal_no', t: 'text' }, { n: 'gross_kg', t: 'int' }] },
  { name: 'trips', tag: 'fact · hot', note: 'Partitioned monthly on load_date; index (org_id, vehicle_id, load_date).', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'vehicle_id', t: 'fk vehicles' }, { n: 'driver_id', t: 'fk drivers' }, { n: 'shipment_id', t: 'fk shipments' }, { n: 'container_id', t: 'fk containers' }, { n: 'load_date', t: 'date' }, { n: 'unload_date', t: 'date' }, { n: 'from_loc / to_loc', t: 'text' }, { n: 'weight_kg', t: 'int' }, { n: 'odo_start / odo_end', t: 'int' }, { n: 'revenue_paise', t: 'bigint' }, { n: 'status', t: 'draft|pending|approved' }] },
  { name: 'trip_expenses', tag: 'fact · hot', note: 'One row per cost line so diesel, toll and other stay separable.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'trip_id', t: 'fk trips' }, { n: 'kind', t: 'diesel|toll|other' }, { n: 'litres', t: 'numeric' }, { n: 'rate_paise', t: 'bigint' }, { n: 'amount_paise', t: 'bigint' }, { n: 'receipt_id', t: 'fk receipts' }] },
  { name: 'monthly_expenses', tag: 'fact', note: 'Shipment-side and fixed costs: CFS, CHA, duty, detention, EMI. Either a vehicle or a shipment, never both required.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'vehicle_id', t: 'fk vehicles' }, { n: 'shipment_id', t: 'fk shipments' }, { n: 'spent_on', t: 'date' }, { n: 'category', t: 'enum' }, { n: 'amount_paise', t: 'bigint' }, { n: 'remarks', t: 'text' }] },
  { name: 'receipts', tag: 'blob + OCR', note: 'File in object storage; parsed fields kept with a confidence score.', fields: [{ n: 'id', t: 'uuid pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'storage_key', t: 'text' }, { n: 'ocr_json', t: 'jsonb' }, { n: 'confidence', t: 'numeric' }, { n: 'uploaded_by', t: 'fk users' }] },
  { name: 'audit_log', tag: 'append only', note: "Who changed what, when — a closed month can still be explained.", fields: [{ n: 'id', t: 'bigserial pk' }, { n: 'org_id', t: 'fk orgs' }, { n: 'entity / entity_id', t: 'text / uuid' }, { n: 'action', t: 'text' }, { n: 'diff', t: 'jsonb' }, { n: 'actor_id', t: 'fk users' }, { n: 'at', t: 'timestamptz' }] }
];

export const SCHEMA_RELATIONS = [
  'orgs 1 ──< users · vehicles · drivers · shipments · trips · monthly_expenses',
  'shipments 1 ──< containers 1 ──< trips (one BL, many moves)',
  'shipments 1 ──< monthly_expenses (CFS, CHA, duty, detention)',
  'vehicles 1 ──< trips ──< trip_expenses >── receipts',
  'drivers 1 ──< trips (driver_id nullable for office entries)',
  'vehicles 1 ──< monthly_expenses (no trip link — fixed cost)',
  'users 1 ──< audit_log (actor_id) · receipts (uploaded_by)'
];

export const SCHEMA_ENDPOINTS = [
  { method: 'POST', path: '/trips', desc: 'Idempotent on the client uuid — safe to retry from a phone with no signal.' },
  { method: 'GET', path: '/trips?from&to&vehicle&driver&cursor', desc: 'Keyset pagination on (load_date, id). No offset scans.' },
  { method: 'POST', path: '/receipts:upload-url', desc: 'Signed URL; the file never passes through the API. OCR runs as a queued job.' },
  { method: 'GET', path: '/summary?month&vehicle&direction', desc: 'Reads vehicle_month, not raw trips — constant cost as the log grows.' },
  { method: 'GET', path: '/shipments/:bl', desc: 'One BL with its containers, movements and cost lines — the landed cost of a consignment.' },
  { method: 'POST', path: '/monthly-expenses', desc: 'Office and manager only; writes an audit_log row with the diff.' },
  { method: 'POST', path: '/months/2026-09:close', desc: 'Freezes the month; later edits become adjustments, never silent rewrites.' }
];

export const SCHEMA_SCALING = [
  { label: 'Partitioning', body: 'trips and trip_expenses partition by month. A query for September touches one partition; closed months can be moved to cheaper storage untouched.' },
  { label: 'Read path', body: 'Summary and report screens read a materialised monthly rollup per vehicle, refreshed on write. Dashboards never scan raw trips.' },
  { label: 'Offline first', body: 'iOS and Android queue trips locally with a client-generated uuid; the API is idempotent on that id, so a retry after signal returns never duplicates a trip.' },
  { label: 'Files', body: 'Receipts go to object storage with a signed upload URL; OCR runs as a queued job and writes back to receipts.ocr_json.' }
];
