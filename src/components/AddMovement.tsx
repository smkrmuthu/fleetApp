import { useState } from 'react';
import type { Trip, TripFormState, Vehicle } from '../types';
import { SCAN_FIELDS } from '../data/mockData';
import { rupees, toNumber } from '../utils/calc';

function blankForm(): TripFormState {
  return {
    loadDate: '2026-09-11', unloadDate: '', vehicle: '', driver: '', direction: 'Import',
    bl: '', container: '', from: '', to: '', tons: '', odoStart: '', odoEnd: '',
    litres: '', price: '95', toll: '0', other: '0', revenue: '0', remarks: ''
  };
}

interface Props {
  onAdd: (trip: Trip) => void;
  driverOnly: boolean;
  vehicles: Vehicle[];
}

export function AddMovement({ onAdd, driverOnly, vehicles }: Props) {
  const showFinancials = !driverOnly;
  const [form, setForm] = useState<TripFormState>(blankForm());
  const [scanned, setScanned] = useState(false);

  const set = (k: keyof TripFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value } as TripFormState));

  const km = Math.max(0, toNumber(form.odoEnd) - toNumber(form.odoStart));
  const expense = toNumber(form.litres) * toNumber(form.price) + toNumber(form.toll) + toNumber(form.other);
  const profit = toNumber(form.revenue) - expense;
  const kmpl = toNumber(form.litres) ? (km / toNumber(form.litres)).toFixed(2) + ' km/l' : '—';

  function addTrip() {
    if (!form.vehicle || !form.driver) return;
    const trip: Trip = {
      id: 't' + Date.now(),
      loadDate: '11 Sep', unloadDate: '12 Sep', vehicle: form.vehicle, driver: form.driver, direction: form.direction,
      bl: form.bl || '—', container: form.container || '—', from: form.from || '—', to: form.to || '—',
      tons: toNumber(form.tons), km, litres: toNumber(form.litres), pricePerLitre: toNumber(form.price),
      toll: toNumber(form.toll), other: toNumber(form.other), revenue: toNumber(form.revenue),
      status: driverOnly ? 'pending' : 'approved'
    };
    onAdd(trip);
    setForm(blankForm());
    setScanned(false);
  }

  function applyScan() {
    setScanned(false);
    setForm((f) => ({ ...f, vehicle: 'TN38 AB 4412', litres: '162.4', price: '95', loadDate: '2026-09-11' }));
  }

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <div className="kicker">Driver or documentation resource</div>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>Add Movement</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1fr)', gap: 2, background: 'var(--color-divider)', border: '2px solid var(--color-divider)' }}>
        <div style={{ background: 'var(--color-bg)', padding: 20 }}>
          <div className="filters-grid" style={{ alignItems: 'stretch' }}>
            <div className="field"><label>Loading date</label><input className="input" type="date" value={form.loadDate} onChange={set('loadDate')} /></div>
            <div className="field"><label>Unloading date</label><input className="input" type="date" value={form.unloadDate} onChange={set('unloadDate')} /></div>
            <div className="field">
              <label>Vehicle *</label>
              <select className="input" value={form.vehicle} onChange={set('vehicle')}>
                <option value="">Select vehicle</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
              </select>
            </div>
            <div className="field"><label>Driver *</label><input className="input" type="text" placeholder="Driver name" value={form.driver} onChange={set('driver')} /></div>
            <div className="field">
              <label>Direction *</label>
              <select className="input" value={form.direction} onChange={set('direction')}>
                <option value="Import">Import</option>
                <option value="Export">Export</option>
              </select>
            </div>
            <div className="field"><label>Shipment / BL no *</label><input className="input" type="text" placeholder="MAEU-0000000" value={form.bl} onChange={set('bl')} /></div>
            <div className="field"><label>Container no</label><input className="input" type="text" placeholder="MSKU 000000-0" value={form.container} onChange={set('container')} /></div>
            <div className="field"><label>Loading location</label><input className="input" type="text" placeholder="Port / factory" value={form.from} onChange={set('from')} /></div>
            <div className="field"><label>Unloading location</label><input className="input" type="text" placeholder="CFS / warehouse / port" value={form.to} onChange={set('to')} /></div>
            <div className="field"><label>Loading weight (tons)</label><input className="input" type="number" value={form.tons} onChange={set('tons')} /></div>
            <div className="field"><label>Odometer start (km)</label><input className="input" type="number" value={form.odoStart} onChange={set('odoStart')} /></div>
            <div className="field"><label>Odometer end (km)</label><input className="input" type="number" value={form.odoEnd} onChange={set('odoEnd')} /></div>
            <div className="field"><label>Diesel litres</label><input className="input" type="number" value={form.litres} onChange={set('litres')} /></div>
            <div className="field"><label>Diesel price / litre (₹)</label><input className="input" type="number" value={form.price} onChange={set('price')} /></div>
            <div className="field"><label>Toll (₹)</label><input className="input" type="number" value={form.toll} onChange={set('toll')} /></div>
            <div className="field"><label>Other expense (₹)</label><input className="input" type="number" value={form.other} onChange={set('other')} /></div>
            {showFinancials && (
              <div className="field"><label>Revenue (₹)</label><input className="input" type="number" value={form.revenue} onChange={set('revenue')} /></div>
            )}
            <div className="field" style={{ gridColumn: 'span 2' }}><label>Remarks</label><input className="input" type="text" placeholder="Remarks" value={form.remarks} onChange={set('remarks')} /></div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 20, marginTop: 20, borderTop: '2px solid var(--color-divider)' }}>
            <button type="button" className="btn btn-primary" onClick={addTrip}>Add movement</button>
            <button type="button" className="btn btn-secondary" onClick={() => setForm(blankForm())}>Clear</button>
            <button type="button" className="btn btn-ghost">Save draft</button>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 28, flexWrap: 'wrap', borderTop: '2px solid var(--color-divider)', paddingTop: 16 }}>
            <div>
              <div className="stat-label" style={{ marginBottom: 4 }}>Distance</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22 }}>{km.toLocaleString('en-IN')} km</div>
            </div>
            <div>
              <div className="stat-label" style={{ marginBottom: 4 }}>Trip expense</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22 }}>{rupees(expense)}</div>
            </div>
            {showFinancials && (
              <div>
                <div className="stat-label" style={{ marginBottom: 4 }}>Profit</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, color: profit >= 0 ? 'var(--color-profit)' : 'var(--color-accent-700)' }}>{rupees(profit)}</div>
              </div>
            )}
            <div>
              <div className="stat-label" style={{ marginBottom: 4 }}>Mileage</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22 }}>{kmpl}</div>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--color-bg)', padding: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', marginBottom: 12 }}>Or scan a receipt</div>
          <div style={{ border: '2px dashed var(--color-divider)', padding: '26px 18px' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Drop a fuel bill or toll slip</div>
            <div style={{ color: 'var(--color-neutral-700)', marginBottom: 16 }}>JPG, PNG or PDF. Fields are read and filled in below — you confirm before saving.</div>
            <button type="button" className="btn btn-secondary" onClick={() => setScanned(true)}>Scan receipt</button>
          </div>
          {scanned && (
            <div style={{ marginTop: 18, border: '2px solid var(--color-text)' }}>
              <div style={{ background: 'var(--color-text)', color: 'var(--color-bg)', padding: '8px 12px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Parsed — confirm
              </div>
              {SCAN_FIELDS.map((f) => (
                <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--color-neutral-300)' }}>
                  <span style={{ color: 'var(--color-neutral-700)' }}>{f.label}</span>
                  <span style={{ fontWeight: 600 }}>{f.value}</span>
                </div>
              ))}
              <div style={{ padding: 12 }}>
                <button type="button" className="btn btn-primary btn-block" onClick={applyScan}>Fill the form</button>
              </div>
            </div>
          )}
          <div style={{ marginTop: 22, borderTop: '2px solid var(--color-divider)', paddingTop: 14, fontSize: 12, color: 'var(--color-neutral-700)', lineHeight: 1.6 }}>
            Movements entered by a driver land as <strong>pending</strong>. Documentation and manager entries post straight to the log. Every edit is written to the audit trail.
          </div>
        </div>
      </div>
    </section>
  );
}
