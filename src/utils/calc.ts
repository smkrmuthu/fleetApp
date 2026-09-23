import type { DriverLeave, Trip, TripExpenseLine } from '../types';
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

// Unloading date minus loading date, in whole days. Null when either display
// date is missing or unparseable (a trip that hasn't been given dates yet).
// Counted inclusively — a trip loaded on the 22nd and unloaded the 23rd
// spans 2 calendar days (the 22nd and the 23rd), not the 1-day difference
// between them. Same-day is 1 day, never 0.
export function tripDurationDays(loadDate: string, unloadDate: string): number | null {
  const from = parseDisplayDate(loadDate);
  const to = parseDisplayDate(unloadDate);
  if (!from || !to) return null;
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const diff = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
  return diff + 1;
}

// A movement has only whole loading/unloading dates, no time — so it's
// treated as spanning the full day(s) from loadDate 00:00 to unloadDate (or
// loadDate, if that's not set yet) 23:59 for the purpose of catching an
// overlap with a driver's leave, which is recorded down to the minute.
export function overlappingLeaves(leaves: DriverLeave[], driver: string, loadDate: string, unloadDate: string): DriverLeave[] {
  if (!driver || !loadDate) return [];
  const tripStart = `${loadDate}T00:00`;
  const tripEnd = `${unloadDate || loadDate}T23:59`;
  return leaves.filter((l) => l.driver === driver && tripStart <= l.endsAt && l.startsAt <= tripEnd);
}

export function formatDuration(days: number | null): string {
  if (days === null) return '—';
  const n = Math.max(days, 1);
  return n === 1 ? '1 day' : `${n} days`;
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
