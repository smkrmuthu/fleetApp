import type {
  AppNotification, DriverMaster, ExpenseCategory, MonthlyExpense, NotificationKind,
  Role, TabId, Trip, TripExpenseKind, TripExpenseLine, UserAccount, Vehicle
} from '../types';

const API_BASE = 'https://fleet-ledger-api.smkrmuthu.workers.dev/v1';
const TOKEN_KEY = 'fleet_ledger_token';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error?.message ?? `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

// ── money & dates ────────────────────────────────────────────────────────
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
function paiseToRupees(paise: number | null | undefined): number {
  return (paise ?? 0) / 100;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}
export function parseDisplayDate(display: string): string {
  const m = display.match(/^(\d{2}) (\w{3}) (\d{4})$/);
  if (!m) return '';
  const monthIdx = MONTHS.indexOf(m[2]);
  if (monthIdx < 0) return '';
  return `${m[3]}-${String(monthIdx + 1).padStart(2, '0')}-${m[1]}`;
}
function formatSeen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso);
  const now = new Date();
  const sameDay = then.toDateString() === now.toDateString();
  const time = then.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay) return `Today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (then.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return formatDisplayDate(iso.slice(0, 10));
}

// ── role & category mapping ─────────────────────────────────────────────
type ApiRole = 'driver' | 'office' | 'manager';
const ROLE_FROM_API: Record<ApiRole, Role> = { driver: 'Driver', office: 'Office', manager: 'Manager' };
const ROLE_ACCESS: Record<ApiRole, string> = {
  manager: 'All screens, month close',
  office: 'Movements, expenses, summary',
  driver: 'Own movements only'
};

const CATEGORY_TO_API: Record<ExpenseCategory, string> = {
  'Loading charges': 'loading_charges',
  'Unloading charges': 'unloading_charges',
  'Weighbridge fee': 'weighbridge_fee',
  'Detention / halting charges': 'detention',
  'Maintenance': 'maintenance',
  'Insurance': 'insurance',
  'Tyres': 'tyres',
  'Permit / tax': 'permit_tax',
  'Loan / lease': 'loan_lease',
  'Fine': 'fine',
  'Other': 'other'
};
const CATEGORY_FROM_API: Record<string, ExpenseCategory> = Object.fromEntries(
  Object.entries(CATEGORY_TO_API).map(([display, api]) => [api, display as ExpenseCategory])
);

// Forms fall back to the '—' placeholder for an empty optional field (it's
// what the read side already displays for "no value") — treat it the same
// as empty when going the other way, into a wire payload.
function orUndefined(value: string): string | undefined {
  return value && value !== '—' ? value : undefined;
}
function orUndefinedOpt(value: string | undefined): string | undefined {
  return value === undefined ? undefined : orUndefined(value);
}

const BRANCH_NAME: Record<string, string> = {
  'branch-chennai': 'Chennai HQ',
  'branch-cochin': 'Cochin',
  'branch-hosur': 'Hosur'
};

// ── auth ─────────────────────────────────────────────────────────────────
export async function login(phone: string, password: string): Promise<{ role: Role; name: string }> {
  const res = await request<{ access: string; user: { name: string; role: ApiRole } }>('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ phone, password })
  });
  setToken(res.access);
  return { role: ROLE_FROM_API[res.user.role], name: res.user.name };
}

export async function restoreSession(): Promise<{ role: Role; name: string } | null> {
  if (!getToken()) return null;
  try {
    const me = await request<{ name: string; role: ApiRole }>('/auth/me');
    return { role: ROLE_FROM_API[me.role], name: me.name };
  } catch {
    clearToken();
    return null;
  }
}

// ── vehicles ─────────────────────────────────────────────────────────────
interface ApiVehicle {
  id: string; model: string | null; fcDate: string | null; fcRenewalDue: string | null; renewalDue: boolean;
}

function vehicleFromApi(v: ApiVehicle): Vehicle {
  return { id: v.id, model: v.model ?? '—', fcDate: formatDisplayDate(v.fcDate), renewalDate: formatDisplayDate(v.fcRenewalDue), renewalDue: v.renewalDue };
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const res = await request<{ vehicles: ApiVehicle[] }>('/vehicles');
  return res.vehicles.map(vehicleFromApi);
}

export async function createVehicle(v: { id: string; model: string; fcDate: string; renewalDate: string }): Promise<void> {
  await request('/vehicles', {
    method: 'POST',
    body: JSON.stringify({ regNo: v.id, model: v.model, fcDate: orUndefined(v.fcDate), fcRenewalDue: orUndefined(v.renewalDate) })
  });
}

