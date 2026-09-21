import { useEffect, useState } from 'react';
import type { DriverMaster, Role, Trip, Vehicle } from '../types';
import { formFromTrip } from './AddMovement';
import { MovementReview } from './MovementReview';
import { DualScroll } from './DualScroll';
import { exportTripLog } from '../lib/reports';
import { useExport } from '../lib/useExport';
import { dateInRange, formatDateRange, formatNum, rupees, tripCost } from '../utils/calc';

interface Props {
  trips: Trip[];
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
  onAddMovement: () => void;
  onApprove: (tripId: string) => Promise<void>;
  onEdit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  role: Role;
}

export function TripLog({ trips, vehicles, drivers, vehicleFilter, driverFilter, dateFrom, dateTo, onVehicleFilter, onDriverFilter, onDateFrom, onDateTo, onResetFilters, onAddMovement, onApprove, onEdit, onDelete, role }: Props) {
  const isDriver = role === 'Driver';
  const isOffice = role === 'Office';
  const isManager = role === 'Manager';
  const showFinancials = !isDriver;
  const showActions = !isDriver;
  const { busy: exporting, error: exportError, run: runExport } = useExport();
  const [completing, setCompleting] = useState<Trip | null>(null);
  const [completingBusy, setCompletingBusy] = useState(false);

  useEffect(() => {
    if (!completing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !completingBusy) setCompleting(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [completing, completingBusy]);

  // What's still missing before a movement can be completed (mirrors the server's checks).
  function completionBlockers(t: Trip): string[] {
    const out: string[] = [];
    if (!t.tons) out.push('Loading weight is required.');
    if (!t.odoStart) out.push('Odometer start is required.');
    if (!t.odoEnd) out.push('Odometer end is required.');
    else if (t.odoStart && t.odoEnd <= t.odoStart) out.push('Odometer end must be greater than odometer start.');
    t.stops.forEach((st, i) => { if (!st.odo) out.push(`Odometer reading is required at stop ${i + 1} (${st.location}).`); });
    return out;
  }

  async function confirmComplete(t: Trip) {
    setCompletingBusy(true);
    await onApprove(t.id);
    setCompletingBusy(false);
    setCompleting(null);
  }

  const rows = trips.filter(
    (t) => (vehicleFilter === 'all' || t.vehicle === vehicleFilter) &&
      (!driverFilter || t.driver === driverFilter) &&
      dateInRange(t.loadDate, dateFrom, dateTo)
  );

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div className="kicker">{rows.length} movements · {formatDateRange(dateFrom, dateTo)}</div>
          <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>Trip Log</h1>
          <p style={{ color: 'var(--color-neutral-700)', marginTop: 6, fontSize: 13 }}>Every movement in one place — open a draft to complete it, or delete what's still open. Office and Managers can also open completed movements to view or correct them.</p>
        </div>
        {showActions && (
          <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
            <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button" className="btn btn-secondary" disabled={!!exporting}
              onClick={() => runExport('xlsx', () => exportTripLog(
                rows, showFinancials,
                { from: dateFrom, to: dateTo, label: formatDateRange(dateFrom, dateTo) },
                `Vehicle: ${vehicleFilter === 'all' ? 'all' : vehicleFilter}   Driver: ${driverFilter || 'all'}`
              ))}
            >
              {exporting ? 'Preparing…' : 'Export Excel'}
            </button>
            <button type="button" className="btn btn-secondary">Backup data</button>
            <button type="button" className="btn btn-primary" onClick={onAddMovement}>Add movement</button>
            </div>
            {exportError && <div role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 12 }}>{exportError}</div>}
          </div>
        )}
      </div>

      <div style={{ border: '2px solid var(--color-divider)', padding: 16, marginBottom: 20 }}>
        <div className="filters-grid">
          <div className="field"><label>Loading date from</label><input className="input" type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} /></div>
          <div className="field"><label>Loading date to</label><input className="input" type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} /></div>
          <div className="field">
            <label>Vehicle</label>
            <select className="input" value={vehicleFilter} onChange={(e) => onVehicleFilter(e.target.value)}>
              <option value="all">All vehicles</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
            </select>
          </div>
          {!isDriver && (
            <div className="field">
              <label>Driver</label>
              <select className="input" value={driverFilter} onChange={(e) => onDriverFilter(e.target.value)}>
                <option value="">All drivers</option>
                {drivers.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          )}
          <button type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={onResetFilters}>Reset filters</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ border: '2px solid var(--color-divider)', padding: 16, color: 'var(--color-neutral-700)' }}>
          No movements match the selected filters.
        </div>
      ) : (
        <DualScroll>
          <table className="table" style={{ minWidth: 1680 }}>
            <thead>
              <tr>
                <th className="col-first">Trip No.</th><th>Gated</th><th>Item</th><th>Vehicle</th><th>Driver</th><th>Route</th>
                <th style={{ textAlign: 'right' }}>Tons</th><th style={{ textAlign: 'right' }}>KM</th><th style={{ textAlign: 'right' }}>Diesel</th>
                <th style={{ textAlign: 'right' }}>AdBlue</th><th style={{ textAlign: 'right' }}>Toll</th><th style={{ textAlign: 'right' }}>Other</th><th style={{ textAlign: 'right' }}>Expense</th>
                {showFinancials && <th style={{ textAlign: 'right' }}>Revenue</th>}
                {showFinancials && <th style={{ textAlign: 'right' }}>Profit</th>}
                <th>Docs</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const c = tripCost(t);
                return (
                  <tr key={t.id}>
                    <td className="col-first" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap', fontWeight: 600 }}>{t.waybillNo}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.loadDate} → {t.unloadDate}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap', color: 'var(--color-neutral-700)' }}>{t.itemNo}</td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{t.vehicle}</td>
                    <td>{t.driver}</td>
                    <td style={{ color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>
                      {[t.from, ...t.stops.map((st) => st.location), t.to].join(' → ')}
                      {t.stops.length > 0 && <span style={{ marginLeft: 6, fontSize: 11 }}>({t.stops.length} {t.stops.length === 1 ? 'stop' : 'stops'})</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatNum(t.tons, 1)}</td>
                    <td style={{ textAlign: 'right' }}>{formatNum(t.km)}</td>
                    <td style={{ textAlign: 'right' }}>{rupees(c.diesel)}</td>
                    <td style={{ textAlign: 'right' }}>{c.adblue ? rupees(c.adblue) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{rupees(c.toll)}</td>
                    <td style={{ textAlign: 'right' }}>{rupees(c.other)}</td>
                    <td style={{ textAlign: 'right' }}>{rupees(c.expense)}</td>
                    {showFinancials && <td style={{ textAlign: 'right' }}>{rupees(t.revenue)}</td>}
                    {showFinancials && (
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: c.profit >= 0 ? 'var(--color-profit)' : 'var(--color-accent-700)', fontWeight: 700 }}>{rupees(c.profit)}</span>
                      </td>
                    )}
                    <td style={{ textAlign: 'right', color: 'var(--color-neutral-700)' }}>{t.documents.length || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {t.status !== 'approved' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={t.status === 'pending' ? 'tag tag-accent' : 'tag tag-outline'}>
                            {t.status === 'pending' ? 'Pending' : 'Draft'}
                          </span>
                          {(isDriver || isOffice || isManager) && (
                            <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => onEdit(t)}>
                              Edit
                            </button>
                          )}
                          {!isDriver && (
                            <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setCompleting(t)}>
                              Complete Trip
                            </button>
                          )}
                          {(t.status === 'draft' || !isDriver) && (
                            <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12, color: 'var(--color-accent-700)' }} onClick={() => onDelete(t)}>
                              Delete
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="tag tag-outline">Approved</span>
                          {(isOffice || isManager) && (
                            <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => onEdit(t)}>
                              View / Edit
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DualScroll>
      )}

      {completing && (() => {
        const c = tripCost(completing);
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(32,30,29,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 16px', overflowY: 'auto' }}
            onMouseDown={(e) => { if (e.target === e.currentTarget && !completingBusy) setCompleting(null); }}
          >
            <div role="dialog" aria-modal="true" aria-label="Complete movement" style={{ width: '100%', maxWidth: 640 }}>
              <MovementReview
                action="complete"
                form={formFromTrip(completing)}
                original={null}
                lines={completing.expenses}
                originalLines={[]}
                stops={completing.stops}
                originalStops={[]}
                documents={completing.documents}
                originalDocuments={[]}
                showFinancials={showFinancials}
                wasCompleted={false}
                totals={{ km: completing.km, expense: c.expense, profit: c.profit }}
                onConfirm={() => confirmComplete(completing)}
                onBack={() => setCompleting(null)}
                standalone={{ blockers: completionBlockers(completing), busy: completingBusy, onEdit: () => { const t = completing; setCompleting(null); onEdit(t); } }}
              />
            </div>
          </div>
        );
      })()}
    </section>
  );
}
