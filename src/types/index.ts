export type Role = 'Driver' | 'Office' | 'Manager';

export type TabId = 'summary' | 'addtrip' | 'triplog' | 'expenses' | 'report' | 'people' | 'master' | 'schema';

// 'draft' is a trip a driver has started but not yet completed — a
// multi-day trip logs fuel stops against it before Complete flips it to
// 'pending' for approval.
export type TripStatus = 'draft' | 'pending' | 'approved';

export interface Vehicle {
  id: string;
  model: string;
  fcDate: string;
  renewalDate: string;
  renewalDue: boolean;
  // '' when the truck has no default driver.
  defaultDriver?: string;
}

export interface FuelRates {
  dieselRate: number | null;
  adblueRate: number | null;
}

export interface DriverMaster {
  name: string;
  licence: string;
  expiry: string;
  expiring: boolean;
  vehicle: string;
  credential: string;
}

export type NotificationKind = 'approval' | 'alert';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  message: string;
  tab: TabId;
  createdAt: string;
  read: boolean;
  relatedTripId?: string;
}

export interface UserAccount {
  name: string;
  role: string;
  phone: string;
  branch: string;
  access: string;
  seen: string;
  isManager: boolean;
  roleKey?: 'driver' | 'office' | 'manager';
  branchId?: string;
}

// A trip can run several days with several fuel/AdBlue stops along the way —
// each stop is its own line rather than one flat total for the whole trip.
export type TripExpenseKind = 'diesel' | 'adblue' | 'toll' | 'other';

export interface TripExpenseLine {
  id: string;
  date: string;
  kind: TripExpenseKind;
  litres?: number;
  ratePerLitre?: number;
  amount: number;
  details?: string;
}

// `base64` is only ever set for a document staged locally in the Add
// Movement form before it's uploaded — a document that came back from the
// API never carries it.
// An intermediate stop between a trip's loading point and its final unloading point.
export interface TripStop {
  id: string;
  location: string;
  note?: string;
}

export interface TripDocument {
  id: string;
  filename: string;
  mimeType?: string;
  base64?: string;
}

export interface Trip {
  id: string;
  loadDate: string;
  unloadDate: string;
  vehicle: string;
  driver: string;
  waybillNo: string;
  itemNo: string;
  from: string;
  to: string;
  tons: number;
  km: number;
  odoStart?: number;
  odoEnd?: number;
  revenue: number;
  status: TripStatus;
  remarks?: string;
  expenses: TripExpenseLine[];
  stops: TripStop[];
  documents: TripDocument[];
}

export type ExpenseCategory =
  | 'Loading charges'
  | 'Unloading charges'
  | 'Weighbridge fee'
  | 'Detention / halting charges'
  | 'Maintenance'
  | 'Insurance'
  | 'Tyres'
  | 'Permit / tax'
  | 'Loan / lease'
  | 'Fine'
  | 'Other';

export interface MonthlyExpense {
  id: string;
  date: string;
  vehicle: string;
  driver: string;
  category: ExpenseCategory;
  amount: number;
  remarks: string;
}

export interface TripFormState {
  loadDate: string;
  unloadDate: string;
  vehicle: string;
  driver: string;
  waybillNo: string;
  itemNo: string;
  from: string;
  to: string;
  tons: string;
  odoStart: string;
  odoEnd: string;
  revenue: string;
  remarks: string;
}

export interface ExpenseFormState {
  date: string;
  vehicle: string;
  driver: string;
  category: ExpenseCategory;
  amount: string;
  remarks: string;
}