export async function deleteVehicle(id: string): Promise<void> {
  await request(`/vehicles/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── drivers ──────────────────────────────────────────────────────────────
interface ApiDriver {
  id: string; fullName: string; licenceNo: string | null; licenceExpiry: string | null; expiring: boolean; credential: string | null; defaultVehicle: string | null;
}

function driverFromApi(d: ApiDriver): DriverMaster {
  return { name: d.fullName, licence: d.licenceNo ?? '—', expiry: formatDisplayDate(d.licenceExpiry), expiring: d.expiring, vehicle: d.defaultVehicle ?? '—', credential: d.credential ?? '—' };
}

export async function fetchDrivers(): Promise<DriverMaster[]> {
  const res = await request<{ drivers: ApiDriver[] }>('/drivers');
  return res.drivers.map(driverFromApi);
}

export async function createDriver(d: { name: string; licence: string; expiry: string; vehicle: string }): Promise<void> {
  await request('/drivers', {
    method: 'POST',
    body: JSON.stringify({ fullName: d.name, licenceNo: orUndefined(d.licence), licenceExpiry: orUndefined(d.expiry), defaultVehicle: orUndefined(d.vehicle) })
  });
}

export async function deleteDriver(name: string): Promise<void> {
  await request(`/drivers/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// ── users ────────────────────────────────────────────────────────────────
interface ApiUser {
  id: string; fullName: string; role: ApiRole; phone: string; branchId: string | null; lastSeenAt: string | null;
}

function userFromApi(u: ApiUser): UserAccount & { id: string } {
  const roleLabel = u.role === 'office' ? 'Documentation' : u.role === 'manager' ? 'Manager' : 'Driver';
  return {
    id: u.id, name: u.fullName, role: roleLabel, phone: u.phone,
    branch: (u.branchId && BRANCH_NAME[u.branchId]) ?? '—',
    access: ROLE_ACCESS[u.role], seen: formatSeen(u.lastSeenAt), isManager: u.role === 'manager'
  };
}

export async function fetchUsers(): Promise<(UserAccount & { id: string })[]> {
  const res = await request<{ users: ApiUser[] }>('/users');
  return res.users.map(userFromApi);
}

export async function deleteUser(id: string): Promise<void> {
  await request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── monthly expenses ─────────────────────────────────────────────────────
interface ApiMonthlyExpense {
  id: string; vehicleId: string; driverId: string | null; spentOn: string; category: string; amountPaise: number; remarks: string | null;
}

function monthlyExpenseFromApi(e: ApiMonthlyExpense): MonthlyExpense {
  return {
    id: e.id, date: formatDisplayDate(e.spentOn), vehicle: e.vehicleId, driver: e.driverId ?? '—',
    category: CATEGORY_FROM_API[e.category] ?? 'Other', amount: paiseToRupees(e.amountPaise), remarks: e.remarks ?? '—'
  };
}

export async function fetchMonthlyExpenses(): Promise<MonthlyExpense[]> {
  const res = await request<{ monthlyExpenses: ApiMonthlyExpense[] }>('/monthly-expenses');
  return res.monthlyExpenses.map(monthlyExpenseFromApi);
}

export async function createMonthlyExpense(e: { vehicle: string; driver: string; date: string; category: ExpenseCategory; amount: number; remarks: string }): Promise<void> {
  await request('/monthly-expenses', {
    method: 'POST',
    body: JSON.stringify({
      vehicleId: e.vehicle, driverId: orUndefined(e.driver), spentOn: e.date,
      category: CATEGORY_TO_API[e.category], amountPaise: rupeesToPaise(e.amount), remarks: e.remarks || undefined
    })
  });
}

// ── trips ────────────────────────────────────────────────────────────────
interface ApiTripExpense {
  id: string; spentOn: string; kind: TripExpenseKind; litres: number | null; ratePaise: number | null; amountPaise: number; details: string | null;
}
interface ApiTrip {
  id: string; vehicleId: string; driverId: string | null; waybillNo: string | null; itemNo: string | null;
  loadDate: string; unloadDate: string | null; fromLoc: string | null; toLoc: string | null; weightKg: number | null;
  odoStart: number | null; odoEnd: number | null; revenuePaise: number; status: 'draft' | 'pending' | 'approved' | 'void';
  expenses: ApiTripExpense[];
}

function tripFromApi(t: ApiTrip): Trip {
  return {
    id: t.id, loadDate: formatDisplayDate(t.loadDate), unloadDate: formatDisplayDate(t.unloadDate),
    vehicle: t.vehicleId, driver: t.driverId ?? '—', waybillNo: t.waybillNo ?? '—', itemNo: t.itemNo ?? '—',
    from: t.fromLoc ?? '—', to: t.toLoc ?? '—', tons: (t.weightKg ?? 0) / 1000, km: Math.max(0, (t.odoEnd ?? 0) - (t.odoStart ?? 0)),
    odoStart: t.odoStart ?? undefined, odoEnd: t.odoEnd ?? undefined,
    revenue: paiseToRupees(t.revenuePaise), status: t.status === 'void' ? 'approved' : t.status,
    expenses: t.expenses.map((e) => ({
      id: e.id, date: formatDisplayDate(e.spentOn), kind: e.kind, litres: e.litres ?? undefined,
      ratePerLitre: e.ratePaise != null ? paiseToRupees(e.ratePaise) : undefined, amount: paiseToRupees(e.amountPaise), details: e.details ?? undefined
    })),
    documents: [] // documents aren't persisted server-side yet — see worker/README.md
  };
}

export async function fetchTrips(params: { vehicleId?: string; status?: string } = {}): Promise<Trip[]> {
  const qs = new URLSearchParams();
  if (params.vehicleId) qs.set('vehicle_id', params.vehicleId);
  if (params.status) qs.set('status', params.status);
  qs.set('limit', '200');
  const res = await request<{ trips: ApiTrip[] }>(`/trips?${qs.toString()}`);
  return res.trips.map(tripFromApi);
}

export interface NewTripInput {
  id: string; vehicle: string; driver: string; waybillNo: string; itemNo: string; loadDate: string; unloadDate: string;
  from: string; to: string; tons: number; odoStart: number; odoEnd: number; revenue: number; remarks?: string;
  expenses: TripExpenseLine[];
  draft?: boolean;
}

export async function createTrip(t: NewTripInput): Promise<Trip> {
  const res = await request<ApiTrip>('/trips', {
    method: 'POST',
    body: JSON.stringify({
      id: t.id, vehicleId: t.vehicle, driverId: orUndefined(t.driver), waybillNo: orUndefined(t.waybillNo),
      itemNo: orUndefined(t.itemNo), loadDate: t.loadDate, unloadDate: orUndefined(t.unloadDate),
      fromLoc: orUndefined(t.from), toLoc: orUndefined(t.to), weightKg: Math.round(t.tons * 1000) || undefined,
      odoStart: t.odoStart || undefined, odoEnd: t.odoEnd || undefined, revenuePaise: rupeesToPaise(t.revenue),
      remarks: t.remarks || undefined, draft: t.draft || undefined,
      expenses: t.expenses.map((l) => ({
        spentOn: l.date, kind: l.kind, litres: l.litres, ratePaise: l.ratePerLitre != null ? rupeesToPaise(l.ratePerLitre) : undefined,
        amountPaise: rupeesToPaise(l.amount), details: l.details
      }))
    })
  });
  return tripFromApi({ ...res, expenses: (res as any).expenses ?? [] });
}

export interface TripPatchInput {
  vehicle?: string; waybillNo?: string; itemNo?: string; loadDate?: string; unloadDate?: string;
  from?: string; to?: string; tons?: number; odoStart?: number; odoEnd?: number; revenue?: number; remarks?: string;
}

export async function updateTrip(id: string, patch: TripPatchInput): Promise<Trip> {
  const res = await request<ApiTrip>(`/trips/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      vehicleId: patch.vehicle, waybillNo: orUndefinedOpt(patch.waybillNo), itemNo: orUndefinedOpt(patch.itemNo),
      loadDate: patch.loadDate, unloadDate: orUndefinedOpt(patch.unloadDate), fromLoc: orUndefinedOpt(patch.from),
      toLoc: orUndefinedOpt(patch.to), weightKg: patch.tons != null ? Math.round(patch.tons * 1000) : undefined,
      odoStart: patch.odoStart, odoEnd: patch.odoEnd, revenuePaise: patch.revenue != null ? rupeesToPaise(patch.revenue) : undefined,
      remarks: orUndefinedOpt(patch.remarks)
    })
  });
  return tripFromApi({ ...res, expenses: [] });
}

export async function completeTrip(id: string, odoEnd: number, unloadDate?: string, remarks?: string): Promise<void> {
  await request(`/trips/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ odoEnd, unloadDate: orUndefined(unloadDate ?? ''), remarks: orUndefined(remarks ?? '') })
  });
}

