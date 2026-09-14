import { useRef, useState } from 'react';
import type { DriverMaster, Trip, TripExpenseKind, TripExpenseLine, TripFormState, Vehicle } from '../types';
import { SCAN_FIELDS, TRIP_EXPENSE_LABEL } from '../data/mockData';
import { dieselLitres, rupees, toNumber } from '../utils/calc';
import { parseDisplayDate } from '../lib/api';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankForm(driver = ''): TripFormState {
  return {
    loadDate: todayIso(), unloadDate: '', vehicle: '', driver,
    waybillNo: '', itemNo: '', from: '', to: '', tons: '', odoStart: '', odoEnd: '',
    revenue: '0', remarks: ''
  };
}

function formFromTrip(trip: Trip): TripFormState {
  const clear = (v: string) => (v === '—' ? '' : v);
  return {
    loadDate: parseDisplayDate(trip.loadDate) || todayIso(), unloadDate: parseDisplayDate(clear(trip.unloadDate)), vehicle: trip.vehicle, driver: trip.driver,
    waybillNo: clear(trip.waybillNo), itemNo: clear(trip.itemNo), from: clear(trip.from), to: clear(trip.to),
    tons: trip.tons ? String(trip.tons) : '', odoStart: trip.odoStart != null ? String(trip.odoStart) : '',
    odoEnd: trip.odoEnd != null ? String(trip.odoEnd) : '', revenue: String(trip.revenue ?? 0), remarks: trip.remarks ?? ''
  };
}

type FuelEntryMode = 'litres' | 'amount';

function blankLine(): { date: string; kind: TripExpenseKind; entryMode: FuelEntryMode; litres: string; ratePerLitre: string; amount: string; details: string } {
  return { date: todayIso(), kind: 'diesel', entryMode: 'litres', litres: '', ratePerLitre: '95', amount: '0', details: '' };
}

const EXPENSE_KINDS: TripExpenseKind[] = ['diesel', 'adblue', 'toll', 'other'];

type SubmitAction = 'create' | 'start' | 'save' | 'complete';

interface Props {
  onSubmit: (action: SubmitAction, trip: Trip) => void;
  driverOnly: boolean;
  vehicles: Vehicle[];
  drivers: DriverMaster[];
  lockedDriverName?: string;
  editingTrip?: Trip | null;
  onCancelEdit?: () => void;
}

