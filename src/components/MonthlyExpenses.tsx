import { useState } from 'react';
import type { DriverMaster, ExpenseFormState, MonthlyExpense, Vehicle } from '../types';
import { categoryTint } from '../data/mockData';
import { parseDisplayDate } from '../lib/api';
import { dateInRange, formatDateRange, rupees, todayIso, toNumber } from '../utils/calc';

function blankExpense(defaultVehicle: string, defaultCategory: string): ExpenseFormState {
  return { date: todayIso(), vehicle: defaultVehicle, driver: '', category: defaultCategory, amount: '0', remarks: '' };
}

interface Props {
  expenses: MonthlyExpense[];
  vehicles: Vehicle[];
  drivers: DriverMaster[];
  dateFrom: string;
  dateTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onResetFilters: () => void;
  onAdd: (e: MonthlyExpense) => void;
  onDelete: (e: MonthlyExpense) => void;
  categories: string[];
}

export function MonthlyExpenses({ expenses: allExpenses, vehicles, drivers, categories, dateFrom, dateTo, onDateFrom, onDateTo, onResetFilters, onAdd, onDelete }: Props) {
  const [exp, setExp] = useState<ExpenseFormState>(() => blankExpense(vehicles[0]?.id ?? '', categories[0] ?? ''));
  const [truckFilter, setTruckFilter] = useState('all');
  const [dateSort, setDateSort] = useState<'asc' | 'desc'>('asc');
  const expenses = allExpenses
    .filter((e) => dateInRange(e.date, dateFrom, dateTo) && (truckFilter === 'all' || e.vehicle === truckFilter))
    .sort((a, b) => {
      const cmp = parseDisplayDate(a.date).localeCompare(parseDisplayDate(b.date));
      return dateSort === 'asc' ? cmp : -cmp;
    });

  const set = (k: keyof ExpenseFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setExp((f) => ({ ...f, [k]: e.target.value } as ExpenseFormState));

  function addExpense() {
    if (!toNumber(exp.amount)) return;
    onAdd({
      id: 'e' + Date.now(), date: exp.date, vehicle: exp.vehicle, driver: exp.driver || '—',
      category: exp.category, amount: toNumber(exp.amount), remarks: exp.remarks || '—'
    });
    setExp((f) => ({ ...f, amount: '0', remarks: '' }));
  }

  const byKind = new Map<string, number>();
  expenses.forEach((e) => byKind.set(e.category, (byKind.get(e.category) || 0) + e.amount));

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <div className="kicker">Admin and documentation resource · {formatDateRange(dateFrom, dateTo)}</div>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>Monthly Expenses</h1>
        <p style={{ color: 'var(--color-neutral-700)', marginTop: 6, fontSize: 13 }}>Record fixed costs — permits, insurance, EMIs — that aren't tied to a single trip.</p>
      </div>

      <div style={{ border: '2px solid var(--color-divider)', padding: 20, marginBottom: 24 }}>
        <div className="filters-grid">
          <div className="field"><label>Date</label><input className="input" type="date" value={exp.date} onChange={set('date')} /></div>
          <div className="field">
            <label>Vehicle</label>
            <select className="input" value={exp.vehicle} onChange={set('vehicle')}>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Driver</label>
            <select className="input" value={exp.driver} onChange={set('driver')}>
              <option value="">No driver</option>
              {drivers.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Description</label>
            <select className="input" value={exp.category} onChange={set('category')}>
              {categories.length === 0 && <option value="">Add one under Master first</option>}
              {categories.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field"><label>Amount (₹)</label><input className="input" type="number" value={exp.amount} onChange={set('amount')} /></div>
          <div className="field"><label>Remarks</label><input className="input" type="text" placeholder="Remarks" value={exp.remarks} onChange={set('remarks')} /></div>
          <button type="button" className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={addExpense} disabled={categories.length === 0}>Add expense</button>
        </div>
      </div>

      <div style={{ border: '2px solid var(--color-divider)', padding: 16, marginBottom: 20 }}>
        <div className="filters-grid">
          <div className="field"><label>Date from</label><input className="input" type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} /></div>
          <div className="field"><label>Date to</label><input className="input" type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} /></div>
          <div className="field">
            <label>Truck no</label>
            <select className="input" value={truckFilter} onChange={(e) => setTruckFilter(e.target.value)}>
              <option value="all">All trucks</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={() => { setTruckFilter('all'); onResetFilters(); }}>Reset filters</button>
        </div>
      </div>

      {byKind.size > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', borderTop: '2px solid var(--color-divider)', borderLeft: '2px solid var(--color-divider)', marginBottom: 24 }}>
          {Array.from(byKind.entries()).map(([label, value]) => (
            <div key={label} style={{ background: 'var(--color-bg)', padding: '14px 16px', display: 'flex', gap: 12, borderRight: '2px solid var(--color-divider)', borderBottom: '2px solid var(--color-divider)' }}>
              <div style={{ width: 6, flex: 'none', background: categoryTint(label) }} />
              <div>
                <div className="stat-label">{label}</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22 }}>{rupees(value)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Monthly Expenses Log</h2>
      {expenses.length === 0 ? (
        <div style={{ border: '2px solid var(--color-divider)', padding: 16, color: 'var(--color-neutral-700)' }}>
          {truckFilter === 'all' ? 'No expenses recorded for this date range.' : `No expenses recorded for ${truckFilter} in this date range.`}
        </div>
      ) : (
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
        <table className="table" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th aria-sort={dateSort === 'asc' ? 'ascending' : 'descending'}>
                <button
                  type="button" className="btn btn-ghost" onClick={() => setDateSort((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  style={{ padding: 0, font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit', display: 'inline-flex', gap: 6, alignItems: 'center' }}
                  title={dateSort === 'asc' ? 'Oldest first — click for newest first' : 'Newest first — click for oldest first'}
                >
                  Date <span aria-hidden="true">{dateSort === 'asc' ? '▲' : '▼'}</span>
                </button>
              </th><th>Vehicle</th><th>Driver</th><th>Description</th><th>Remarks</th><th style={{ textAlign: 'right' }}>Amount</th><th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{e.vehicle}</td>
                <td>{e.driver}</td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 4, height: 15, background: categoryTint(e.category), display: 'inline-block' }} />
                    {e.category}
                  </span>
                </td>
                <td style={{ color: 'var(--color-neutral-700)' }}>{e.remarks}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{rupees(e.amount)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12, color: 'var(--color-accent-700)' }} onClick={() => onDelete(e)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}
