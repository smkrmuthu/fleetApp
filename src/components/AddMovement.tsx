import { useRef, useState } from 'react';
import type { DriverMaster, Trip, TripExpenseKind, TripExpenseLine, TripFormState, Vehicle } from '../types';
import { SCAN_FIELDS, TRIP_EXPENSE_LABEL } from '../data/mockData';
import { dieselLitres, rupees, toNumber } from '../utils/calc';

function blankForm(driver = ''): TripFormState {
  return {
    loadDate: '2026-09-11', unloadDate: '', vehicle: '', driver,
    waybillNo: '', itemNo: '', from: '', to: '', tons: '', odoStart: '', odoEnd: '',
    revenue: '0', remarks: ''
  };
}

type FuelEntryMode = 'litres' | 'amount';

function blankLine(): { date: string; kind: TripExpenseKind; entryMode: FuelEntryMode; litres: string; ratePerLitre: string; amount: string; details: string } {
  return { date: '2026-09-11', kind: 'diesel', entryMode: 'litres', litres: '', ratePerLitre: '95', amount: '0', details: '' };
}

const EXPENSE_KINDS: TripExpenseKind[] = ['diesel', 'adblue', 'toll', 'other'];

interface Props {
  onAdd: (trip: Trip) => void;
  driverOnly: boolean;
  vehicles: Vehicle[];
  drivers: DriverMaster[];
  lockedDriverName?: string;
}

