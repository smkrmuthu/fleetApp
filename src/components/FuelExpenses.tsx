import { useMemo, useRef, useState } from 'react';
import type { DriverMaster, MasterSettings, Role, Trip, TripDocument, TripExpenseLine, Vehicle } from '../types';
import { parseDisplayDate, scanReceipt, type ScannedReceipt } from '../lib/api';
import { rupees, todayIso, toNumber } from '../utils/calc';

const round2 = (n: number) => Math.round(n * 100) / 100;

function normalizeReg(v: string): string {
  return v.replace(/\s+/g, '').toUpperCase();
}

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

interface Props {
  trips: Trip[];
  vehicles: Vehicle[];
  drivers: DriverMaster[];
  master: MasterSettings;
  role: Role;
  // Posts one diesel line to a trip (and the scanned bill, if any, to that
  // trip's documents). `ok: false` means nothing was saved; `ok: true` with a
  // message means it was saved but something minor (the bill photo) wasn't.
  onPost: (trip: Trip, line: TripExpenseLine, bill: TripDocument | null) => Promise<{ ok: boolean; message: string | null }>;
  onDelete: (trip: Trip, line: TripExpenseLine) => Promise<string | null>;
}

const RECENT_LIMIT = 40;

export function FuelExpenses({ trips, vehicles, drivers, master, role, onPost, onDelete }: Props) {
  // Only trips that are still open can take fuel from here.
  const openTrips = useMemo(() => trips.filter((t) => t.status === 'draft'), [trips]);
  // A driver's trip list is already limited to their own trips by the server,
  // so for them the truck list is just the trucks they have an open trip on.
  const vehicleOptions = role === 'Driver' ? vehicles.filter((v) => openTrips.some((t) => t.vehicle === v.id)) : vehicles;

  const [date, setDate] = useState(todayIso());
  const [vehicle, setVehicle] = useState('');
  const [driver, setDriver] = useState('');
  const [litres, setLitres] = useState('');
  const [rateOverride, setRateOverride] = useState<string | null>(null);
  const [tripId, setTripId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanFile, setScanFile] = useState<{ base64: string; mimeType: string; filename: string } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const rateText = rateOverride ?? (master.dieselRate === null ? '' : String(master.dieselRate));
  const litresN = round2(toNumber(litres));
  const rateN = round2(toNumber(rateText));
  const amount = round2(litresN * rateN);

  const tripsForVehicle = openTrips.filter((t) => t.vehicle === vehicle);
  const selectedTrip = tripsForVehicle.find((t) => t.id === tripId) ?? null;

  function chooseVehicle(id: string) {
    setVehicle(id);
    setDriver(vehicles.find((v) => v.id === id)?.defaultDriver ?? '');
    const forVehicle = openTrips.filter((t) => t.vehicle === id);
    setTripId(forVehicle.length === 1 ? forVehicle[0].id : '');
    setError('');
    setNotice('');
  }

  async function onScanChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (scanInputRef.current) scanInputRef.current.value = '';
    if (!file) return;
    setScanning(true);
    setError('');
    setNotice('');
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const r: ScannedReceipt = await scanReceipt(base64, mimeType);
      if ((r.fuelType ?? '').toLowerCase().includes('adblue')) {
        setError('That looks like an AdBlue bill — only diesel is posted from this tab.');
        return;
      }
      if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) setDate(r.date);
      if (r.litres) setLitres(String(round2(r.litres)));
      if (r.ratePerLitre) setRateOverride(String(round2(r.ratePerLitre)));
      setScanFile({ base64, mimeType, filename: file.name });
      if (!vehicle && r.vehicleNo) {
        const match = vehicleOptions.find((v) => normalizeReg(v.id) === normalizeReg(r.vehicleNo!));
        if (match) chooseVehicle(match.id);
      }
      setNotice('Bill read — check the figures, pick the trip, then post.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the bill — enter it manually.');
    } finally {
      setScanning(false);
    }
  }

  async function post() {
    setError('');
    setNotice('');
    if (!vehicle) { setError('Choose a vehicle.'); return; }
    if (!selectedTrip) { setError(tripsForVehicle.length === 0 ? 'This vehicle has no open trip to post fuel to.' : 'Choose the trip.'); return; }
    if (!date) { setError('Enter the date.'); return; }
    if (!litresN) { setError('Enter the litres.'); return; }
    if (!rateN) { setError('Enter the rate per litre.'); return; }
    setSaving(true);
    const line: TripExpenseLine = {
      id: 'x' + Date.now(), date, kind: 'diesel', litres: litresN, ratePerLitre: rateN, amount,
      ...(remarks.trim() ? { details: remarks.trim() } : {})
    };
    const bill: TripDocument | null = scanFile ? { id: 'x' + Date.now(), filename: scanFile.filename, mimeType: scanFile.mimeType, base64: scanFile.base64 } : null;
    const res = await onPost(selectedTrip, line, bill);
    setSaving(false);
    if (!res.ok) { setError(res.message ?? 'Could not post the fuel entry'); return; }
    setNotice(`Posted ${litresN.toFixed(2)} L (${rupees(amount)}) to trip ${selectedTrip.waybillNo}.${res.message ? ' ' + res.message : ''}`);
    setLitres('');
    setRateOverride(null);
    setRemarks('');
    setScanFile(null);
  }

  async function remove(trip: Trip, line: TripExpenseLine) {
    if (!window.confirm(`Delete this fuel entry — ${line.litres?.toFixed(2) ?? ''} L, ${rupees(line.amount)} on trip ${trip.waybillNo}? This cannot be undone.`)) return;
    const err = await onDelete(trip, line);
    if (err) setError(err);
  }

  // Diesel lines across the trips this person can see, newest first. Includes
  // fuel that was logged before this tab existed.
  const recent = trips
    .flatMap((t) => t.expenses.filter((l) => l.kind === 'diesel').map((l) => ({ trip: t, line: l })))
    .sort((a, b) => parseDisplayDate(b.line.date).localeCompare(parseDisplayDate(a.line.date)))
    .slice(0, RECENT_LIMIT);

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <div className="kicker">Diesel</div>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>Fuel Expenses</h1>
        <p style={{ color: 'var(--color-neutral-700)', marginTop: 6, fontSize: 13 }}>
          Enter a diesel fill. It is posted to the expenses of the trip you choose, which must still be open.
        </p>
      </div>

      <div style={{ border: '2px solid var(--color-divider)', padding: 20, marginBottom: 24 }}>
        <div className="filters-grid" style={{ alignItems: 'start' }}>
          <div className="field">
            <label htmlFor="fuel-date">Date</label>
            <input id="fuel-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fuel-vehicle">Vehicle #</label>
            <select id="fuel-vehicle" className="input" value={vehicle} onChange={(e) => chooseVehicle(e.target.value)}>
              <option value="">Select vehicle</option>
              {vehicleOptions.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fuel-driver">Driver</label>
            <select id="fuel-driver" className="input" value={driver} onChange={(e) => setDriver(e.target.value)}>
              <option value="">No driver</option>
              {drivers.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 4 }}>Truck's default driver — for reference, not saved.</div>
          </div>
          <div className="field">
            <label htmlFor="fuel-litres">Litres</label>
            <input id="fuel-litres" className="input" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={litres} onChange={(e) => setLitres(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fuel-rate">Rate / litre (₹)</label>
            <input id="fuel-rate" className="input" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={rateText} onChange={(e) => setRateOverride(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fuel-amount">Amount (₹)</label>
            <input id="fuel-amount" className="input" type="text" readOnly tabIndex={-1} value={amount.toFixed(2)} style={{ background: 'var(--color-surface)' }} />
          </div>
          <div className="field">
            <label htmlFor="fuel-trip">Trip #</label>
            <select id="fuel-trip" className="input" value={tripId} onChange={(e) => setTripId(e.target.value)} disabled={!vehicle}>
              <option value="">{!vehicle ? 'Select a vehicle first' : tripsForVehicle.length === 0 ? 'No open trips' : 'Select trip'}</option>
              {tripsForVehicle.map((t) => (
                <option key={t.id} value={t.id}>{t.waybillNo} · {t.loadDate} · {t.from} → {t.to}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fuel-remarks">Remarks</label>
            <input id="fuel-remarks" className="input" type="text" placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          <button type="button" className="btn btn-primary" onClick={post} disabled={saving}>{saving ? 'Posting…' : 'Post to trip'}</button>
          <span style={{ color: 'var(--color-neutral-500)', fontSize: 12 }}>or</span>
          <input ref={scanInputRef} type="file" accept="image/*" capture="environment" onChange={onScanChosen} style={{ display: 'none' }} />
          <button type="button" className="btn btn-secondary" disabled={scanning} onClick={() => scanInputRef.current?.click()}>
            {scanning && <span className="spinner" style={{ marginRight: 8 }} />}
            {scanning ? 'Reading bill…' : 'Scan a fuel bill'}
          </button>
          {scanFile && <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Bill attached: {scanFile.filename}</span>}
        </div>

        {error && <div role="alert" style={{ marginTop: 12, border: '2px solid var(--color-accent)', color: 'var(--color-accent-700)', padding: '10px 14px', fontSize: 13 }}>{error}</div>}
        {notice && !error && <div role="status" style={{ marginTop: 12, fontSize: 13, color: 'var(--color-profit)', fontWeight: 600 }}>{notice}</div>}
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Recent fuel entries</h2>
      {recent.length === 0 ? (
        <div style={{ border: '2px solid var(--color-divider)', padding: 16, color: 'var(--color-neutral-700)' }}>No fuel entries yet.</div>
      ) : (
        <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
          <table className="table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Date</th><th>Vehicle</th><th>Trip #</th><th style={{ textAlign: 'right' }}>Litres</th><th style={{ textAlign: 'right' }}>Rate</th>
                <th style={{ textAlign: 'right' }}>Amount</th><th>Remarks</th><th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map(({ trip, line }) => (
                <tr key={line.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{line.date}</td>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{trip.vehicle}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{trip.waybillNo}</td>
                  <td style={{ textAlign: 'right' }}>{line.litres != null ? line.litres.toFixed(2) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{line.ratePerLitre != null ? rupees(line.ratePerLitre) : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{rupees(line.amount)}</td>
                  <td style={{ color: 'var(--color-neutral-700)' }}>{line.details ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {(trip.status === 'draft' || role === 'Manager') && (
                      <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12, color: 'var(--color-accent-700)' }} onClick={() => remove(trip, line)}>
                        Delete
                      </button>
                    )}
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
