import { useState } from 'react';
import type { DriverMaster, MonthlyExpense, Trip, Vehicle } from '../types';
import { aggregateByVehicle, filterMonthlyExpenses, sumVehicles, type VehicleAgg } from '../utils/aggregate';
import { dateInRange, formatDateRange, formatNum, rupees, tripCost, yearOptions } from '../utils/calc';
import { MonthYearFilter } from './MonthYearFilter';
import { exportReportExcel, exportReportPdf, type ReportData, type Stat } from '../lib/reports';
import { useExport } from '../lib/useExport';
import { nextSort, sortRows, type SortState } from '../utils/sortRows';
import { SortHeader } from './SortHeader';

interface Props {
  trips: Trip[];
  expenses: MonthlyExpense[];
  vehicles: Vehicle[];
  drivers: DriverMaster[];
  vehicleFilter: string;
  driverFilter: string;
  dateFrom: string;
  dateTo: string;
  onVehicleFilter: (v: string) => void;
  onDriverFilter: (v: string) => void;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onResetFilters: () => void;
}

type LedgerKey = 'id' | 'trips' | 'km' | 'tons' | 'diesel' | 'toll' | 'other' | 'monthly' | 'cost' | 'revenue' | 'profit' | 'margin';

function ledgerValue(b: VehicleAgg, key: LedgerKey): number | string {
  switch (key) {
    case 'id': return b.id;
    case 'toll': return b.ledgerToll;
    case 'monthly': return b.ledgerMonthly;
    case 'margin': return b.revenue ? b.profit / b.revenue : NaN; // no revenue: blank, listed last
    default: return b[key];
  }
}

