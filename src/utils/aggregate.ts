import type { MonthlyExpense, Trip, Vehicle } from '../types';
import { tripCost } from './calc';

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
  cost: number;
  revenue: number;
  profit: number;
}

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
    const cost = agg.tripExpense + monthly;
    return { id: v.id, model: v.model, trips: rows.length, monthly, cost, profit: agg.revenue - cost, ...agg };
  });
}
