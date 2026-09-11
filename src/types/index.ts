export type Role = 'Driver' | 'Office' | 'Manager';

export type TabId = 'summary' | 'addtrip' | 'triplog' | 'expenses' | 'report' | 'people' | 'schema';

export type Direction = 'Import' | 'Export';

export type TripStatus = 'pending' | 'approved';

export interface Vehicle {
  id: string;
  model: string;
}

export interface Trip {
  id: string;
  loadDate: string;
  unloadDate: string;
  vehicle: string;
  driver: string;
  direction: Direction;
  bl: string;
  container: string;
  from: string;
  to: string;
  tons: number;
  km: number;
  litres: number;
  pricePerLitre: number;
  toll: number;
  other: number;
  revenue: number;
  status: TripStatus;
  remarks?: string;
}

export type ExpenseCategory =
  | 'CFS / port charges'
  | 'Customs duty'
  | 'CHA fee'
  | 'Detention / demurrage'
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
  direction: Direction;
  bl: string;
  container: string;
  from: string;
  to: string;
  tons: string;
  odoStart: string;
  odoEnd: string;
  litres: string;
  price: string;
  toll: string;
  other: string;
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
