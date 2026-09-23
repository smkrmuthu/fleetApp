import { useEffect, useState } from 'react';
import type { AppNotification, DriverLeave, DriverMaster, MasterSettings, MonthlyExpense, Role, TabId, Trip, UserAccount, Vehicle } from './types';
import { DEMO_ACCOUNTS, ROLE_TABS } from './data/mockData';
import { rupees, toIsoDate } from './utils/calc';
import { exportBackup } from './lib/reports';
import * as api from './lib/api';
import { SignIn } from './components/SignIn';
import { AppShell } from './components/AppShell';
import { MovementSummary } from './components/MovementSummary';
import { AddMovement } from './components/AddMovement';
import { TripLog } from './components/TripLog';
import { MonthlyExpenses } from './components/MonthlyExpenses';
import { MonthlyReport } from './components/MonthlyReport';
import { People } from './components/People';
import { Master } from './components/Master';
import { DataModel } from './components/DataModel';

type PersonUser = UserAccount & { id: string };

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return { from, to };
}

export function App() {
  const [authed, setAuthed] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [role, setRole] = useState<Role>('Manager');
  const [currentUserName, setCurrentUserName] = useState('');
  const [tab, setTab] = useState<TabId>(ROLE_TABS['Manager'][0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<DriverMaster[]>([]);
  const [users, setUsers] = useState<PersonUser[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [master, setMaster] = useState<MasterSettings>({ dieselRate: null, adblueRate: null, loadingPoint: null });
  const [driverLeaves, setDriverLeaves] = useState<DriverLeave[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(() => currentMonthRange().from);
  const [dateTo, setDateTo] = useState(() => currentMonthRange().to);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  async function loadAll(currentRole: Role) {
    setLoading(true);
    setError('');
    try {
      const [v, d, t, e, r] = await Promise.all([api.fetchVehicles(), api.fetchDrivers(), api.fetchTrips(), api.fetchMonthlyExpenses(), api.fetchMasterSettings()]);
      setVehicles(v);
      setDrivers(d);
      setTrips(t);
      setExpenses(e);
      setMaster(r);
      if (currentRole !== 'Driver') {
        const [u, n, l] = await Promise.all([api.fetchUsers(), api.fetchNotifications(), api.fetchDriverLeaves()]);
        setUsers(u);
        setNotifications(n);
        setDriverLeaves(l);
      } else {
        setUsers([]);
        setNotifications([]);
        setDriverLeaves([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.restoreSession().then((session) => {
      if (session) {
        setRole(session.role);
        setCurrentUserName(session.name);
        setTab(ROLE_TABS[session.role][0]);
        setAuthed(true);
        loadAll(session.role);
      }
      setCheckingSession(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(phone: string, password: string) {
    const { role: r, name } = await api.login(phone, password);
    setRole(r);
    setCurrentUserName(name);
    setTab(ROLE_TABS[r][0]);
    setAuthed(true);
    await loadAll(r);
  }

  function signOut() {
    api.clearToken();
    setAuthed(false);
  }

  // The header's role switcher is a demo affordance for trying the three
  // roles quickly — it re-authenticates as that role's real demo account
  // rather than just flipping a client-side flag, so every permission check
  // it triggers is the same one a genuinely different user would hit.
  async function changeRole(r: Role) {
    const demo = DEMO_ACCOUNTS.find((a) => a.key === r);
    if (!demo) return;
    try {
      await signIn(demo.phone, demo.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not switch role');
    }
  }

  function resetFilters() {
    setVehicleFilter('all');
    setDriverFilter('');
    const { from, to } = currentMonthRange();
    setDateFrom(from);
    setDateTo(to);
  }

  async function submitTrip(action: 'create' | 'start' | 'save' | 'complete', trip: Trip) {
    try {
      if (action === 'create' || action === 'start') {
        await api.createTrip({
          id: trip.id, vehicle: trip.vehicle, driver: trip.driver, waybillNo: trip.waybillNo, itemNo: trip.itemNo,
          loadDate: trip.loadDate, unloadDate: trip.unloadDate, from: trip.from, fromNote: trip.fromNote, to: trip.to, toNote: trip.toNote, tons: trip.tons,
          odoStart: trip.odoStart ?? 0, odoEnd: trip.odoEnd ?? 0, revenue: trip.revenue, remarks: trip.remarks,
          expenses: trip.expenses, stops: trip.stops, documents: trip.documents, draft: action === 'start'
        });
      } else {
        const originalIds = new Set((editingTrip?.expenses ?? []).map((e) => e.id));
        const newLines = trip.expenses.filter((e) => !originalIds.has(e.id));
        const removedLines = (editingTrip?.expenses ?? []).filter((e) => !trip.expenses.some((l) => l.id === e.id));
        const originalDocIds = new Set((editingTrip?.documents ?? []).map((d) => d.id));
        const newDocs = trip.documents.filter((d) => !originalDocIds.has(d.id));
        const removedDocs = (editingTrip?.documents ?? []).filter((d) => !trip.documents.some((td) => td.id === d.id));
        const stopSig = (list: { location: string; odo?: number; note?: string }[]) => JSON.stringify(list.map((st) => [st.location, st.odo ?? null, st.note ?? '']));
        const stopsChanged = stopSig(trip.stops) !== stopSig(editingTrip?.stops ?? []);
        await api.updateTrip(trip.id, {
          vehicle: trip.vehicle, driver: trip.driver, waybillNo: trip.waybillNo, itemNo: trip.itemNo, loadDate: trip.loadDate,
          unloadDate: trip.unloadDate, from: trip.from, fromNote: trip.fromNote, to: trip.to, toNote: trip.toNote, tons: trip.tons, odoStart: trip.odoStart,
          odoEnd: trip.odoEnd, revenue: trip.revenue, remarks: trip.remarks,
          stops: stopsChanged ? trip.stops : undefined
        });
        for (const line of removedLines) {
          await api.deleteTripExpense(trip.id, line.id);
        }
        for (const line of newLines) {
          await api.addTripExpense(trip.id, line);
        }
        for (const doc of newDocs) {
          await api.uploadTripDocument(trip.id, doc);
        }
        for (const doc of removedDocs) {
          await api.deleteTripDocument(trip.id, doc.id);
        }
        if (action === 'complete') {
          await api.completeTrip(trip.id, trip.odoEnd ?? 0, trip.unloadDate, trip.remarks);
        }
      }
      setEditingTrip(null);
      setTab('triplog');
      const tasks = [api.fetchTrips().then(setTrips)];
      if (role !== 'Driver') tasks.push(api.fetchNotifications().then(setNotifications));
      await Promise.all(tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save movement');
    }
  }

  function startEditingTrip(trip: Trip) {
    setEditingTrip(trip);
    setTab('addtrip');
  }

  function cancelEditingTrip() {
    setEditingTrip(null);
    setTab('triplog');
  }

  // Everything, straight from the server (not the screens' filtered lists).
  async function backupEverything() {
    const [allTrips, v, d, e, m, u] = await Promise.all([
      api.fetchAllTrips(), api.fetchVehicles(), api.fetchDrivers(), api.fetchMonthlyExpenses(), api.fetchMasterSettings(), api.fetchUsers()
    ]);
    await exportBackup({ trips: allTrips, vehicles: v, drivers: d, expenses: e, master: m, users: u });
  }

  async function approveTrip(tripId: string) {
    try {
      await api.approveTrip(tripId);
      await Promise.all([api.fetchTrips().then(setTrips), api.fetchNotifications().then(setNotifications)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve movement');
    }
  }

  async function deleteTrip(trip: Trip) {
    if (!window.confirm(`Delete the movement for ${trip.vehicle} (trip ${trip.waybillNo})? This cannot be undone.`)) return;
    try {
      await api.deleteTrip(trip.id);
      if (editingTrip?.id === trip.id) setEditingTrip(null);
      const tasks = [api.fetchTrips().then(setTrips)];
      if (role !== 'Driver') tasks.push(api.fetchNotifications().then(setNotifications));
      await Promise.all(tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete movement');
    }
  }

  async function openNotification(n: AppNotification) {
    try {
      await api.markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    } catch {
      // non-critical — still navigate even if marking read failed
    }
    setTab(n.tab);
  }

  async function markAllNotificationsRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update notifications');
    }
  }

  async function deleteMonthlyExpense(expense: MonthlyExpense) {
    if (!window.confirm(`Delete this expense — ${expense.category} for ${expense.vehicle}, ${rupees(expense.amount)}? This cannot be undone.`)) return;
    try {
      await api.deleteMonthlyExpense(expense.id);
      setExpenses(await api.fetchMonthlyExpenses());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete expense');
    }
  }

  async function addExpense(expense: MonthlyExpense) {
    try {
      await api.createMonthlyExpense(expense);
      setExpenses(await api.fetchMonthlyExpenses());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add expense');
    }
  }

  // Add-truck / add-driver report failures back to the form itself (returned
  // as a message) rather than the page-top banner, which sits off-screen
  // while someone is filling in a form further down the People page.
  async function addVehicle(vehicle: Vehicle): Promise<string | null> {
    try {
      await api.createVehicle(vehicle);
      setVehicles(await api.fetchVehicles());
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not add truck';
    }
  }

  async function editVehicle(id: string, v: { model?: string; fcDate?: string; renewalDate?: string; defaultDriver?: string }): Promise<string | null> {
    try {
      await api.updateVehicle(id, v);
      setVehicles(await api.fetchVehicles());
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not save truck';
    }
  }

  async function saveMasterSettings(r: Partial<MasterSettings>): Promise<string | null> {
    try {
      setMaster(await api.updateMasterSettings(r));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not save rates';
    }
  }

  async function addDriverLeave(l: { driver: string; startsAt: string; endsAt: string; remarks?: string }): Promise<string | null> {
    try {
      await api.createDriverLeave(l);
      setDriverLeaves(await api.fetchDriverLeaves());
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not save leave';
    }
  }

  async function removeDriverLeave(id: string) {
    try {
      await api.deleteDriverLeave(id);
      setDriverLeaves((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete leave');
    }
  }

  async function editDriver(name: string, d: { licence: string; expiry: string; vehicle: string; credential: string }): Promise<string | null> {
    try {
      await api.updateDriver(name, d);
      setDrivers(await api.fetchDrivers());
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not save driver';
    }
  }

  async function editUser(id: string, u: { name: string; phone: string; role: string; branchId: string }): Promise<string | null> {
    try {
      await api.updateUser(id, u);
      setUsers(await api.fetchUsers());
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not save account';
    }
  }

  async function removeVehicle(id: string) {
    try {
      await api.deleteVehicle(id);
      setVehicles(await api.fetchVehicles());
      if (vehicleFilter === id) setVehicleFilter('all');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete truck');
    }
  }

  async function addDriver(driver: DriverMaster): Promise<string | null> {
    try {
      await api.createDriver(driver);
      setDrivers(await api.fetchDrivers());
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not add driver';
    }
  }

  async function removeDriver(name: string) {
    try {
      await api.deleteDriver(name);
      const [d, v] = await Promise.all([api.fetchDrivers(), api.fetchVehicles()]);
      setDrivers(d);
      setVehicles(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete driver');
    }
  }

  async function removeUser(id: string) {
    try {
      await api.deleteUser(id);
      setUsers(await api.fetchUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete account');
    }
  }

  if (checkingSession) return null;

  if (!authed) {
    return <SignIn onSignIn={signIn} />;
  }

  return (
    <AppShell
      role={role}
      userName={currentUserName}
      tab={tab}
      onRoleChange={changeRole}
      onTabChange={setTab}
      onSignOut={signOut}
      notifications={notifications}
      onOpenNotification={openNotification}
      onMarkAllNotificationsRead={markAllNotificationsRead}
    >
      {error && (
        <div style={{ border: '2px solid var(--color-accent)', color: 'var(--color-accent-700)', padding: '10px 16px', marginBottom: 16 }}>
          {error} <button type="button" className="btn btn-ghost" style={{ padding: '0 6px' }} onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      {loading && <div style={{ color: 'var(--color-neutral-700)', marginBottom: 16 }}>Loading…</div>}

      {tab === 'summary' && (
        <MovementSummary
          trips={trips}
          expenses={expenses}
          vehicles={vehicles}
          drivers={drivers}
          vehicleFilter={vehicleFilter}
          driverFilter={driverFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onVehicleFilter={setVehicleFilter}
          onDriverFilter={setDriverFilter}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
          onResetFilters={resetFilters}
        />
      )}
      {tab === 'addtrip' && (
        <AddMovement
          key={role + (editingTrip?.id ?? 'new')}
          onSubmit={submitTrip}
          driverOnly={role === 'Driver'}
          vehicles={vehicles}
          drivers={drivers}
          master={master}
          defaultDriverName={role === 'Driver' ? currentUserName : undefined}
          editingTrip={editingTrip}
          onCancelEdit={cancelEditingTrip}
        />
      )}
      {tab === 'triplog' && (
        <TripLog
          trips={trips}
          vehicles={vehicles}
          drivers={drivers}
          vehicleFilter={vehicleFilter}
          driverFilter={driverFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onVehicleFilter={setVehicleFilter}
          onDriverFilter={setDriverFilter}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
          onResetFilters={resetFilters}
          onAddMovement={() => { setEditingTrip(null); setTab('addtrip'); }}
          onApprove={approveTrip}
          onBackup={backupEverything}
          onEdit={startEditingTrip}
          onDelete={deleteTrip}
          role={role}
        />
      )}
      {tab === 'expenses' && (
        <MonthlyExpenses
          expenses={expenses}
          vehicles={vehicles}
          drivers={drivers}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
          onResetFilters={resetFilters}
          onAdd={addExpense}
          onDelete={deleteMonthlyExpense}
        />
      )}
      {tab === 'report' && (
        <MonthlyReport
          trips={trips}
          expenses={expenses}
          vehicles={vehicles}
          drivers={drivers}
          vehicleFilter={vehicleFilter}
          driverFilter={driverFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onVehicleFilter={setVehicleFilter}
          onDriverFilter={setDriverFilter}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
          onResetFilters={resetFilters}
        />
      )}
      {tab === 'people' && (
        <People
          vehicles={vehicles}
          drivers={drivers}
          users={users}
          onAddVehicle={addVehicle}
          onRemoveVehicle={removeVehicle}
          onAddDriver={addDriver}
          onUpdateVehicle={editVehicle}
          onUpdateDriver={editDriver}
          onUpdateUser={editUser}
          onRemoveDriver={removeDriver}
          onRemoveUser={removeUser}
          canDeleteAccounts={role === 'Manager'}
          canEditAccounts={role === 'Manager'}
        />
      )}
      {tab === 'master' && (
        <Master
          vehicles={vehicles}
          drivers={drivers}
          settings={master}
          onSave={saveMasterSettings}
          onSetDefaultDriver={(vehicleId, driver) => editVehicle(vehicleId, { defaultDriver: driver })}
          leaves={driverLeaves}
          onAddLeave={addDriverLeave}
          onRemoveLeave={removeDriverLeave}
        />
      )}
      {tab === 'schema' && <DataModel />}
    </AppShell>
  );
}
