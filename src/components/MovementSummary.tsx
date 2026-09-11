import type { MonthlyExpense, Trip } from '../types';
import { VEHICLES } from '../data/mockData';
import { aggregateByVehicle } from '../utils/aggregate';
import { formatNum, rupees, tripCost } from '../utils/calc';

interface Props {
  trips: Trip[];
  expenses: MonthlyExpense[];
  vehicleFilter: string;
  driverFilter: string;
  onVehicleFilter: (v: string) => void;
  onDriverFilter: (v: string) => void;
  onResetFilters: () => void;
}

export function MovementSummary({ trips, expenses, vehicleFilter, driverFilter, onVehicleFilter, onDriverFilter, onResetFilters }: Props) {
  const rows = trips.filter(
    (t) => (vehicleFilter === 'all' || t.vehicle === vehicleFilter) && (!driverFilter || t.driver.toLowerCase().includes(driverFilter.toLowerCase()))
  );

  const totals = rows.reduce(
    (a, t) => {
      const c = tripCost(t);
      a.km += t.km;
      a.tons += t.tons;
      a.exp += c.expense;
      a.rev += t.revenue;
      return a;
    },
    { km: 0, tons: 0, exp: 0, rev: 0 }
  );
  const monthlyTotal = expenses.reduce((a, e) => a + e.amount, 0);

  const byVehicle = aggregateByVehicle(rows, expenses);

  const stats = [
    { label: 'Movements', value: formatNum(rows.length), note: 'gated this month' },
    { label: 'Vehicles', value: formatNum(byVehicle.filter((b) => b.trips).length), note: `active of ${VEHICLES.length}` },
    { label: 'Total km', value: formatNum(totals.km), note: 'odometer based' },
    { label: 'Total tons', value: formatNum(totals.tons, 1), note: 'loading weight' },
    { label: 'Trip expense', value: rupees(totals.exp), note: 'diesel, toll, other' },
    { label: 'Shipment costs', value: rupees(monthlyTotal), note: 'CFS, CHA, duty, fixed' },
    { label: 'Avg ₹/km', value: totals.km ? rupees(totals.exp / totals.km) : '₹0', note: 'running cost' },
    { label: 'Revenue', value: rupees(totals.rev), note: 'billed to consignee' },
    { label: 'Profit', value: rupees(totals.rev - totals.exp - monthlyTotal), note: 'after monthly expenses' }
  ];

  const filterNote = vehicleFilter === 'all' ? 'All vehicles, September 2026' : `${vehicleFilter}, September 2026`;

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div className="kicker">September 2026 · month to date</div>
          <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>Movement Summary</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secondary">Export Excel</button>
          <button type="button" className="btn btn-primary">Print / Save PDF</button>
        </div>
      </div>

      <div style={{ border: '2px solid var(--color-divider)', padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', marginBottom: 12 }}>Filters</div>
        <div className="filters-grid">
          <div className="field"><label>Loading date from</label><input className="input" type="date" defaultValue="2026-09-01" readOnly /></div>
          <div className="field"><label>Loading date to</label><input className="input" type="date" defaultValue="2026-09-30" readOnly /></div>
          <div className="field">
            <label>Vehicle</label>
            <select className="input" value={vehicleFilter} onChange={(e) => onVehicleFilter(e.target.value)}>
              <option value="all">All vehicles</option>
              {VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
            </select>
          </div>
          <div className="field"><label>Driver</label><input className="input" type="text" placeholder="Driver name" value={driverFilter} onChange={(e) => onDriverFilter(e.target.value)} /></div>
          <button type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={onResetFilters}>Reset filters</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2, background: 'var(--color-divider)', border: '2px solid var(--color-divider)', marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: 'var(--color-bg)', padding: '16px 18px 18px' }}>
            <div className="stat-label">{s.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 8 }}>{s.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12 }}>
        <h2 style={{ fontSize: 20 }}>Vehicle-wise</h2>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{filterNote}</span>
      </div>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
        <table className="table" style={{ minWidth: 940 }}>
          <thead>
            <tr>
              <th>Vehicle</th><th>Model</th><th style={{ textAlign: 'right' }}>Trips</th><th style={{ textAlign: 'right' }}>KM</th>
              <th style={{ textAlign: 'right' }}>Tons</th><th style={{ textAlign: 'right' }}>Trip expense</th>
              <th style={{ textAlign: 'right' }}>Monthly expense</th><th style={{ textAlign: 'right' }}>Revenue</th>
              <th style={{ textAlign: 'right' }}>Profit</th><th style={{ textAlign: 'right' }}>₹/km</th>
            </tr>
          </thead>
          <tbody>
            {byVehicle.map((b) => (
              <tr key={b.id}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{b.id}</td>
                <td style={{ color: 'var(--color-neutral-700)' }}>{b.model}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(b.trips)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(b.km)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(b.tons, 1)}</td>
                <td style={{ textAlign: 'right' }}>{rupees(b.tripExpense)}</td>
                <td style={{ textAlign: 'right' }}>{rupees(b.monthly)}</td>
                <td style={{ textAlign: 'right' }}>{rupees(b.revenue)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{ color: b.profit >= 0 ? 'var(--color-profit)' : 'var(--color-accent-700)', fontWeight: 700 }}>{rupees(b.profit)}</span>
                </td>
                <td style={{ textAlign: 'right' }}>{b.km ? rupees(b.cost / b.km) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
