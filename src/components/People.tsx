import { useState } from 'react';
import type { DriverMaster, Trip, UserAccount, Vehicle } from '../types';
import { formatNum, rupees, tripCost } from '../utils/calc';
import { BRANCH_OPTIONS, parseDisplayDate } from '../lib/api';
import { RecordDialog, type DialogField } from './RecordDialog';

interface Props {
  trips: Trip[];
  vehicles: Vehicle[];
  drivers: DriverMaster[];
  users: (UserAccount & { id: string })[];
  onAddVehicle: (v: Vehicle) => Promise<string | null>;
  onRemoveVehicle: (id: string) => void;
  onAddDriver: (d: DriverMaster) => Promise<string | null>;
  onRemoveDriver: (name: string) => void;
  onRemoveUser: (id: string) => void;
  onUpdateVehicle: (id: string, v: { model: string; fcDate: string; renewalDate: string }) => Promise<string | null>;
  onUpdateDriver: (name: string, d: { licence: string; expiry: string; vehicle: string; credential: string }) => Promise<string | null>;
  onUpdateUser: (id: string, u: { name: string; phone: string; role: string; branchId: string }) => Promise<string | null>;
  canDeleteAccounts: boolean;
  canEditAccounts: boolean;
}

export function People({
  trips, vehicles, drivers, users, onAddVehicle, onRemoveVehicle, onAddDriver, onRemoveDriver, onRemoveUser,
  onUpdateVehicle, onUpdateDriver, onUpdateUser, canDeleteAccounts, canEditAccounts
}: Props) {
  const [dialog, setDialog] = useState<{ kind: 'user' | 'truck' | 'driver'; key: string; edit: boolean } | null>(null);
  const [newVehicle, setNewVehicle] = useState({ id: '', model: '', fcDate: '', renewalDate: '' });
  const [newDriver, setNewDriver] = useState({ name: '', licence: '', expiry: '', vehicle: vehicles[0]?.id ?? '' });
  const [vehicleError, setVehicleError] = useState('');
  const [driverError, setDriverError] = useState('');

  async function addVehicle() {
    if (!newVehicle.id.trim()) {
      setVehicleError('Enter the truck\'s registration number.');
      return;
    }
    setVehicleError('');
    const err = await onAddVehicle({
      id: newVehicle.id.trim(),
      model: newVehicle.model.trim() || '—',
      fcDate: newVehicle.fcDate || '—',
      renewalDate: newVehicle.renewalDate || '—',
      renewalDue: false
    });
    if (err) setVehicleError(err);
    else setNewVehicle({ id: '', model: '', fcDate: '', renewalDate: '' });
  }

  async function addDriver() {
    if (!newDriver.name.trim()) {
      setDriverError('Enter the driver\'s name.');
      return;
    }
    setDriverError('');
    const err = await onAddDriver({
      name: newDriver.name.trim(),
      licence: newDriver.licence.trim() || '—',
      expiry: newDriver.expiry || '—',
      expiring: false,
      vehicle: newDriver.vehicle || '—',
      credential: '—'
    });
    if (err) setDriverError(err);
    else setNewDriver({ name: '', licence: '', expiry: '', vehicle: vehicles[0]?.id ?? '' });
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

  const blank = (v: string) => (v === '—' ? '' : v);
  const rowBtn = { color: 'var(--color-text)' } as const;
  const actions = { display: 'flex', justifyContent: 'flex-end', gap: 4, whiteSpace: 'nowrap' } as const;

  function renderDialog() {
    if (!dialog) return null;
    const close = () => setDialog(null);

    if (dialog.kind === 'truck') {
      const v = vehicles.find((x) => x.id === dialog.key);
      if (!v) return null;
      const fields: DialogField[] = [
        { key: 'reg', label: 'Registration no', display: v.id, value: v.id, locked: true, hint: "The registration number is how trips refer to this truck, so it can't be changed. To correct it, add the right one and delete this one." },
        { key: 'model', label: 'Model', display: v.model, value: blank(v.model) },
        { key: 'fcDate', label: 'FC date', type: 'date', display: v.fcDate, value: parseDisplayDate(v.fcDate) },
        { key: 'renewalDate', label: 'Renewal date', type: 'date', display: v.renewalDate, value: parseDisplayDate(v.renewalDate) }
      ];
      return (
        <RecordDialog
          key={`truck-${v.id}-${dialog.edit}`} title={v.id} subtitle="Truck" fields={fields} startInEdit={dialog.edit} canEdit onClose={close}
          onSave={(x) => onUpdateVehicle(v.id, { model: x.model, fcDate: x.fcDate, renewalDate: x.renewalDate })}
        />
      );
    }

    if (dialog.kind === 'driver') {
      const d = drivers.find((x) => x.name === dialog.key);
      if (!d) return null;
      const current = blank(d.vehicle);
      const options = [{ value: '', label: 'None' }, ...vehicles.map((v) => ({ value: v.id, label: v.id }))];
      if (current && !vehicles.some((v) => v.id === current)) options.push({ value: current, label: `${current} (removed)` });
      const fields: DialogField[] = [
        { key: 'name', label: 'Name', display: d.name, value: d.name, locked: true, hint: "A driver's name is how their trips are recorded, so it can't be changed. To correct it, add the right name and delete this one." },
        { key: 'licence', label: 'Licence no', display: d.licence, value: blank(d.licence) },
        { key: 'expiry', label: 'Licence expiry', type: 'date', display: d.expiry, value: parseDisplayDate(d.expiry) },
        { key: 'vehicle', label: 'Assigned vehicle', type: 'select', options, display: d.vehicle, value: current },
        { key: 'credential', label: 'Credential', display: d.credential, value: blank(d.credential) }
      ];
      return (
        <RecordDialog
          key={`driver-${d.name}-${dialog.edit}`} title={d.name} subtitle="Driver" fields={fields} startInEdit={dialog.edit} canEdit onClose={close}
          onSave={(x) => onUpdateDriver(d.name, { licence: x.licence, expiry: x.expiry, vehicle: x.vehicle, credential: x.credential })}
        />
      );
    }

    const u = users.find((x) => x.id === dialog.key);
    if (!u) return null;
    const fields: DialogField[] = [
      { key: 'name', label: 'Name', display: u.name, value: u.name, required: true },
      { key: 'phone', label: 'Mobile', type: 'tel', display: u.phone, value: u.phone, required: true, hint: 'This is the number they sign in with.' },
      {
        key: 'role', label: 'Role', type: 'select', display: u.role, value: u.roleKey ?? 'driver',
        options: [{ value: 'driver', label: 'Driver' }, { value: 'office', label: 'Documentation (Office)' }, { value: 'manager', label: 'Manager' }],
        hint: 'Changes what they can see the next time they sign in.'
      },
      { key: 'branchId', label: 'Branch', type: 'select', display: u.branch, value: u.branchId ?? '', options: [{ value: '', label: 'None' }, ...BRANCH_OPTIONS.map((b) => ({ value: b.id, label: b.name }))] },
      { key: 'access', label: 'Can see', display: u.access, value: u.access, viewOnly: true },
      { key: 'seen', label: 'Last active', display: u.seen, value: u.seen, viewOnly: true }
    ];
    return (
      <RecordDialog
        key={`user-${u.id}-${dialog.edit}`} title={u.name} subtitle="User account" fields={fields} startInEdit={dialog.edit} canEdit={canEditAccounts} onClose={close}
        onSave={(x) => onUpdateUser(u.id, { name: x.name, phone: x.phone, role: x.role, branchId: x.branchId })}
      />
    );
  }

  return (
    <section>
      {renderDialog()}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div className="kicker">Shree Mira Trader · {users.length} accounts, 3 branches</div>
          <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>People</h1>
          <p style={{ color: 'var(--color-neutral-700)', marginTop: 6, fontSize: 13 }}>Manage the fleet's trucks, drivers and user accounts.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-primary">Invite user</button>
        </div>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>User accounts</h2>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)', marginBottom: 30 }}>
        <table className="table" style={{ minWidth: 1150 }}>
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Mobile</th><th>Branch</th><th>Can see</th><th>Last active</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{u.name}</td>
                <td>{u.isManager ? <span className="tag tag-accent">{u.role}</span> : <span className="tag tag-outline">{u.role}</span>}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{u.phone}</td>
                <td>{u.branch}</td>
                <td style={{ color: 'var(--color-neutral-700)' }}>{u.access}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{u.seen}</td>
                <td className="col-actions">
                  <div style={actions}>
                    <button type="button" className="btn btn-ghost" style={rowBtn} onClick={() => setDialog({ kind: 'user', key: u.id, edit: false })}>View</button>
                    {canEditAccounts && <button type="button" className="btn btn-ghost" style={rowBtn} onClick={() => setDialog({ kind: 'user', key: u.id, edit: true })}>Edit</button>}
                    {canDeleteAccounts && <button type="button" className="btn btn-ghost" onClick={() => onRemoveUser(u.id)}>Delete account</button>}
                  </div>
                </td>
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
          {vehicleError && <div role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13 }}>{vehicleError}</div>}
        </div>
      </div>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)', marginBottom: 30 }}>
        <table className="table" style={{ minWidth: 800 }}>
          <thead>
            <tr><th>Vehicle</th><th>Model</th><th>FC date</th><th>Renewal date</th><th className="col-actions"></th></tr>
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
                <td className="col-actions">
                  <div style={actions}>
                    <button type="button" className="btn btn-ghost" style={rowBtn} onClick={() => setDialog({ kind: 'truck', key: v.id, edit: false })}>View</button>
                    <button type="button" className="btn btn-ghost" style={rowBtn} onClick={() => setDialog({ kind: 'truck', key: v.id, edit: true })}>Edit</button>
                    <button type="button" className="btn btn-ghost" onClick={() => onRemoveVehicle(v.id)}>Delete truck</button>
                  </div>
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
          {driverError && <div role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13 }}>{driverError}</div>}
        </div>
      </div>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
        <table className="table" style={{ minWidth: 1200 }}>
          <thead>
            <tr>
              <th>Driver</th><th>Licence no</th><th>Expiry</th><th>Assigned vehicle</th><th>Credential</th>
              <th style={{ textAlign: 'right' }}>Movements</th><th style={{ textAlign: 'right' }}>Pending</th>
              <th style={{ textAlign: 'right' }}>KM</th><th style={{ textAlign: 'right' }}>₹/km</th><th style={{ textAlign: 'right' }}>Revenue</th><th className="col-actions"></th>
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
                <td className="col-actions">
                  <div style={actions}>
                    <button type="button" className="btn btn-ghost" style={rowBtn} onClick={() => setDialog({ kind: 'driver', key: d.name, edit: false })}>View</button>
                    <button type="button" className="btn btn-ghost" style={rowBtn} onClick={() => setDialog({ kind: 'driver', key: d.name, edit: true })}>Edit</button>
                    <button type="button" className="btn btn-ghost" onClick={() => onRemoveDriver(d.name)}>Delete driver</button>
                  </div>
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
        the manager. Office and Manager can add, edit or remove trucks and drivers; only a Manager can edit or delete
        a user account.
      </p>
    </section>
  );
}
