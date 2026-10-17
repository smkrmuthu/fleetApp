import type { MonthlyExpense, Trip, Vehicle } from '../types';
import { expenseCategoryLabel, tripCost } from './calc';

export interface VehicleAgg {
  id: string;
  model: string;
  trips: number;
  km: number;
  tons: number;
  diesel: number;
  adblue: number;
  toll: number;
  other: number;
  tripExpense: number;
  monthly: number;
  // Monthly Report ledger view: Fastag is a toll, so it is shown under Toll and
  // taken out of Monthly. Total cost / profit are unaffected — `cost` still
  // counts it exactly once.
  ledgerToll: number;
  ledgerMonthly: number;
  // Trip expense with Fastag counted as toll (Movement Summary view).
  ledgerTripExpense: number;
  cost: number;
  revenue: number;
  profit: number;
}

// The "Total" row of the per-truck tables: every figure is the sum of the rows,
// so a total can never disagree with what is shown above it.
export function sumVehicles(rows: VehicleAgg[]): Omit<VehicleAgg, 'id' | 'model'> {
  const sum = (pick: (r: VehicleAgg) => number) => rows.reduce((a, r) => a + pick(r), 0);
  return {
    trips: sum((r) => r.trips), km: sum((r) => r.km), tons: sum((r) => r.tons), diesel: sum((r) => r.diesel), adblue: sum((r) => r.adblue),
    toll: sum((r) => r.toll), other: sum((r) => r.other), tripExpense: sum((r) => r.tripExpense), monthly: sum((r) => r.monthly),
    ledgerToll: sum((r) => r.ledgerToll), ledgerMonthly: sum((r) => r.ledgerMonthly), ledgerTripExpense: sum((r) => r.ledgerTripExpense),
    cost: sum((r) => r.cost), revenue: sum((r) => r.revenue), profit: sum((r) => r.profit)
  };
}

// A monthly expense whose description is "Fastag" (any capitalisation).
export const isFastag = (e: MonthlyExpense) => e.category.trim().toLowerCase() === 'fastag';

export function aggregateByVehicle(trips: Trip[], expenses: MonthlyExpense[], vehicles: Vehicle[]): VehicleAgg[] {
  return vehicles.map((v) => {
    const rows = trips.filter((t) => t.vehicle === v.id);
    const agg = rows.reduce(
      (a, t) => {
        const c = tripCost(t);
        a.km += t.km;
        a.tons += t.tons;
        a.diesel += c.diesel;
        a.adblue += c.adblue;
        a.toll += c.toll;
        a.other += c.other;
        a.tripExpense += c.expense;
        a.revenue += t.revenue;
        return a;
      },
      { km: 0, tons: 0, diesel: 0, adblue: 0, toll: 0, other: 0, tripExpense: 0, revenue: 0 }
    );
    const monthly = expenses.filter((e) => e.vehicle === v.id).reduce((a, e) => a + e.amount, 0);
    const fastag = expenses.filter((e) => e.vehicle === v.id && isFastag(e)).reduce((a, e) => a + e.amount, 0);
    const cost = agg.tripExpense + monthly;
    return {
      id: v.id, model: v.model, trips: rows.length, monthly, ledgerToll: agg.toll + fastag, ledgerMonthly: monthly - fastag, ledgerTripExpense: agg.tripExpense + fastag,
      cost, profit: agg.revenue - cost, ...agg
    };
  });
}

export interface CategoryTotal { label: string; amount: number; entries: number }

// The trip expense of the movements shown, split by the category on each entry, so the
// pieces add up to the "Trip expense" figure exactly. A diesel fill posted from Fuel
// Expenses counts as Diesel, an entry saved before categories existed as Other, and Fastag
// (a monthly expense, shown as toll on this screen) as Toll. Every Master category is listed
// in Master order even when it is zero; any other label found in the data (AdBlue, or a
// category since removed from Master) follows, largest first. Worked in whole paise so no
// rounding drift creeps in.
export function expenseByCategory(trips: Trip[], fastagTotal: number, fastagEntries: number, master: string[]): CategoryTotal[] {
  const paise = (rupees: number) => Math.round(rupees * 100);
  const byKey = new Map<string, { label: string; paise: number; entries: number }>();
  const slot = (label: string) => {
    const key = label.toLowerCase();
    let s = byKey.get(key);
    if (!s) { s = { label, paise: 0, entries: 0 }; byKey.set(key, s); }
    return s;
  };
  for (const name of master) slot(name);
  for (const t of trips) {
    for (const l of t.expenses) {
      const s = slot(expenseCategoryLabel(l));
      s.paise += paise(l.amount);
      s.entries += 1;
    }
  }
  if (fastagTotal) {
    const s = slot('Toll');
    s.paise += paise(fastagTotal);
    s.entries += fastagEntries;
  }
  const inMaster = new Set(master.map((m) => m.toLowerCase()));
  const all = [...byKey.entries()].map(([key, s]) => ({ key, label: s.label, amount: s.paise / 100, entries: s.entries }));
  const listed = master.map((m) => all.find((a) => a.key === m.toLowerCase())!);
  const extra = all.filter((a) => !inMaster.has(a.key) && (a.amount !== 0 || a.entries > 0)).sort((x, y) => y.amount - x.amount);
  return [...listed, ...extra].map(({ label, amount, entries }) => ({ label, amount, entries }));
}
