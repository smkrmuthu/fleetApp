import { describe, expect, it } from 'vitest';
import { expenseCategoryLabel } from './calc';
import { expenseLinesSheet } from '../lib/reports';
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
