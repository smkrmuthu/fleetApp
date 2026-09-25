import { useState } from 'react';
import type { DriverMaster, UserAccount, Vehicle } from '../types';
import { BRANCH_OPTIONS, formatDisplayDate, parseDisplayDate, type VehicleEdit } from '../lib/api';
import { vehicleAge } from '../utils/calc';
import { RecordDialog, type DialogField } from './RecordDialog';

const blankVehicle = {
  id: '', model: '', fcDate: '', renewalDate: '', regDate: '', batchNo: '', taxDate: '', inspectionDate: '', npDate: '', pollutionDate: '', owner: ''
};

interface Props {
  vehicles: Vehicle[];
  drivers: DriverMaster[];
  users: (UserAccount & { id: string })[];
  onAddVehicle: (v: Vehicle) => Promise<string | null>;
  onRemoveVehicle: (id: string) => void;
  onAddDriver: (d: DriverMaster) => Promise<string | null>;
  onRemoveDriver: (name: string) => void;
  onRemoveUser: (id: string) => void;
  onUpdateVehicle: (id: string, v: VehicleEdit) => Promise<string | null>;
  onUpdateDriver: (name: string, d: { licence: string; expiry: string; credential: string }) => Promise<string | null>;
  onUpdateUser: (id: string, u: { name: string; phone: string; role: string; branchId: string }) => Promise<string | null>;
  canDeleteAccounts: boolean;
  canEditAccounts: boolean;
}