export function AddMovement({ onSubmit, driverOnly, vehicles, drivers, lockedDriverName, editingTrip, onCancelEdit }: Props) {
  const showFinancials = !driverOnly;
  const isEditing = !!editingTrip;
  const [form, setForm] = useState<TripFormState>(() => (editingTrip ? formFromTrip(editingTrip) : blankForm(lockedDriverName)));
  const [lines, setLines] = useState<TripExpenseLine[]>(() => editingTrip?.expenses ?? []);
  const [newLine, setNewLine] = useState(blankLine());
  const [documents, setDocuments] = useState<string[]>(() => editingTrip?.documents ?? []);
  const [scanned, setScanned] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<SubmitAction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof TripFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value } as TripFormState));
    setErrors({});
  };

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

  function validate(completing: boolean): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.vehicle) errs.vehicle = 'Select a vehicle.';
    if (!form.driver) errs.driver = 'Select a driver.';
    if (!form.waybillNo.trim()) errs.waybillNo = 'Waybill number is required.';
    if (completing) {
      if (!form.tons) errs.tons = 'Loading weight is required to complete this movement.';
      if (!form.odoStart) errs.odoStart = 'Odometer start is required to complete this movement.';
      if (!form.odoEnd) errs.odoEnd = 'Odometer end is required to complete this movement.';
    }
    if (form.odoEnd && toNumber(form.odoEnd) <= toNumber(form.odoStart)) {
      errs.odoEnd = 'Odometer end must be greater than odometer start.';
    }
    return errs;
  }

  function buildTrip(): Trip {
    return {
      id: editingTrip?.id ?? 't' + Date.now(),
      loadDate: form.loadDate, unloadDate: form.unloadDate || form.loadDate, vehicle: form.vehicle, driver: form.driver,
      waybillNo: form.waybillNo || '—', itemNo: form.itemNo || '—', from: form.from || '—', to: form.to || '—',
      tons: toNumber(form.tons), km,
      odoStart: form.odoStart ? toNumber(form.odoStart) : undefined,
      odoEnd: form.odoEnd ? toNumber(form.odoEnd) : undefined,
      revenue: toNumber(form.revenue),
      status: editingTrip?.status ?? 'pending',
      expenses: lines,
      documents
    };
  }

  function tryAction(action: SubmitAction, completing: boolean) {
    const errs = validate(completing);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setConfirmAction(action);
  }

  function confirmSubmit() {
    if (!confirmAction) return;
    onSubmit(confirmAction, buildTrip());
  }

  function resetForm() {
    if (editingTrip) {
      setForm(formFromTrip(editingTrip));
      setLines(editingTrip.expenses);
      setDocuments(editingTrip.documents);
    } else {
      setForm(blankForm(lockedDriverName));
      setLines([]);
      setDocuments([]);
    }
    setErrors({});
    setConfirmAction(null);
  }

  function applyScan() {
    setScanned(false);
    setForm((f) => ({ ...f, vehicle: f.vehicle || 'TN38 AB 4412' }));
    setLines((prev) => [...prev, { id: 'x' + Date.now(), date: todayIso(), kind: 'diesel', litres: 162.4, ratePerLitre: 95, amount: 15428 }]);
    setDocuments((prev) => [...prev, 'scanned_fuel_receipt.jpg']);
  }

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <div className="kicker">Driver or documentation resource</div>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>{isEditing ? 'Edit Movement' : 'Add Movement'}</h1>
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
            <div className="field"><label>Loading weight (tons)</label><input className="input" type="number" step="any" inputMode="decimal" value={form.tons} onChange={set('tons')} /></div>
            <div className="field"><label>Odometer start (km)</label><input className="input" type="number" value={form.odoStart} onChange={set('odoStart')} /></div>
            <div className="field"><label>Odometer end (km)</label><input className="input" type="number" value={form.odoEnd} onChange={set('odoEnd')} /></div>
            {showFinancials && (
              <div className="field"><label>Revenue (₹)</label><input className="input" type="number" step="any" inputMode="decimal" value={form.revenue} onChange={set('revenue')} /></div>
            )}
            <div className="field" style={{ gridColumn: 'span 2' }}><label>Remarks</label><input className="input" type="text" placeholder="Remarks" value={form.remarks} onChange={set('remarks')} /></div>
          </div>

          <div style={{ marginTop: 20, borderTop: '2px solid var(--color-divider)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', marginBottom: 12 }}>
              Fuel &amp; expense entries — a multi-day trip can have several
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
                    <input className="input" type="number" step="any" inputMode="decimal" disabled={!byLitres} value={newLine.litres} onChange={(e) => setNewLine((l) => ({ ...l, litres: e.target.value }))} />
                  </div>
                  <div className="field" style={{ opacity: byLitres ? 1 : 0.45 }}>
                    <label>Rate / litre (₹)</label>
                    <input className="input" type="number" step="any" inputMode="decimal" disabled={!byLitres} value={newLine.ratePerLitre} onChange={(e) => setNewLine((l) => ({ ...l, ratePerLitre: e.target.value }))} />
                  </div>
                  {byLitres ? (
                    <div>
                      <div className="stat-label" style={{ marginBottom: 4 }}>Amount</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18 }}>{rupees(computedAmount)}</div>
                    </div>
                  ) : (
                    <div className="field">
                      <label>Amount (₹)</label>
                      <input className="input" type="number" step="any" inputMode="decimal" placeholder="3000" value={newLine.amount} onChange={(e) => setNewLine((l) => ({ ...l, amount: e.target.value }))} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="field">
                    <label>Amount (₹)</label>
                    <input className="input" type="number" step="any" inputMode="decimal" value={newLine.amount} onChange={(e) => setNewLine((l) => ({ ...l, amount: e.target.value }))} />
                  </div>
                  {needsDetails && (
                    <div className="field">
                      <label>Details *</label>
                      <input className="input" type="text" placeholder="What was this for?" value={newLine.details} onChange={(e) => setNewLine((l) => ({ ...l, details: e.target.value }))} />
                    </div>
                  )}
                </>
              )}
              <button type="button" className="btn btn-secondary" style={{ justifySelf: 'start' }} onClick={addLine}>Add entry</button>
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

          {Object.keys(errors).length > 0 && (
            <div style={{ border: '2px solid var(--color-accent)', color: 'var(--color-accent-700)', padding: '10px 14px', marginTop: 16, fontSize: 13, display: 'grid', gap: 4 }}>
              {Object.values(errors).map((msg) => <div key={msg}>{msg}</div>)}
            </div>
          )}

          {confirmAction ? (
            <div style={{ border: '2px solid var(--color-text)', marginTop: 16 }}>
              <div style={{ background: 'var(--color-text)', color: 'var(--color-bg)', padding: '8px 12px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Confirm before saving
              </div>
              <div style={{ padding: 12, display: 'grid', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--color-neutral-700)' }}>Vehicle</span><span style={{ fontWeight: 600 }}>{form.vehicle}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--color-neutral-700)' }}>Driver</span><span style={{ fontWeight: 600 }}>{form.driver}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--color-neutral-700)' }}>Waybill</span><span style={{ fontWeight: 600 }}>{form.waybillNo}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--color-neutral-700)' }}>Route</span><span style={{ fontWeight: 600 }}>{form.from || '—'} → {form.to || '—'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: 'var(--color-neutral-700)' }}>Odometer</span>
                  <span style={{ fontWeight: 600 }}>{form.odoStart || '0'} km{form.odoEnd ? ` → ${form.odoEnd} km` : ' (end not set yet)'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--color-neutral-700)' }}>Fuel &amp; expense entries</span><span style={{ fontWeight: 600 }}>{lines.length}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--color-neutral-700)' }}>Trip expense so far</span><span style={{ fontWeight: 600 }}>{rupees(expense)}</span></div>
                {confirmAction === 'start' && <div style={{ color: 'var(--color-neutral-700)' }}>This saves as an open movement — you can keep adding entries and complete it later.</div>}
                {confirmAction === 'complete' && <div style={{ color: 'var(--color-neutral-700)' }}>This marks the movement complete and sends it for approval.</div>}
                {confirmAction === 'create' && driverOnly && <div style={{ color: 'var(--color-neutral-700)' }}>This submits the movement for approval now.</div>}
              </div>
              <div style={{ display: 'flex', gap: 10, padding: 12, borderTop: '1px solid var(--color-neutral-300)' }}>
                <button type="button" className="btn btn-primary" onClick={confirmSubmit}>Confirm &amp; save</button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmAction(null)}>Back to edit</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 16, marginTop: 16, borderTop: '2px solid var(--color-divider)' }}>
              {isEditing ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => tryAction('save', false)}>Save changes</button>
                  <button type="button" className="btn btn-secondary" onClick={() => tryAction('complete', true)}>Complete movement</button>
                  <button type="button" className="btn btn-ghost" onClick={onCancelEdit}>Cancel edit</button>
                </>
              ) : driverOnly ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => tryAction('start', false)}>Start movement</button>
                  <button type="button" className="btn btn-secondary" onClick={() => tryAction('create', true)}>Complete movement now</button>
                  <button type="button" className="btn btn-ghost" onClick={resetForm}>Clear</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => tryAction('create', true)}>Add movement</button>
                  <button type="button" className="btn btn-ghost" onClick={resetForm}>Clear</button>
                </>
              )}
            </div>
          )}

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
            <div style={{ color: 'var(--color-neutral-700)', marginBottom: 16 }}>JPG, PNG or PDF. Fields are read and added as a new entry below — you confirm before saving.</div>
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
                <button type="button" className="btn btn-primary btn-block" onClick={applyScan}>Add as an entry</button>
              </div>
            </div>
          )}
          <div style={{ marginTop: 22, borderTop: '2px solid var(--color-divider)', paddingTop: 14, fontSize: 12, color: 'var(--color-neutral-700)', lineHeight: 1.6 }}>
            {driverOnly
              ? 'Start a movement to open it, add fuel/expense entries as the trip goes, then Complete it once the closing odometer reading is in — that sends it for approval. Every edit is written to the audit trail.'
              : 'Documentation and manager entries post straight to the log as approved. Every edit is written to the audit trail.'}
          </div>
        </div>
      </div>
    </section>
  );
}
