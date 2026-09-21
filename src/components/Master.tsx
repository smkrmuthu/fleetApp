import { useEffect, useState } from 'react';
import type { DriverMaster, MasterSettings, Vehicle } from '../types';

interface Props {
  vehicles: Vehicle[];
  drivers: DriverMaster[];
  settings: MasterSettings;
  onSave: (patch: Partial<MasterSettings>) => Promise<string | null>;
  onSetDefaultDriver: (vehicleId: string, driver: string) => Promise<string | null>;
}

const fmt = (n: number | null) => (n === null ? '' : String(n));

export function Master({ vehicles, drivers, settings, onSave, onSetDefaultDriver }: Props) {
  const rates = settings;
  const [diesel, setDiesel] = useState(fmt(rates.dieselRate));
  const [adblue, setAdblue] = useState(fmt(rates.adblueRate));
  const [rateError, setRateError] = useState('');
  const [rateSaved, setRateSaved] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [rowStatus, setRowStatus] = useState<Record<string, string>>({});
  const [point, setPoint] = useState(settings.loadingPoint ?? '');
  const [pointError, setPointError] = useState('');
  const [pointSaved, setPointSaved] = useState(false);
  const [savingPoint, setSavingPoint] = useState(false);

  // Rates arrive after the first render (they're fetched with everything
  // else), so the form has to follow them in.
  useEffect(() => {
    setDiesel(fmt(rates.dieselRate));
    setAdblue(fmt(rates.adblueRate));
  }, [rates.dieselRate, rates.adblueRate]);

  useEffect(() => {
    setPoint(settings.loadingPoint ?? '');
  }, [settings.loadingPoint]);

  const pointDirty = point.trim() !== (settings.loadingPoint ?? '');

  async function savePoint() {
    setPointError('');
    setPointSaved(false);
    setSavingPoint(true);
    const err = await onSave({ loadingPoint: point.trim() || null });
    setSavingPoint(false);
    if (err) setPointError(err);
    else setPointSaved(true);
  }

  const dirty = diesel.trim() !== fmt(rates.dieselRate) || adblue.trim() !== fmt(rates.adblueRate);

  function parseRate(label: string, raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
    const t = raw.trim();
    if (!t) return { ok: true, value: null };
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: `${label} rate must be a number above 0.` };
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return { ok: false, error: `${label} rate can have at most 2 decimal places.` };
    if (n > 1000) return { ok: false, error: `${label} rate looks too high — check it.` };
    return { ok: true, value: n };
  }

  async function saveRates() {
    const d = parseRate('Diesel', diesel);
    if (!d.ok) return setRateError(d.error);
    const a = parseRate('AdBlue', adblue);
    if (!a.ok) return setRateError(a.error);
    setRateError('');
    setRateSaved(false);
    setSavingRates(true);
    const err = await onSave({ dieselRate: d.value, adblueRate: a.value });
    setSavingRates(false);
    if (err) setRateError(err);
    else setRateSaved(true);
  }

  async function changeDefaultDriver(vehicleId: string, driver: string) {
    setRowStatus((s) => ({ ...s, [vehicleId]: 'Saving…' }));
    const err = await onSetDefaultDriver(vehicleId, driver);
    setRowStatus((s) => ({ ...s, [vehicleId]: err ?? 'Saved' }));
    if (!err) setTimeout(() => setRowStatus((s) => (s[vehicleId] === 'Saved' ? { ...s, [vehicleId]: '' } : s)), 2000);
  }

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <div className="kicker">Office and Manager</div>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>Master</h1>
        <p style={{ color: 'var(--color-neutral-700)', marginTop: 6, fontSize: 13 }}>
          Reference values the rest of the app picks up — set them once here instead of typing them on every movement.
        </p>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Fuel rates</h2>
      <div style={{ border: '2px solid var(--color-divider)', padding: 16, marginBottom: 30 }}>
        <form
          className="filters-grid"
          onSubmit={(e) => { e.preventDefault(); saveRates(); }}
        >
          <div className="field">
            <label htmlFor="rate-diesel">Diesel (₹ per litre)</label>
            <input
              id="rate-diesel" className="input" type="number" step="0.01" inputMode="decimal" placeholder="e.g. 95.60"
              value={diesel} onChange={(e) => { setDiesel(e.target.value); setRateSaved(false); }}
            />
          </div>
          <div className="field">
            <label htmlFor="rate-adblue">AdBlue (₹ per litre)</label>
            <input
              id="rate-adblue" className="input" type="number" step="0.01" inputMode="decimal" placeholder="e.g. 62"
              value={adblue} onChange={(e) => { setAdblue(e.target.value); setRateSaved(false); }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={!dirty || savingRates}>
            {savingRates ? 'Saving…' : 'Save rates'}
          </button>
          {rateError && <div role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13 }}>{rateError}</div>}
          {rateSaved && !rateError && <div role="status" style={{ color: 'var(--color-profit)', fontSize: 13, fontWeight: 600 }}>Saved — new fuel entries will start from these rates.</div>}
        </form>
        <p style={{ color: 'var(--color-neutral-700)', fontSize: 12, marginTop: 12, marginBottom: 0, maxWidth: '74ch', lineHeight: 1.6 }}>
          Used as the starting rate whenever someone adds a Diesel or AdBlue entry in Add Movement. It can still be changed on an
          individual entry (a different pump, say). Entries already saved keep the rate they were saved with, so changing a
          rate here never alters past movements. Clear a box to remove that rate.
        </p>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Default loading point</h2>
      <div style={{ border: '2px solid var(--color-divider)', padding: 16, marginBottom: 30 }}>
        <form className="filters-grid" onSubmit={(e) => { e.preventDefault(); savePoint(); }}>
          <div className="field field-span-2">
            <label htmlFor="default-loading-point">Loading point</label>
            <input
              id="default-loading-point" className="input" type="text" placeholder="e.g. Bharathi Cements" maxLength={200}
              value={point} onChange={(e) => { setPoint(e.target.value); setPointSaved(false); }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={!pointDirty || savingPoint}>
            {savingPoint ? 'Saving…' : 'Save loading point'}
          </button>
          {pointError && <div role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13 }}>{pointError}</div>}
          {pointSaved && !pointError && <div role="status" style={{ color: 'var(--color-profit)', fontSize: 13, fontWeight: 600 }}>Saved — new movements will start from this place.</div>}
        </form>
        <p style={{ color: 'var(--color-neutral-700)', fontSize: 12, marginTop: 12, marginBottom: 0, maxWidth: '74ch', lineHeight: 1.6 }}>
          Filled in as the route's starting point (A) on every new movement. It's only a starting value — whoever adds the
          movement can change it or erase it. Clear the box to have no default.
        </p>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Default drivers</h2>
      <p style={{ color: 'var(--color-neutral-700)', fontSize: 13, marginTop: -4, marginBottom: 12, maxWidth: '74ch', lineHeight: 1.6 }}>
        When a truck is picked in Add Movement, its default driver is filled in for you. It's only a starting point — the driver
        can be changed on the movement. Changes here save as soon as you pick.
      </p>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
        <table className="table" style={{ minWidth: 640 }}>
          <thead>
            <tr><th>Truck</th><th>Model</th><th>Default driver</th></tr>
          </thead>
          <tbody>
            {vehicles.map((v) => {
              const current = v.defaultDriver ?? '';
              const known = !current || drivers.some((d) => d.name === current);
              const status = rowStatus[v.id];
              return (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{v.id}</td>
                  <td style={{ color: 'var(--color-neutral-700)' }}>{v.model}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <select
                        className="input" style={{ maxWidth: 260 }} aria-label={`Default driver for ${v.id}`}
                        value={current} onChange={(e) => changeDefaultDriver(v.id, e.target.value)}
                      >
                        <option value="">No default driver</option>
                        {!known && <option value={current}>{current} (removed)</option>}
                        {drivers.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                      </select>
                      {status && (
                        <span role="status" style={{ fontSize: 12, color: status === 'Saving…' || status === 'Saved' ? 'var(--color-neutral-700)' : 'var(--color-accent-700)' }}>
                          {status}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {vehicles.length === 0 && (
              <tr><td colSpan={3} style={{ color: 'var(--color-neutral-700)' }}>No trucks yet — add one under People.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