export function People({
  vehicles, drivers, users, onAddVehicle, onRemoveVehicle, onAddDriver, onRemoveDriver, onRemoveUser,
  onUpdateVehicle, onUpdateDriver, onUpdateUser, canDeleteAccounts, canEditAccounts
}: Props) {
  const [dialog, setDialog] = useState<{ kind: 'user' | 'truck' | 'driver'; key: string; edit: boolean } | null>(null);
  const [newVehicle, setNewVehicle] = useState(blankVehicle);
  const [newDriver, setNewDriver] = useState({ name: '', licence: '', expiry: '' });
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
      renewalDue: false,
      regDate: newVehicle.regDate || '—',
      batchNo: newVehicle.batchNo.trim() || '—',
      taxDate: newVehicle.taxDate || '—',
      inspectionDate: newVehicle.inspectionDate || '—',
      npDate: newVehicle.npDate || '—',
      pollutionDate: newVehicle.pollutionDate || '—',
      owner: newVehicle.owner.trim() || '—'
    });
    if (err) setVehicleError(err);
    else setNewVehicle(blankVehicle);
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
      vehicle: '—',
      credential: '—'
    });
    if (err) setDriverError(err);
    else setNewDriver({ name: '', licence: '', expiry: '' });
  }

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
        { key: 'regDate', label: 'Reg Date', type: 'date', display: v.regDate, value: parseDisplayDate(v.regDate) },
        { key: 'age', label: 'Age of Vehicle', display: vehicleAge(v.regDate), value: '', viewOnly: true },
        { key: 'batchNo', label: 'Batch #', display: v.batchNo, value: blank(v.batchNo) },
        { key: 'taxDate', label: 'Tax Date', type: 'date', display: v.taxDate, value: parseDisplayDate(v.taxDate) },
        { key: 'inspectionDate', label: 'Inspection Date', type: 'date', display: v.inspectionDate, value: parseDisplayDate(v.inspectionDate) },
        { key: 'npDate', label: 'NP Date', type: 'date', display: v.npDate, value: parseDisplayDate(v.npDate) },
        { key: 'fcDate', label: 'FC Date', type: 'date', display: v.fcDate, value: parseDisplayDate(v.fcDate) },
        { key: 'pollutionDate', label: 'Pollution Cert Date', type: 'date', display: v.pollutionDate, value: parseDisplayDate(v.pollutionDate) },
        { key: 'owner', label: 'Owner', display: v.owner, value: blank(v.owner) },
        { key: 'model', label: 'Model', display: v.model, value: blank(v.model) },
        { key: 'renewalDate', label: 'Renewal date', type: 'date', display: v.renewalDate, value: parseDisplayDate(v.renewalDate) },
        {
          key: 'defaultDriver', label: 'Default driver', type: 'select', display: v.defaultDriver ?? '', value: v.defaultDriver ?? '',
          options: [{ value: '', label: 'No default driver' }, ...drivers.map((d) => ({ value: d.name, label: d.name }))],
          hint: 'Filled in automatically when this truck is picked in Add Movement. Also editable under Master.'
        }
      ];
      return (
        <RecordDialog
          key={`truck-${v.id}-${dialog.edit}`} title={v.id} subtitle="Truck" fields={fields} startInEdit={dialog.edit} canEdit onClose={close}
          onSave={(x) => onUpdateVehicle(v.id, {
            regDate: x.regDate, batchNo: x.batchNo, taxDate: x.taxDate, inspectionDate: x.inspectionDate, npDate: x.npDate,
            fcDate: x.fcDate, pollutionDate: x.pollutionDate, owner: x.owner, model: x.model, renewalDate: x.renewalDate, defaultDriver: x.defaultDriver
          })}
        />
      );
    }

    if (dialog.kind === 'driver') {
      const d = drivers.find((x) => x.name === dialog.key);
      if (!d) return null;
      const fields: DialogField[] = [
        { key: 'name', label: 'Name', display: d.name, value: d.name, locked: true, hint: "A driver's name is how their trips are recorded, so it can't be changed. To correct it, add the right name and delete this one." },
        { key: 'licence', label: 'Licence no', display: d.licence, value: blank(d.licence) },
        { key: 'expiry', label: 'Licence expiry', type: 'date', display: d.expiry, value: parseDisplayDate(d.expiry) },
        { key: 'credential', label: 'Credential', display: d.credential, value: blank(d.credential) }
      ];
      return (
        <RecordDialog
          key={`driver-${d.name}-${dialog.edit}`} title={d.name} subtitle="Driver" fields={fields} startInEdit={dialog.edit} canEdit onClose={close}
          onSave={(x) => onUpdateDriver(d.name, { licence: x.licence, expiry: x.expiry, credential: x.credential })}
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
          <div className="field"><label>Reg No</label><input className="input" type="text" placeholder="TN00 XX 0000" value={newVehicle.id} onChange={(e) => setNewVehicle((v) => ({ ...v, id: e.target.value }))} /></div>
          <div className="field"><label>Reg Date</label><input className="input" type="date" value={newVehicle.regDate} onChange={(e) => setNewVehicle((v) => ({ ...v, regDate: e.target.value }))} /></div>
          <div className="field"><label>Batch #</label><input className="input" type="text" placeholder="Batch no" value={newVehicle.batchNo} onChange={(e) => setNewVehicle((v) => ({ ...v, batchNo: e.target.value }))} /></div>
          <div className="field"><label>Tax Date</label><input className="input" type="date" value={newVehicle.taxDate} onChange={(e) => setNewVehicle((v) => ({ ...v, taxDate: e.target.value }))} /></div>
          <div className="field"><label>Inspection Date</label><input className="input" type="date" value={newVehicle.inspectionDate} onChange={(e) => setNewVehicle((v) => ({ ...v, inspectionDate: e.target.value }))} /></div>
          <div className="field"><label>NP Date</label><input className="input" type="date" value={newVehicle.npDate} onChange={(e) => setNewVehicle((v) => ({ ...v, npDate: e.target.value }))} /></div>
          <div className="field"><label>FC Date</label><input className="input" type="date" value={newVehicle.fcDate} onChange={(e) => setNewVehicle((v) => ({ ...v, fcDate: e.target.value }))} /></div>
          <div className="field"><label>Pollution Cert Date</label><input className="input" type="date" value={newVehicle.pollutionDate} onChange={(e) => setNewVehicle((v) => ({ ...v, pollutionDate: e.target.value }))} /></div>
          <div className="field"><label>Owner</label><input className="input" type="text" placeholder="Owner name" value={newVehicle.owner} onChange={(e) => setNewVehicle((v) => ({ ...v, owner: e.target.value }))} /></div>
          <div className="field">
            <label>Age of Vehicle</label>
            <input className="input" type="text" disabled value={vehicleAge(newVehicle.regDate ? formatDisplayDate(newVehicle.regDate) : '')} title="Worked out from the Reg Date" />
          </div>
          <div className="field"><label>Model</label><input className="input" type="text" placeholder="Make and model" value={newVehicle.model} onChange={(e) => setNewVehicle((v) => ({ ...v, model: e.target.value }))} /></div>
          <div className="field"><label>Renewal date</label><input className="input" type="date" value={newVehicle.renewalDate} onChange={(e) => setNewVehicle((v) => ({ ...v, renewalDate: e.target.value }))} /></div>
          <button type="button" className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={addVehicle}>Add truck</button>
          {vehicleError && <div role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13 }}>{vehicleError}</div>}
        </div>
      </div>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)', marginBottom: 30 }}>
        <table className="table" style={{ minWidth: 1000 }}>
          <thead>
            <tr><th>Vehicle</th><th>Owner</th><th>Reg Date</th><th>Age</th><th>Model</th><th>FC Date</th><th>Renewal date</th><th className="col-actions"></th></tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{v.id}</td>
                <td>{v.owner}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{v.regDate}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{vehicleAge(v.regDate)}</td>
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
              <tr><td colSpan={8} style={{ color: 'var(--color-neutral-700)' }}>No trucks yet.</td></tr>
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
          <button type="button" className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={addDriver}>Add driver</button>
          {driverError && <div role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13 }}>{driverError}</div>}
        </div>
      </div>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
        <table className="table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>Driver</th><th>Licence no</th><th>Expiry</th><th>Credential</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.name}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{d.name}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{d.licence}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{d.expiring ? <span className="tag tag-accent">{d.expiry}</span> : <span>{d.expiry}</span>}</td>
                <td style={{ color: 'var(--color-neutral-700)' }}>{d.credential}</td>
                <td className="col-actions">
                  <div style={actions}>
                    <button type="button" className="btn btn-ghost" style={rowBtn} onClick={() => setDialog({ kind: 'driver', key: d.name, edit: false })}>View</button>
                    <button type="button" className="btn btn-ghost" style={rowBtn} onClick={() => setDialog({ kind: 'driver', key: d.name, edit: true })}>Edit</button>
                    <button type="button" className="btn btn-ghost" onClick={() => onRemoveDriver(d.name)}>Delete driver</button>
                  </div>
                </td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr><td colSpan={6} style={{ color: 'var(--color-neutral-700)' }}>No drivers yet.</td></tr>
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
