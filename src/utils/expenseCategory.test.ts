import { describe, expect, it } from 'vitest';
import { expenseCategoryLabel } from './calc';
import { expenseLinesSheet } from '../lib/reports';
import { expenseByCategory } from './aggregate';
import { tripCost } from './calc';
import type { Trip } from '../types';

describe('expenseCategoryLabel', () => {
  it('shows the category picked for an "other" entry', () => {
    expect(expenseCategoryLabel({ kind: 'other', category: 'Driver Trip Expenses' })).toBe('Driver Trip Expenses');
    expect(expenseCategoryLabel({ kind: 'other', category: '  Repairs & Tyres ' })).toBe('Repairs & Tyres');
  });
  it('shows "Other" for an entry saved before categories existed, or with a blank one', () => {
    expect(expenseCategoryLabel({ kind: 'other' })).toBe('Other');
    expect(expenseCategoryLabel({ kind: 'other', category: '   ' })).toBe('Other');
  });
  it('shows the kind for the fuel and toll lines posted elsewhere', () => {
    expect(expenseCategoryLabel({ kind: 'diesel' })).toBe('Diesel');
    expect(expenseCategoryLabel({ kind: 'adblue' })).toBe('AdBlue');
    expect(expenseCategoryLabel({ kind: 'toll' })).toBe('Toll');
    // a stray category on a fuel line never overrides what it is
    expect(expenseCategoryLabel({ kind: 'diesel', category: 'Toll' })).toBe('Diesel');
  });
});

describe('Excel expense lines sheet', () => {
  const trip = {
    waybillNo: 'SMT-00001', vehicle: 'TN01 AB 1234',
    expenses: [
      { id: 'a', date: '01 Oct 2026', kind: 'diesel', litres: 100, ratePerLitre: 90, amount: 9000, details: 'Pump' },
      { id: 'b', date: '01 Oct 2026', kind: 'other', amount: 500, details: 'Driver Trip Expenses', category: 'Driver Trip Expenses' },
      { id: 'c', date: '02 Oct 2026', kind: 'other', amount: 120, details: 'old entry' }
    ]
  } as unknown as Trip;

  it('has a Category column instead of Kind, filled from the entry', () => {
    const sheet = expenseLinesSheet([trip]);
    const text = (c: unknown) => (c && typeof c === 'object' && 'value' in (c as object) ? String((c as { value: unknown }).value) : String(c));
    const header = sheet.rows[0]!.map(text);
    expect(header).toContain('Category');
    expect(header).not.toContain('Kind');
    const col = header.indexOf('Category');
    expect(sheet.rows.slice(1).map((r) => text(r[col]))).toEqual(['Diesel', 'Driver Trip Expenses', 'Other']);
  });
});

describe('expenseByCategory (the boxes under Trip expense in the Movement Summary)', () => {
  const master = ['Diesel', 'Driver Trip Expenses', 'Toll', 'Loading / Unloading', 'Repairs & Tyres', 'Other', 'Flyash Purchase'];
  const line = (id: string, kind: string, amount: number, category?: string) => ({ id, date: '01 Oct 2026', kind, amount, details: 'x', category });
  const trips = [
    { expenses: [line('1', 'diesel', 9000.5), line('2', 'other', 500, 'Driver Trip Expenses'), line('3', 'other', 37598, 'Diesel')] },
    { expenses: [line('4', 'other', 120), line('5', 'toll', 300.25), line('6', 'adblue', 80), line('7', 'other', 1500, 'Flyash Purchase')] },
    { expenses: [line('8', 'other', 60, 'Old Category')] }
  ] as unknown as Trip[];

  it('splits by category: fuel lines and "Diesel" entries together, old entries as Other', () => {
    const r = Object.fromEntries(expenseByCategory(trips, 0, 0, master).map((c) => [c.label, c.amount]));
    expect(r['Diesel']).toBeCloseTo(9000.5 + 37598, 2);
    expect(r['Driver Trip Expenses']).toBe(500);
    expect(r['Other']).toBe(120);
    expect(r['Toll']).toBeCloseTo(300.25, 2);
    expect(r['Flyash Purchase']).toBe(1500);
  });

  it('lists every Master category in Master order, even at zero, then other labels found, largest first', () => {
    const labels = expenseByCategory(trips, 0, 0, master).map((c) => c.label);
    expect(labels.slice(0, master.length)).toEqual(master);
    expect(labels.slice(master.length)).toEqual(['AdBlue', 'Old Category']);
    expect(expenseByCategory([], 0, 0, master).map((c) => c.amount)).toEqual(master.map(() => 0));
  });

  it('adds Fastag to Toll', () => {
    const toll = expenseByCategory(trips, 2800, 2, master).find((c) => c.label === 'Toll')!;
    expect(toll.amount).toBeCloseTo(300.25 + 2800, 2);
    expect(toll.entries).toBe(1 + 2);
  });

  it('adds up exactly to the Trip expense figure (all entries plus Fastag)', () => {
    const fastag = 2800.1;
    const tripExpenseShown = trips.reduce((a, t) => a + tripCost(t).expense, 0) + fastag;
    const sum = expenseByCategory(trips, fastag, 1, master).reduce((a, c) => a + Math.round(c.amount * 100), 0);
    expect(sum).toBe(Math.round(tripExpenseShown * 100));
  });

  it('matches a category ignoring capitals and never repeats it', () => {
    const t = [{ expenses: [line('1', 'other', 10, 'diesel'), line('2', 'other', 5, 'DIESEL')] }] as unknown as Trip[];
    const r = expenseByCategory(t, 0, 0, ['Diesel', 'Other']);
    expect(r.map((c) => c.label)).toEqual(['Diesel', 'Other']);
    expect(r[0]!.amount).toBe(15);
  });
});