export function MonthlyReport({ trips: allTrips, expenses: allExpenses, vehicles, drivers, vehicleFilter, driverFilter, dateFrom, dateTo, onVehicleFilter, onDriverFilter, onDateFrom, onDateTo, onResetFilters }: Props) {
  const trips = allTrips.filter(
    (t) => (vehicleFilter === 'all' || t.vehicle === vehicleFilter) &&
      (!driverFilter || t.driver === driverFilter) &&
      dateInRange(t.loadDate, dateFrom, dateTo)
  );
  const expenses = filterMonthlyExpenses(allExpenses, { vehicle: vehicleFilter, driver: driverFilter, from: dateFrom, to: dateTo });
  const rangeLabel = formatDateRange(dateFrom, dateTo);

  const totals = trips.reduce(
    (a, t) => {
      const c = tripCost(t);
      a.tons += t.tons;
      a.exp += c.expense;
      a.rev += t.revenue;
      return a;
    },
    { tons: 0, exp: 0, rev: 0 }
  );
  const monthlyTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const profit = totals.rev - totals.exp - monthlyTotal;

  const byVehicle = aggregateByVehicle(trips, expenses, vehicles);
  const [sort, setSort] = useState<SortState<LedgerKey>>(null);
  const ledgerRows = sortRows(byVehicle, sort, (b, k) => ledgerValue(b, k));
  const onSort = (k: LedgerKey) => setSort((prev) => nextSort(prev, k, k === 'id' ? 'asc' : 'desc', null));
  const maxPerKm = Math.max(...byVehicle.map((b) => (b.km ? b.cost / b.km : 0)), 1);

  const totalCost = totals.exp + monthlyTotal;
  const costPerTon = totals.tons ? totalCost / totals.tons : 0;
  const headline: (Stat & { pos?: boolean })[] = [
    { label: 'Revenue', value: rupees(totals.rev), raw: totals.rev, fmt: 'money', note: `${trips.length} movements billed` },
    { label: 'Total cost', value: rupees(totalCost), raw: totalCost, fmt: 'money', note: 'haulage + fixed' },
    { label: 'Profit', value: rupees(profit), raw: profit, fmt: 'money', note: 'before overheads', pos: profit >= 0 },
    { label: 'Cost / ton', value: totals.tons ? rupees(costPerTon) : '₹0', raw: costPerTon, fmt: 'money', note: 'all-in' }
  ];

  const { busy, error, run } = useExport();
  const exportData = (): ReportData => ({
    period: { from: dateFrom, to: dateTo, label: rangeLabel },
    headline, byVehicle: ledgerRows, trips, expenses
  });

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div className="kicker">Manager only · {rangeLabel}</div>
          <h1>Monthly Report</h1>
          <p style={{ color: 'var(--color-neutral-700)', marginTop: 6, fontSize: 13 }}>The full financial picture — revenue, cost, profit and per-vehicle economics.</p>
        </div>
        <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => run('xlsx', () => exportReportExcel(exportData()))}>
              {busy === 'xlsx' ? 'Preparing…' : 'Export Excel'}
            </button>
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => run('pdf', () => exportReportPdf(exportData()))}>
              {busy === 'pdf' ? 'Preparing…' : 'Print / Save PDF'}
            </button>
          </div>
          {error && <div role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 12 }}>{error}</div>}
        </div>
      </div>

      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 20, background: 'var(--color-surface)' }}>
        <div className="filters-grid">
          <div className="field"><label>Loading date from</label><input className="input" type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} /></div>
          <div className="field"><label>Loading date to</label><input className="input" type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} /></div>
          <MonthYearFilter dateFrom={dateFrom} dateTo={dateTo} onDateFrom={onDateFrom} onDateTo={onDateTo} years={yearOptions([...allTrips.map((t) => t.loadDate), ...allExpenses.map((e) => e.date)])} />
          <div className="field">
            <label>Vehicle</label>
            <select className="input" value={vehicleFilter} onChange={(e) => onVehicleFilter(e.target.value)}>
              <option value="all">All vehicles</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Driver</label>
            <select className="input" value={driverFilter} onChange={(e) => onDriverFilter(e.target.value)}>
              <option value="">All drivers</option>
              {drivers.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={onResetFilters}>Reset filters</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 2, background: 'var(--color-divider)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: 26 }}>
        {headline.map((h) => (
          <div key={h.label} style={{ background: 'var(--color-bg)', padding: 20 }}>
            <div className="stat-label">{h.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'var(--fs-kpi)', letterSpacing: '-0.02em', lineHeight: 1, color: h.label === 'Profit' ? (h.pos ? 'var(--color-profit)' : 'var(--color-accent-700)') : undefined }}>{h.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 8 }}>{h.note}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 'var(--fs-section)', marginBottom: 12 }}>Cost per kilometre, by vehicle</h2>
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 28, background: 'var(--color-surface)' }}>
        {byVehicle.map((b) => {
          const perKm = b.km ? b.cost / b.km : 0;
          return (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 90px', alignItems: 'center', gap: 14, padding: '9px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
              <div style={{ fontWeight: 600 }}>{b.id}</div>
              <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--chart-track)' }}>
                <div style={{ height: 8, borderRadius: 4, background: perKm === maxPerKm ? 'var(--chart-primary)' : 'var(--chart-neutral)', width: `${Math.round((perKm / maxPerKm) * 100)}%` }} />
              </div>
              <div style={{ textAlign: 'right', fontWeight: 700 }}>{rupees(perKm)}/km</div>
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: 'var(--fs-section)', marginBottom: 12 }}>Vehicle-wise ledger</h2>
      <div className="scroll-x" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)' }}>
        <table className="table" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <SortHeader label="Vehicle" sortKey="id" sort={sort} onSort={onSort} />
              <SortHeader label="Trips" sortKey="trips" sort={sort} onSort={onSort} align="right" firstDir="desc" />
              <SortHeader label="KM" sortKey="km" sort={sort} onSort={onSort} align="right" firstDir="desc" />
              <SortHeader label="Tons" sortKey="tons" sort={sort} onSort={onSort} align="right" firstDir="desc" />
              <SortHeader label="Diesel" sortKey="diesel" sort={sort} onSort={onSort} align="right" firstDir="desc" />
              <SortHeader label="Toll" sortKey="toll" sort={sort} onSort={onSort} align="right" firstDir="desc" />
              <SortHeader label="Other" sortKey="other" sort={sort} onSort={onSort} align="right" firstDir="desc" />
              <SortHeader label="Monthly" sortKey="monthly" sort={sort} onSort={onSort} align="right" firstDir="desc" />
              <SortHeader label="Total cost" sortKey="cost" sort={sort} onSort={onSort} align="right" firstDir="desc" />
              <SortHeader label="Revenue" sortKey="revenue" sort={sort} onSort={onSort} align="right" firstDir="desc" />
              <SortHeader label="Profit" sortKey="profit" sort={sort} onSort={onSort} align="right" firstDir="desc" />
              <SortHeader label="Margin" sortKey="margin" sort={sort} onSort={onSort} align="right" firstDir="desc" />
            </tr>
          </thead>
          <tbody>
            {ledgerRows.map((b) => (
              <tr key={b.id}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{b.id}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(b.trips)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(b.km)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(b.tons, 1)}</td>
                <td style={{ textAlign: 'right' }}>{rupees(b.diesel)}</td>
                <td style={{ textAlign: 'right' }}>{rupees(b.ledgerToll)}</td>
                <td style={{ textAlign: 'right' }}>{rupees(b.other)}</td>
                <td style={{ textAlign: 'right' }}>{rupees(b.ledgerMonthly)}</td>
                <td style={{ textAlign: 'right' }}>{rupees(b.cost)}</td>
                <td style={{ textAlign: 'right' }}>{rupees(b.revenue)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{ color: b.profit >= 0 ? 'var(--color-profit)' : 'var(--color-accent-700)', fontWeight: 700 }}>{rupees(b.profit)}</span>
                </td>
                <td style={{ textAlign: 'right' }}>{b.revenue ? Math.round((b.profit / b.revenue) * 100) + '%' : '—'}</td>
              </tr>
            ))}
          </tbody>
          {byVehicle.length > 0 && (() => {
            const t = sumVehicles(byVehicle);
            return (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td style={{ textAlign: 'right' }}>{formatNum(t.trips)}</td>
                  <td style={{ textAlign: 'right' }}>{formatNum(t.km)}</td>
                  <td style={{ textAlign: 'right' }}>{formatNum(t.tons, 1)}</td>
                  <td style={{ textAlign: 'right' }}>{rupees(t.diesel)}</td>
                  <td style={{ textAlign: 'right' }}>{rupees(t.ledgerToll)}</td>
                  <td style={{ textAlign: 'right' }}>{rupees(t.other)}</td>
                  <td style={{ textAlign: 'right' }}>{rupees(t.ledgerMonthly)}</td>
                  <td style={{ textAlign: 'right' }}>{rupees(t.cost)}</td>
                  <td style={{ textAlign: 'right' }}>{rupees(t.revenue)}</td>
                  <td style={{ textAlign: 'right', color: t.profit >= 0 ? 'var(--color-profit)' : 'var(--color-accent-700)' }}>{rupees(t.profit)}</td>
                  <td style={{ textAlign: 'right' }}>{t.revenue ? Math.round((t.profit / t.revenue) * 100) + '%' : '—'}</td>
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </section>
  );
}
