import { useState } from 'react';
import type { ExpenseFormState, MonthlyExpense } from '../types';
import { CATEGORY_TINT, EXPENSE_CATEGORIES, VEHICLES } from '../data/mockData';
import { rupees, toNumber } from '../utils/calc';

function blankExpense(): ExpenseFormState {
  return { date: '2026-09-11', vehicle: VEHICLES[0].id, driver: '', category: EXPENSE_CATEGORIES[0], amount: '0', remarks: '' };
}

interface Props {
  expenses: MonthlyExpense[];
  onAdd: (e: MonthlyExpense) => void;
}

export function MonthlyExpenses({ expenses, onAdd }: Props) {
  const [exp, setExp] = useState<ExpenseFormState>(blankExpense());

  const set = (k: keyof ExpenseFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setExp((f) => ({ ...f, [k]: e.target.value } as ExpenseFormState));

  function addExpense() {
    if (!toNumber(exp.amount)) return;
    onAdd({
      id: 'e' + Date.now(), date: '11 Sep', vehicle: exp.vehicle, driver: exp.driver || '—',
      category: exp.category, amount: toNumber(exp.amount), remarks: exp.remarks || '—'
    });
    setExp((f) => ({ ...f, amount: '0', remarks: '' }));
  }

  const byKind = new Map<string, number>();
  expenses.forEach((e) => byKind.set(e.category, (byKind.get(e.category) || 0) + e.amount));

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <div className="kicker">Admin and documentation resource</div>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>Monthly Expenses</h1>
      </div>

      <div style={{ border: '2px solid var(--color-divider)', padding: 20, marginBottom: 24 }}>
        <div className="filters-grid">
          <div className="field"><label>Date</label><input className="input" type="date" value={exp.date} onChange={set('date')} /></div>
          <div className="field">
            <label>Vehicle</label>
            <select className="input" value={exp.vehicle} onChange={set('vehicle')}>
              {VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
            </select>
          </div>
          <div className="field"><label>Driver</label><input className="input" type="text" placeholder="Driver name" value={exp.driver} onChange={set('driver')} /></div>
          <div className="field">
            <label>Description</label>
            <select className="input" value={exp.category} onChange={set('category')}>
              {EXPENSE_CATEGORIES.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field"><label>Amount (₹)</label><input className="input" type="number" value={exp.amount} onChange={set('amount')} /></div>
          <div className="field"><label>Remarks</label><input className="input" type="text" placeholder="Remarks" value={exp.remarks} onChange={set('remarks')} /></div>
          <button type="button" className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={addExpense}>Add expense</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 2, background: 'var(--color-divider)', border: '2px solid var(--color-divider)', marginBottom: 24 }}>
        {Array.from(byKind.entries()).map(([label, value]) => (
          <div key={label} style={{ background: 'var(--color-bg)', padding: '14px 16px', display: 'flex', gap: 12 }}>
            <div style={{ width: 6, flex: 'none', background: CATEGORY_TINT[label] }} />
            <div>
              <div className="stat-label">{label}</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22 }}>{rupees(value)}</div>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Monthly Expenses Log</h2>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
        <table className="table" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th>Date</th><th>Vehicle</th><th>Driver</th><th>Description</th><th>Remarks</th><th style={{ textAlign: 'right' }}>Amount</th>
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
                    <span style={{ width: 4, height: 15, background: CATEGORY_TINT[e.category], display: 'inline-block' }} />
                    {e.category}
                  </span>
                </td>
                <td style={{ color: 'var(--color-neutral-700)' }}>{e.remarks}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{rupees(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
