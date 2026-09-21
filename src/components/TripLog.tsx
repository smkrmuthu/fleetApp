import type { DriverMaster, Role, Trip, Vehicle } from '../types';
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
  onApprove: (tripId: string) => void;
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
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary">Export Excel</button>
            <button type="button" className="btn btn-secondary">Backup data</button>
            <button type="button" className="btn btn-primary" onClick={onAddMovement}>Add movement</button>
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
        <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
          <table className="table" style={{ minWidth: 1680 }}>
            <thead>
              <tr>
                <th>Gated</th><th>Invoice No.</th><th>Item</th><th>Vehicle</th><th>Driver</th><th>Route</th>
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
                    <td style={{ whiteSpace: 'nowrap' }}>{t.loadDate} → {t.unloadDate}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{t.waybillNo}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap', color: 'var(--color-neutral-700)' }}>{t.itemNo}</td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{t.vehicle}</td>
                    <td>{t.driver}</td>
                    <td style={{ color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{t.from} → {t.to}</td>
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
                            <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => onApprove(t.id)}>
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
        </div>
      )}
    </section>
  );
}
