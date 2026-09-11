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
  expense: number;
  profit: number;
}

export function tripCost(t: { litres: number; pricePerLitre: number; toll: number; other: number; revenue: number }): TripCost {
  const diesel = t.litres * t.pricePerLitre;
  const expense = diesel + t.toll + t.other;
  return { diesel, expense, profit: t.revenue - expense };
}