export function AddMovement({ onAdd, driverOnly, vehicles, drivers, lockedDriverName }: Props) {
  const showFinancials = !driverOnly;
  const [form, setForm] = useState<TripFormState>(() => blankForm(lockedDriverName));
  const [lines, setLines] = useState<TripExpenseLine[]>([]);
  const [newLine, setNewLine] = useState(blankLine());
  const [documents, setDocuments] = useState<string[]>([]);
  const [scanned, setScanned] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof TripFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value } as TripFormState));

  const needsFuelFields = newLine.kind === 'diesel' || newLine.kind === 'adblue';
  const needsDetails = newLine.kind === 'other';
  const byLitres = needsFuelFields && newLine.entryMode === 'litres';
  const computedAmount = byLitres ? toNumber(newLine.litres) * toNumber(newLine.ratePerLitre) : toNumber(newLine.amount);

  function addLine() {
    const amount = byLitres ? computedAmount : toNumber(newLine.amount);
    if (!amount) return;
    if (needsDetails && !newLine.details.trim()) return;
    const line: TripExpenseLine = {
      id: 'x' + Date.now(),
      date: newLine.date,
      kind: newLine.kind,
      amount,
      ...(byLitres ? { litres: toNumber(newLine.litres), ratePerLitre: toNumber(newLine.ratePerLitre) } : {}),
      ...(needsDetails ? { details: newLine.details.trim() } : {})
    };
    setLines((prev) => [...prev, line]);
    setNewLine(blankLine());
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function onFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setDocuments((prev) => [...prev, ...files.map((f) => f.name)]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeDocument(name: string) {
    setDocuments((prev) => prev.filter((d) => d !== name));
  }

  const km = Math.max(0, toNumber(form.odoEnd) - toNumber(form.odoStart));
  const expense = lines.reduce((a, l) => a + l.amount, 0);
  const profit = toNumber(form.revenue) - expense;
  const litres = dieselLitres(lines);
  const kmpl = litres ? (km / litres).toFixed(2) + ' km/l' : '—';

  function addTrip() {
    if (!form.vehicle || !form.driver) return;
    const trip: Trip = {
      id: 't' + Date.now(),
      loadDate: form.loadDate, unloadDate: form.unloadDate || form.loadDate, vehicle: form.vehicle, driver: form.driver,
      waybillNo: form.waybillNo || '—', itemNo: form.itemNo || '—', from: form.from || '—', to: form.to || '—',
      tons: toNumber(form.tons), km, odoStart: toNumber(form.odoStart), odoEnd: toNumber(form.odoEnd), revenue: toNumber(form.revenue),
      status: driverOnly ? 'pending' : 'approved',
      expenses: lines,
      documents
    };
    onAdd(trip);
    setForm(blankForm(lockedDriverName));
    setLines([]);
    setDocuments([]);
    setScanned(false);
  }

  function applyScan() {
    setScanned(false);
    setForm((f) => ({ ...f, vehicle: f.vehicle || 'TN38 AB 4412' }));
    setLines((prev) => [...prev, { id: 'x' + Date.now(), date: '2026-09-11', kind: 'diesel', litres: 162.4, ratePerLitre: 95, amount: 15428 }]);
    setDocuments((prev) => [...prev, 'scanned_fuel_receipt.jpg']);
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
            <div className="field">
              <label>Driver *</label>
              {lockedDriverName ? (
                <input className="input" type="text" value={form.driver} disabled />
              ) : (
                <select className="input" value={form.driver} onChange={set('driver')}>
                  <option value="">Select driver</option>
                  {drivers.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              )}
            </div>
            <div className="field"><label>Waybill no *</label><input className="input" type="text" placeholder="EWB 0000 0000 0000" value={form.waybillNo} onChange={set('waybillNo')} /></div>
            <div className="field"><label>Item no</label><input className="input" type="text" placeholder="ITM-0000" value={form.itemNo} onChange={set('itemNo')} /></div>
            <div className="field"><label>Loading location</label><input className="input" type="text" placeholder="Yard / factory" value={form.from} onChange={set('from')} /></div>
            <div className="field"><label>Unloading location</label><input className="input" type="text" placeholder="Warehouse / yard" value={form.to} onChange={set('to')} /></div>
            <div className="field"><label>Loading weight (tons)</label><input className="input" type="number" value={form.tons} onChange={set('tons')} /></div>
            <div className="field"><label>Odometer start (km)</label><input className="input" type="number" value={form.odoStart} onChange={set('odoStart')} /></div>
            <div className="field"><label>Odometer end (km)</label><input className="input" type="number" value={form.odoEnd} onChange={set('odoEnd')} /></div>
            {showFinancials && (
              <div className="field"><label>Revenue (₹)</label><input className="input" type="number" value={form.revenue} onChange={set('revenue')} /></div>
            )}
            <div className="field" style={{ gridColumn: 'span 2' }}><label>Remarks</label><input className="input" type="text" placeholder="Remarks" value={form.remarks} onChange={set('remarks')} /></div>
          </div>

          <div style={{ marginTop: 20, borderTop: '2px solid var(--color-divider)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', marginBottom: 12 }}>
              Fuel &amp; expense stops — a multi-day trip can have several
            </div>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Kind</label>
              <div style={{ display: 'flex', border: '2px solid var(--color-text)', width: 'fit-content' }}>
                {EXPENSE_KINDS.map((k, i) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setNewLine((l) => ({ ...l, kind: k }))}
                    style={{
                      appearance: 'none', border: 0, borderLeft: i > 0 ? '2px solid var(--color-text)' : 'none',
                      background: newLine.kind === k ? 'var(--color-accent)' : 'transparent',
                      color: newLine.kind === k ? '#fff' : 'var(--color-text)',
                      fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
                      padding: '7px 14px', cursor: 'pointer'
                    }}
                  >
                    {TRIP_EXPENSE_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>

            {needsFuelFields && (
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Enter by</label>
                <div style={{ display: 'flex', border: '2px solid var(--color-divider)', width: 'fit-content' }}>
                  {(['litres', 'amount'] as FuelEntryMode[]).map((mode, i) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setNewLine((l) => ({ ...l, entryMode: mode }))}
                      style={{
                        appearance: 'none', border: 0, borderLeft: i > 0 ? '2px solid var(--color-divider)' : 'none',
                        background: newLine.entryMode === mode ? 'var(--color-text)' : 'transparent',
                        color: newLine.entryMode === mode ? 'var(--color-bg)' : 'var(--color-text)',
                        fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase',
                        padding: '6px 12px', cursor: 'pointer'
                      }}
                    >
                      {mode === 'litres' ? 'Litres × rate' : 'Fixed amount'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="filters-grid" style={{ alignItems: 'end', marginBottom: 12 }}>
              <div className="field">
                <label>Date</label>
                <input className="input" type="date" value={newLine.date} onChange={(e) => setNewLine((l) => ({ ...l, date: e.target.value }))} />
              </div>
              {needsFuelFields ? (
                <>
                  <div className="field" style={{ opacity: byLitres ? 1 : 0.45 }}>
                    <label>Litres</label>
                    <input className="input" type="number" disabled={!byLitres} value={newLine.litres} onChange={(e) => setNewLine((l) => ({ ...l, litres: e.target.value }))} />
                  </div>
                  <div className="field" style={{ opacity: byLitres ? 1 : 0.45 }}>
                    <label>Rate / litre (₹)</label>
                    <input className="input" type="number" disabled={!byLitres} value={newLine.ratePerLitre} onChange={(e) => setNewLine((l) => ({ ...l, ratePerLitre: e.target.value }))} />
                  </div>
                  {byLitres ? (
                    <div>
                      <div className="stat-label" style={{ marginBottom: 4 }}>Amount</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18 }}>{rupees(computedAmount)}</div>
                    </div>
                  ) : (
                    <div className="field">
                      <label>Amount (₹)</label>
                      <input className="input" type="number" placeholder="3000" value={newLine.amount} onChange={(e) => setNewLine((l) => ({ ...l, amount: e.target.value }))} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="field">
                    <label>Amount (₹)</label>
                    <input className="input" type="number" value={newLine.amount} onChange={(e) => setNewLine((l) => ({ ...l, amount: e.target.value }))} />
                  </div>
                  {needsDetails && (
                    <div className="field">
                      <label>Details *</label>
                      <input className="input" type="text" placeholder="What was this for?" value={newLine.details} onChange={(e) => setNewLine((l) => ({ ...l, details: e.target.value }))} />
                    </div>
                  )}
                </>
              )}
              <button type="button" className="btn btn-secondary" style={{ justifySelf: 'start' }} onClick={addLine}>Add stop</button>
            </div>

            {lines.length > 0 && (
              <div className="scroll-x" style={{ border: '1px solid var(--color-neutral-300)' }}>
                <table className="table" style={{ minWidth: 620 }}>
                  <thead>
                    <tr><th>Date</th><th>Kind</th><th>Details</th><th style={{ textAlign: 'right' }}>Litres</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{l.date}</td>
                        <td>{TRIP_EXPENSE_LABEL[l.kind]}</td>
                        <td style={{ color: 'var(--color-neutral-700)' }}>{l.details ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>{l.litres ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>{rupees(l.amount)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeLine(l.id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16, borderTop: '2px solid var(--color-divider)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', marginBottom: 12 }}>Supporting documents</div>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf" onChange={onFilesChosen} style={{ marginBottom: documents.length ? 10 : 0 }} />
            {documents.length > 0 && (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                {documents.map((d) => (
                  <li key={d} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: 'var(--color-surface)', padding: '6px 10px' }}>
                    <span>{d}</span>
                    <button type="button" className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 12 }} onClick={() => removeDocument(d)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 16, marginTop: 16, borderTop: '2px solid var(--color-divider)' }}>
            <button type="button" className="btn btn-primary" onClick={addTrip}>Add movement</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setForm(blankForm(lockedDriverName)); setLines([]); setDocuments([]); }}>Clear</button>
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
            <div style={{ color: 'var(--color-neutral-700)', marginBottom: 16 }}>JPG, PNG or PDF. Fields are read and added as a new stop below — you confirm before saving.</div>
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
                <button type="button" className="btn btn-primary btn-block" onClick={applyScan}>Add as a stop</button>
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
