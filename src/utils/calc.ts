import type { Trip, TripExpenseLine } from '../types';

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
