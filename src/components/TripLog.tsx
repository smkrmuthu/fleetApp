import type { Trip, Vehicle } from '../types';
import { formatNum, rupees, tripCost } from '../utils/calc';

interface Props {
  trips: Trip[];
  vehicles: Vehicle[];
  vehicleFilter: string;
  driverFilter: string;
  onVehicleFilter: (v: string) => void;
  onDriverFilter: (v: string) => void;
  onResetFilters: () => void;
  onAddMovement: () => void;
  showFinancials: boolean;
}

export function TripLog({ trips, vehicles, vehicleFilter, driverFilter, onVehicleFilter, onDriverFilter, onResetFilters, onAddMovement, showFinancials }: Props) {
  const rows = trips.filter(
    (t) => (vehicleFilter === 'all' || t.vehicle === vehicleFilter) && (!driverFilter || t.driver.toLowerCase().includes(driverFilter.toLowerCase()))
  );

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div className="kicker">{rows.length} movements · September 2026</div>
          <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>Trip Log</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secondary">Export Excel</button>
          <button type="button" className="btn btn-secondary">Backup data</button>
          <button type="button" className="btn btn-primary" onClick={onAddMovement}>Add movement</button>
        </div>
      </div>

      <div style={{ border: '2px solid var(--color-divider)', padding: 16, marginBottom: 20 }}>
        <div className="filters-grid">
          <div className="field"><label>Loading date from</label><input className="input" type="date" defaultValue="2026-09-01" readOnly /></div>
          <div className="field"><label>Loading date to</label><input className="input" type="date" defaultValue="2026-09-30" readOnly /></div>
          <div className="field">
            <label>Vehicle</label>
            <select className="input" value={vehicleFilter} onChange={(e) => onVehicleFilter(e.target.value)}>
              <option value="all">All vehicles</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
            </select>
          </div>
          <div className="field"><label>Driver</label><input className="input" type="text" placeholder="Driver name" value={driverFilter} onChange={(e) => onDriverFilter(e.target.value)} /></div>
          <button type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={onResetFilters}>Reset filters</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ border: '2px solid var(--color-divider)', padding: 16, color: 'var(--color-neutral-700)' }}>
          No movements match the selected filters.
        </div>
      ) : (
        <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
          <table className="table" style={{ minWidth: 1560 }}>
            <thead>
              <tr>
                <th>Gated</th><th>Dir</th><th>Shipment / BL</th><th>Container</th><th>Vehicle</th><th>Driver</th><th>Route</th>
                <th style={{ textAlign: 'right' }}>Tons</th><th style={{ textAlign: 'right' }}>KM</th><th style={{ textAlign: 'right' }}>Diesel</th>
                <th style={{ textAlign: 'right' }}>Toll</th><th style={{ textAlign: 'right' }}>Other</th><th style={{ textAlign: 'right' }}>Expense</th>
                {showFinancials && <th style={{ textAlign: 'right' }}>Revenue</th>}
                {showFinancials && <th style={{ textAlign: 'right' }}>Profit</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const c = tripCost(t);
                return (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.loadDate} → {t.unloadDate}</td>
                    <td>
                      {t.direction === 'Import'
                        ? <span className="tag tag-neutral">IMP</span>
                        : <span className="tag tag-outline">EXP</span>}
                    </td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{t.bl}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap', color: 'var(--color-neutral-700)' }}>{t.container}</td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{t.vehicle}</td>
                    <td>{t.driver}</td>
                    <td style={{ color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{t.from} → {t.to}</td>
                    <td style={{ textAlign: 'right' }}>{formatNum(t.tons, 1)}</td>
                    <td style={{ textAlign: 'right' }}>{formatNum(t.km)}</td>
                    <td style={{ textAlign: 'right' }}>{rupees(c.diesel)}</td>
                    <td style={{ textAlign: 'right' }}>{rupees(t.toll)}</td>
                    <td style={{ textAlign: 'right' }}>{rupees(t.other)}</td>
                    <td style={{ textAlign: 'right' }}>{rupees(c.expense)}</td>
                    {showFinancials && <td style={{ textAlign: 'right' }}>{rupees(t.revenue)}</td>}
                    {showFinancials && (
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: c.profit >= 0 ? 'var(--color-profit)' : 'var(--color-accent-700)', fontWeight: 700 }}>{rupees(c.profit)}</span>
                      </td>
                    )}
                    <td>
                      {t.status === 'pending'
                        ? <span className="tag tag-accent">Pending</span>
                        : <span className="tag tag-outline">Approved</span>}
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
