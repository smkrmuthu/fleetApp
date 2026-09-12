import { useState } from 'react';
import type { DriverMaster, Trip, UserAccount, Vehicle } from '../types';
import { formatNum, rupees, tripCost } from '../utils/calc';

interface Props {
  trips: Trip[];
  vehicles: Vehicle[];
  drivers: DriverMaster[];
  users: UserAccount[];
  onAddVehicle: (v: Vehicle) => void;
  onRemoveVehicle: (id: string) => void;
  onAddDriver: (d: DriverMaster) => void;
  onRemoveDriver: (name: string) => void;
  onRemoveUser: (phone: string) => void;
  canDeleteAccounts: boolean;
}

export function People({
  trips, vehicles, drivers, users, onAddVehicle, onRemoveVehicle, onAddDriver, onRemoveDriver, onRemoveUser, canDeleteAccounts
}: Props) {
  const [newVehicle, setNewVehicle] = useState({ id: '', model: '', fcDate: '', renewalDate: '' });
  const [newDriver, setNewDriver] = useState({ name: '', licence: '', expiry: '', vehicle: vehicles[0]?.id ?? '' });

  function addVehicle() {
    if (!newVehicle.id.trim()) return;
    onAddVehicle({
      id: newVehicle.id.trim(),
      model: newVehicle.model.trim() || '—',
      fcDate: newVehicle.fcDate || '—',
      renewalDate: newVehicle.renewalDate || '—',
      renewalDue: false
    });
    setNewVehicle({ id: '', model: '', fcDate: '', renewalDate: '' });
  }

  function addDriver() {
    if (!newDriver.name.trim()) return;
    onAddDriver({
      name: newDriver.name.trim(),
      licence: newDriver.licence.trim() || '—',
      expiry: newDriver.expiry || '—',
      expiring: false,
      vehicle: newDriver.vehicle || '—',
      credential: '—'
    });
    setNewDriver({ name: '', licence: '', expiry: '', vehicle: vehicles[0]?.id ?? '' });
  }

  const driverRows = drivers.map((d) => {
    const tr = trips.filter((t) => t.driver === d.name);
    const agg = tr.reduce(
      (a, t) => {
        const c = tripCost(t);
        a.km += t.km;
        a.rev += t.revenue;
        a.exp += c.expense;
        return a;
      },
      { km: 0, rev: 0, exp: 0 }
    );
    return {
      ...d,
      trips: tr.length,
      km: agg.km,
      revenue: agg.rev,
      perKm: agg.km ? agg.exp / agg.km : null,
      pending: tr.filter((t) => t.status === 'pending').length
    };
  });

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div className="kicker">Meridian Exim · {users.length} accounts, 3 branches</div>
          <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>People</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-primary">Invite user</button>
        </div>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>User accounts</h2>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)', marginBottom: 30 }}>
        <table className="table" style={{ minWidth: canDeleteAccounts ? 1100 : 1000 }}>
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Mobile</th><th>Branch</th><th>Can see</th><th>Last active</th>
              {canDeleteAccounts && <th></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.phone}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{u.name}</td>
                <td>{u.isManager ? <span className="tag tag-accent">{u.role}</span> : <span className="tag tag-outline">{u.role}</span>}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{u.phone}</td>
                <td>{u.branch}</td>
                <td style={{ color: 'var(--color-neutral-700)' }}>{u.access}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{u.seen}</td>
                {canDeleteAccounts && (
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => onRemoveUser(u.phone)}>Delete account</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Trucks</h2>
      <div style={{ border: '2px solid var(--color-divider)', padding: 16, marginBottom: 16 }}>
        <div className="filters-grid">
          <div className="field"><label>Registration no</label><input className="input" type="text" placeholder="TN00 XX 0000" value={newVehicle.id} onChange={(e) => setNewVehicle((v) => ({ ...v, id: e.target.value }))} /></div>
          <div className="field"><label>Model</label><input className="input" type="text" placeholder="Make and model" value={newVehicle.model} onChange={(e) => setNewVehicle((v) => ({ ...v, model: e.target.value }))} /></div>
          <div className="field"><label>FC date</label><input className="input" type="date" value={newVehicle.fcDate} onChange={(e) => setNewVehicle((v) => ({ ...v, fcDate: e.target.value }))} /></div>
          <div className="field"><label>Renewal date</label><input className="input" type="date" value={newVehicle.renewalDate} onChange={(e) => setNewVehicle((v) => ({ ...v, renewalDate: e.target.value }))} /></div>
          <button type="button" className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={addVehicle}>Add truck</button>
        </div>
      </div>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)', marginBottom: 30 }}>
        <table className="table" style={{ minWidth: 800 }}>
          <thead>
            <tr><th>Vehicle</th><th>Model</th><th>FC date</th><th>Renewal date</th><th></th></tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{v.id}</td>
                <td style={{ color: 'var(--color-neutral-700)' }}>{v.model}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{v.fcDate}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {v.renewalDue ? <span className="tag tag-accent">{v.renewalDate}</span> : <span>{v.renewalDate}</span>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => onRemoveVehicle(v.id)}>Delete truck</button>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr><td colSpan={5} style={{ color: 'var(--color-neutral-700)' }}>No trucks yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Drivers</h2>
      <div style={{ border: '2px solid var(--color-divider)', padding: 16, marginBottom: 16 }}>
        <div className="filters-grid">
          <div className="field"><label>Name</label><input className="input" type="text" placeholder="Driver name" value={newDriver.name} onChange={(e) => setNewDriver((d) => ({ ...d, name: e.target.value }))} /></div>
          <div className="field"><label>Licence no</label><input className="input" type="text" placeholder="Licence no" value={newDriver.licence} onChange={(e) => setNewDriver((d) => ({ ...d, licence: e.target.value }))} /></div>
          <div className="field"><label>Licence expiry</label><input className="input" type="date" value={newDriver.expiry} onChange={(e) => setNewDriver((d) => ({ ...d, expiry: e.target.value }))} /></div>
          <div className="field">
            <label>Assigned vehicle</label>
            <select className="input" value={newDriver.vehicle} onChange={(e) => setNewDriver((d) => ({ ...d, vehicle: e.target.value }))}>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={addDriver}>Add driver</button>
        </div>
      </div>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
        <table className="table" style={{ minWidth: 1200 }}>
          <thead>
            <tr>
              <th>Driver</th><th>Licence no</th><th>Expiry</th><th>Assigned vehicle</th><th>Credential</th>
              <th style={{ textAlign: 'right' }}>Movements</th><th style={{ textAlign: 'right' }}>Pending</th>
              <th style={{ textAlign: 'right' }}>KM</th><th style={{ textAlign: 'right' }}>₹/km</th><th style={{ textAlign: 'right' }}>Revenue</th><th></th>
            </tr>
          </thead>
          <tbody>
            {driverRows.map((d) => (
              <tr key={d.name}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{d.name}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{d.licence}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{d.expiring ? <span className="tag tag-accent">{d.expiry}</span> : <span>{d.expiry}</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{d.vehicle}</td>
                <td style={{ color: 'var(--color-neutral-700)' }}>{d.credential}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(d.trips)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(d.pending)}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(d.km)}</td>
                <td style={{ textAlign: 'right' }}>{d.perKm !== null ? rupees(d.perKm) : '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{rupees(d.revenue)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => onRemoveDriver(d.name)}>Delete driver</button>
                </td>
              </tr>
            ))}
            {driverRows.length === 0 && (
              <tr><td colSpan={11} style={{ color: 'var(--color-neutral-700)' }}>No drivers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ color: 'var(--color-neutral-700)', maxWidth: '74ch', lineHeight: 1.6, marginTop: 16 }}>
        Licences and FC renewals inside 60 days are flagged; the same check runs nightly and pushes a notification to
        the manager. A driver account only ever reads its own movements — enforced in the database, not the client.
        Adding or removing trucks and drivers is available to Office and Manager; deleting a user account is
        Manager only.
      </p>
    </section>
  );
}
