import type { Trip, TripExpenseLine } from '../types';
import { parseDisplayDate } from '../lib/api';

// Date#toISOString() normalizes to UTC, which silently shifts the date by
// a day in any timezone ahead of UTC (e.g. IST) once local time is past
// midnight but not yet UTC midnight — build the string from the local
// Y/M/D components instead.
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function toNumber(v: string | number | undefined | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function rupees(v: number): string {
  return '₹' + Math.round(v).toLocaleString('en-IN');
}

export function formatNum(v: number, decimals = 0): string {
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export interface TripCost {
  diesel: number;
  adblue: number;
  toll: number;
  other: number;
  expense: number;
  profit: number;
}

export function tripCost(t: Trip): TripCost {
  let diesel = 0, adblue = 0, toll = 0, other = 0;
  for (const line of t.expenses) {
    if (line.kind === 'diesel') diesel += line.amount;
    else if (line.kind === 'adblue') adblue += line.amount;
    else if (line.kind === 'toll') toll += line.amount;
    else other += line.amount;
  }
  const expense = diesel + adblue + toll + other;
  return { diesel, adblue, toll, other, expense, profit: t.revenue - expense };
}

export function dieselLitres(lines: TripExpenseLine[]): number {
  return lines.filter((l) => l.kind === 'diesel').reduce((a, l) => a + (l.litres ?? 0), 0);
}

// Trip/expense dates are stored as display strings ("14 Sep 2026") once
// they come back from the API — parse back to ISO to compare against a
// `type="date"` filter input's value.
export function dateInRange(displayDate: string, from: string, to: string): boolean {
  const iso = parseDisplayDate(displayDate);
  if (!iso) return true;
  return (!from || iso >= from) && (!to || iso <= to);
}

const RANGE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDateRange(from: string, to: string): string {
  if (!from || !to) return '';
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d} ${RANGE_MONTHS[Number(m) - 1]} ${y}`;
  };
  return `${fmt(from)} – ${fmt(to)}`;
}
