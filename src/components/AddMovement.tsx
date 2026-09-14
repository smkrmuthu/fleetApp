import { useEffect, useRef, useState } from 'react';
import type { DriverMaster, Trip, TripDocument, TripExpenseKind, TripExpenseLine, TripFormState, Vehicle } from '../types';
import { TRIP_EXPENSE_LABEL } from '../data/mockData';
import { dieselLitres, rupees, todayIso, toNumber } from '../utils/calc';
import { fetchDocumentBlobUrl, parseDisplayDate, scanReceipt, type ScannedReceipt } from '../lib/api';

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.slice(result.indexOf(',') + 1), mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function normalizeReg(v: string): string {
  return v.replace(/\s+/g, '').toUpperCase();
}

function mapFuelType(fuelType?: string): TripExpenseKind {
  return (fuelType ?? '').toLowerCase().includes('adblue') ? 'adblue' : 'diesel';
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
  const [documents, setDocuments] = useState<TripDocument[]>(() => editingTrip?.documents ?? []);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScannedReceipt | null>(null);
  const [scanFile, setScanFile] = useState<{ base64: string; mimeType: string; filename: string } | null>(null);
  const [scanErrorMsg, setScanErrorMsg] = useState('');
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<SubmitAction | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const errorBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const count = Object.keys(errors).length;
    if (count === 0) return;
    setToast(`${count} field${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention`);
    errorBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [errors]);

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

  async function onFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    for (const file of files) {
      try {
        const { base64, mimeType } = await fileToBase64(file);
        setDocuments((prev) => [...prev, { id: 'x' + Date.now() + Math.random().toString(36).slice(2), filename: file.name, mimeType, base64 }]);
      } catch {
        // a file that failed to read locally is simply skipped
      }
    }
  }

  function removeDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  async function viewDocument(doc: TripDocument) {
    if (doc.base64) {
      const byteChars = atob(doc.base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: doc.mimeType || 'application/octet-stream' }));
      window.open(url, '_blank');
      return;
    }
    if (!editingTrip) return;
    setViewingDoc(doc.id);
    try {
      const url = await fetchDocumentBlobUrl(editingTrip.id, doc.id);
      window.open(url, '_blank');
    } catch {
      setScanErrorMsg('Could not open that file — try again.');
    } finally {
      setViewingDoc(null);
    }
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
    if (form.unloadDate && form.unloadDate < form.loadDate) {
      errs.unloadDate = 'Unloading date cannot be before the loading date.';
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

  async function onScanFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (scanFileInputRef.current) scanFileInputRef.current.value = '';
    if (!file) return;
    setScanning(true);
    setScanErrorMsg('');
    setScanResult(null);
    setScanFile(null);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const result = await scanReceipt(base64, mimeType);
      setScanResult(result);
      setScanFile({ base64, mimeType, filename: file.name });
      if (!form.vehicle && result.vehicleNo) {
        const match = vehicles.find((v) => normalizeReg(v.id) === normalizeReg(result.vehicleNo!));
        if (match) setForm((f) => ({ ...f, vehicle: match.id }));
      }
    } catch (err) {
      setScanErrorMsg(err instanceof Error ? err.message : 'Could not read the receipt — try again or enter it manually');
    } finally {
      setScanning(false);
    }
  }

  function discardScan() {
    setScanResult(null);
    setScanFile(null);
  }

  function addScannedEntry() {
    if (!scanResult) return;
    const line: TripExpenseLine = {
      id: 'x' + Date.now(),
      date: scanResult.date && /^\d{4}-\d{2}-\d{2}$/.test(scanResult.date) ? scanResult.date : todayIso(),
      kind: mapFuelType(scanResult.fuelType),
      litres: scanResult.litres,
      ratePerLitre: scanResult.ratePerLitre,
      amount: scanResult.amount
    };
    setLines((prev) => [...prev, line]);
    if (scanFile) {
      setDocuments((prev) => [...prev, { id: 'x' + Date.now() + Math.random().toString(36).slice(2), filename: scanFile.filename, mimeType: scanFile.mimeType, base64: scanFile.base64 }]);
    }
    setScanResult(null);
    setScanFile(null);
  }

  const errorClass = (key: string) => (errors[key] ? 'input input-error' : 'input');

  return (
    <section>
      {toast && (
        <div
          role="alert"
          style={{
            position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
            background: 'var(--color-accent)', color: '#fff', padding: '10px 22px', fontSize: 13, fontWeight: 700,
            letterSpacing: '0.02em', boxShadow: '0 6px 20px rgba(0,0,0,0.25)'
          }}
        >
          {toast}
        </div>
      )}
      <div style={{ marginBottom: 18 }}>
        <div className="kicker">Driver or documentation resource</div>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>{isEditing ? 'Edit Movement' : 'Add Movement'}</h1>
        <p style={{ color: 'var(--color-neutral-700)', marginTop: 6, fontSize: 13 }}>
          {isEditing ? 'Update an open movement, add entries to it, or mark it complete.' : 'Start a new movement, or scan/enter its fuel and expense entries as you go.'}
        </p>
      </div>
      <div className="movement-grid">
        <div style={{ background: 'var(--color-bg)', padding: 20, border: '2px solid var(--color-divider)' }}>
          <div className="filters-grid" style={{ alignItems: 'stretch' }}>
            <div className="field"><label>Loading date</label><input className="input" type="date" value={form.loadDate} onChange={set('loadDate')} /></div>
            <div className="field"><label>Unloading date</label><input className={errorClass('unloadDate')} type="date" min={form.loadDate} value={form.unloadDate} onChange={set('unloadDate')} /></div>
            <div className="field">
              <label>Vehicle *</label>
              <select className={errorClass('vehicle')} value={form.vehicle} onChange={set('vehicle')}>
                <option value="">Select vehicle</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Driver *</label>
              {lockedDriverName ? (
                <input className="input" type="text" value={form.driver} disabled />
              ) : (
                <select className={errorClass('driver')} value={form.driver} onChange={set('driver')}>
                  <option value="">Select driver</option>
                  {drivers.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              )}
            </div>
            <div className="field"><label>Waybill no *</label><input className={errorClass('waybillNo')} type="text" placeholder="EWB 0000 0000 0000" value={form.waybillNo} onChange={set('waybillNo')} /></div>
            <div className="field"><label>Item no</label><input className="input" type="text" placeholder="ITM-0000" value={form.itemNo} onChange={set('itemNo')} /></div>
            <div className="field"><label>Loading location</label><input className="input" type="text" placeholder="Yard / factory" value={form.from} onChange={set('from')} /></div>
            <div className="field"><label>Unloading location</label><input className="input" type="text" placeholder="Warehouse / yard" value={form.to} onChange={set('to')} /></div>
            <div className="field"><label>Loading weight (tons)</label><input className={errorClass('tons')} type="number" step="any" inputMode="decimal" value={form.tons} onChange={set('tons')} /></div>
            <div className="field"><label>Odometer start (km)</label><input className={errorClass('odoStart')} type="number" value={form.odoStart} onChange={set('odoStart')} /></div>
            <div className="field"><label>Odometer end (km)</label><input className={errorClass('odoEnd')} type="number" value={form.odoEnd} onChange={set('odoEnd')} /></div>
            {showFinancials && (
              <div className="field"><label>Revenue (₹)</label><input className="input" type="number" step="any" inputMode="decimal" value={form.revenue} onChange={set('revenue')} /></div>
            )}
            <div className="field field-span-2"><label>Remarks</label><input className="input" type="text" placeholder="Remarks" value={form.remarks} onChange={set('remarks')} /></div>
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
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button type="button" className="btn btn-secondary" onClick={addLine}>Add entry</button>
                <span style={{ color: 'var(--color-neutral-500)', fontSize: 12 }}>or</span>
                <input
                  ref={scanFileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onScanFileChosen}
                  style={{ display: 'none' }}
                />
                <button type="button" className="btn btn-secondary" disabled={scanning} onClick={() => scanFileInputRef.current?.click()}>
                  {scanning && <span className="spinner" style={{ marginRight: 8 }} />}
                  {scanning ? 'Reading receipt…' : 'Scan a receipt'}
                </button>
              </div>
            </div>

            {scanErrorMsg && (
              <div style={{ border: '2px solid var(--color-accent)', color: 'var(--color-accent-700)', padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                {scanErrorMsg}
              </div>
            )}

            {scanResult && (
              <div style={{ marginBottom: 16, border: '2px solid var(--color-text)' }}>
                <div style={{ background: 'var(--color-text)', color: 'var(--color-bg)', padding: '8px 12px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Parsed — confirm
                </div>
                {[
                  { label: 'Vendor', value: scanResult.vendor || '—' },
                  { label: 'Date', value: scanResult.date || '—' },
                  { label: 'Vehicle on bill', value: scanResult.vehicleNo || '—' },
                  { label: 'Fuel', value: scanResult.fuelType || '—' },
                  { label: 'Litres', value: scanResult.litres.toString() },
                  { label: 'Price / litre', value: rupees(scanResult.ratePerLitre) },
                  { label: 'Amount', value: rupees(scanResult.amount) }
                ].map((f) => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--color-neutral-300)' }}>
                    <span style={{ color: 'var(--color-neutral-700)' }}>{f.label}</span>
                    <span style={{ fontWeight: 600 }}>{f.value}</span>
                  </div>
                ))}
                <div style={{ padding: 12, display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-primary btn-block" onClick={addScannedEntry}>Add as an entry</button>
                  <button type="button" className="btn btn-ghost" onClick={discardScan}>Discard</button>
                </div>
              </div>
            )}

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
                  <li key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13, background: 'var(--color-surface)', padding: '6px 10px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.filename}</span>
                    <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button type="button" className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 12 }} disabled={viewingDoc === d.id} onClick={() => viewDocument(d)}>
                        {viewingDoc === d.id ? 'Opening…' : 'View'}
                      </button>
                      <button type="button" className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 12 }} onClick={() => removeDocument(d.id)}>Remove</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {Object.keys(errors).length > 0 && (
            <div ref={errorBoxRef} style={{ border: '2px solid var(--color-accent)', color: 'var(--color-accent-700)', padding: '10px 14px', marginTop: 16, fontSize: 13, display: 'grid', gap: 4 }}>
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

        </div>

        <div className="movement-sidebar">
          <div style={{ background: 'var(--color-bg)', padding: 20, border: '2px solid var(--color-divider)', display: 'grid', gap: 18 }}>
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
            <div style={{ borderTop: '2px solid var(--color-divider)', paddingTop: 14, fontSize: 12, color: 'var(--color-neutral-700)', lineHeight: 1.6 }}>
              {driverOnly
                ? 'Start a movement to open it, add fuel/expense entries as the trip goes, then Complete it once the closing odometer reading is in — that sends it for approval. Every edit is written to the audit trail.'
                : 'Documentation and manager entries post straight to the log as approved. Every edit is written to the audit trail.'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