export async function addTripExpense(tripId: string, line: TripExpenseLine): Promise<void> {
  await request(`/trips/${encodeURIComponent(tripId)}/expenses`, {
    method: 'POST',
    body: JSON.stringify({
      spentOn: line.date, kind: line.kind, litres: line.litres,
      ratePaise: line.ratePerLitre != null ? rupeesToPaise(line.ratePerLitre) : undefined,
      amountPaise: rupeesToPaise(line.amount), details: line.details
    })
  });
}

export async function approveTrip(id: string): Promise<void> {
  await request(`/trips/${encodeURIComponent(id)}/approve`, { method: 'POST' });
}

// ── notifications ────────────────────────────────────────────────────────
interface ApiNotification {
  id: string; kind: NotificationKind; message: string; tab: TabId; relatedTripId: string | null; read: boolean; createdAt: string;
}

function notificationFromApi(n: ApiNotification): AppNotification {
  return { id: n.id, kind: n.kind, message: n.message, tab: n.tab, read: n.read, relatedTripId: n.relatedTripId ?? undefined, createdAt: formatSeen(n.createdAt) };
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await request<{ notifications: ApiNotification[] }>('/notifications');
  return res.notifications.map(notificationFromApi);
}

export async function markNotificationRead(id: string): Promise<void> {
  await request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await request('/notifications/read-all', { method: 'POST' });
}
