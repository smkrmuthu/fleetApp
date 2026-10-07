import { describe, expect, it } from 'vitest';
import { aggregateByVehicle, isFastag, sumVehicles } from './aggregate';
import type { MonthlyExpense, Trip, Vehicle } from '../types';

const vehicle = (id: string) => ({ id, model: 'Tata' }) as Vehicle;
const trip = (vehicleId: string, revenue: number, lines: { kind: string; amount: number }[]) =>
  ({ id: `${vehicleId}-${revenue}`, vehicle: vehicleId, tons: 10, km: 100, revenue, expenses: lines }) as unknown as Trip;
const monthly = (vehicleId: string, category: string, amount: number) =>
  ({ id: `${vehicleId}-${category}-${amount}`, vehicle: vehicleId, category, amount }) as unknown as MonthlyExpense;

describe('Fastag is shown as toll, never added twice', () => {
  const trips = [
    trip('A', 218274.82, [{ kind: 'diesel', amount: 25942.4 }]),
    trip('B', 100000, [{ kind: 'toll', amount: 500 }, { kind: 'other', amount: 100 }])
  ];
  const expenses = [monthly('A', 'Fastag', 11355), monthly('A', 'Permit', 2000), monthly('B', ' fastag ', 900), monthly('B', 'EMI', 5000)];
  const rows = aggregateByVehicle(trips, expenses, [vehicle('A'), vehicle('B')]);
  const [a, b] = rows;

  it('moves Fastag from Monthly to Toll in the report ledger', () => {
    expect(a.ledgerToll).toBe(11355);
    expect(a.ledgerMonthly).toBe(2000);
    expect(b.ledgerToll).toBe(1400); // 500 trip toll + 900 Fastag
    expect(b.ledgerMonthly).toBe(5000);
  });

  it('puts Fastag in trip expense on the Movement Summary', () => {
    expect(a.ledgerTripExpense).toBeCloseTo(25942.4 + 11355, 2);
  });

  it('leaves total cost and profit exactly as before', () => {
    for (const r of rows) {
      expect(r.cost).toBeCloseTo(r.tripExpense + r.monthly, 2);
      expect(r.ledgerToll + r.ledgerMonthly).toBeCloseTo(r.toll + r.monthly, 2);
      expect(r.ledgerTripExpense + r.ledgerMonthly).toBeCloseTo(r.tripExpense + r.monthly, 2);
    }
    expect(a.profit).toBeCloseTo(218274.82 - 25942.4 - 13355, 2);
  });

  it('counts each Fastag rupee once across the fleet', () => {
    const fastagTotal = expenses.filter(isFastag).reduce((s, e) => s + e.amount, 0);
    const movedOut = rows.reduce((s, r) => s + (r.monthly - r.ledgerMonthly), 0);
    const movedIn = rows.reduce((s, r) => s + (r.ledgerToll - r.toll), 0);
    expect(movedOut).toBeCloseTo(fastagTotal, 2);
    expect(movedIn).toBeCloseTo(fastagTotal, 2);
  });
});

describe('isFastag', () => {
  it('ignores capitals and stray spaces but not other wording', () => {
    expect(isFastag(monthly('A', 'FASTAG', 1))).toBe(true);
    expect(isFastag(monthly('A', 'Fastag ', 1))).toBe(true);
    expect(isFastag(monthly('A', 'Fast Tag', 1))).toBe(false);
    expect(isFastag(monthly('A', 'Toll', 1))).toBe(false);
  });
});

describe('sumVehicles (the Total row)', () => {
  const trips = [
    trip('A', 100000, [{ kind: 'diesel', amount: 20000 }]),
    trip('B', 50000, [{ kind: 'toll', amount: 500 }, { kind: 'other', amount: 1500 }]),
    trip('A', 25000.5, [{ kind: 'diesel', amount: 8000.25 }])
  ];
  const expenses = [monthly('A', 'Fastag', 3000), monthly('B', 'Permit', 2000)];
  const rows = aggregateByVehicle(trips, expenses, [vehicle('A'), vehicle('B'), vehicle('C')]);
  const t = sumVehicles(rows);

  it('adds up every column of the rows above it', () => {
    expect(t.trips).toBe(3);
    expect(t.revenue).toBeCloseTo(175000.5, 2);
    expect(t.diesel).toBeCloseTo(28000.25, 2);
    expect(t.ledgerToll).toBeCloseTo(500 + 3000, 2);
    expect(t.ledgerMonthly).toBeCloseTo(2000, 2);
    expect(t.cost).toBeCloseTo(rows.reduce((s, r) => s + r.cost, 0), 2);
  });

  it('keeps the same identities as a single row (profit = revenue - cost; Fastag moved, not added)', () => {
    expect(t.profit).toBeCloseTo(t.revenue - t.cost, 2);
    expect(t.ledgerToll + t.ledgerMonthly).toBeCloseTo(t.toll + t.monthly, 2);
    expect(t.ledgerTripExpense + t.ledgerMonthly).toBeCloseTo(t.tripExpense + t.monthly, 2);
  });

  it('is all zeros for no rows', () => {
    expect(sumVehicles([])).toMatchObject({ trips: 0, km: 0, revenue: 0, cost: 0, profit: 0 });
  });
});
