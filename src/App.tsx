import { useEffect, useState } from 'react';
import type { AppNotification, DriverMaster, MonthlyExpense, Role, TabId, Trip, UserAccount, Vehicle } from './types';
import { DEMO_ACCOUNTS, ROLE_TABS } from './data/mockData';
import { toIsoDate } from './utils/calc';
import * as api from './lib/api';
import { SignIn } from './components/SignIn';
import { AppShell } from './components/AppShell';
import { MovementSummary } from './components/MovementSummary';
import { AddMovement } from './components/AddMovement';
import { TripLog } from './components/TripLog';
import { MonthlyExpenses } from './components/MonthlyExpenses';
import { MonthlyReport } from './components/MonthlyReport';
import { People } from './components/People';
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
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(() => currentMonthRange().from);
  const [dateTo, setDateTo] = useState(() => currentMonthRange().to);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  async function loadAll(currentRole: Role) {
    setLoading(true);
    setError('');
    try {
      const [v, d, t, e] = await Promise.all([api.fetchVehicles(), api.fetchDrivers(), api.fetchTrips(), api.fetchMonthlyExpenses()]);
      setVehicles(v);
      setDrivers(d);
      setTrips(t);
      setExpenses(e);
      if (currentRole !== 'Driver') {
        const [u, n] = await Promise.all([api.fetchUsers(), api.fetchNotifications()]);
        setUsers(u);
        setNotifications(n);
      } else {
        setUsers([]);
        setNotifications([]);
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
          loadDate: trip.loadDate, unloadDate: trip.unloadDate, from: trip.from, to: trip.to, tons: trip.tons,
          odoStart: trip.odoStart ?? 0, odoEnd: trip.odoEnd ?? 0, revenue: trip.revenue, remarks: trip.remarks,
          expenses: trip.expenses, documents: trip.documents, draft: action === 'start'
        });
      } else {
        const originalIds = new Set((editingTrip?.expenses ?? []).map((e) => e.id));
        const newLines = trip.expenses.filter((e) => !originalIds.has(e.id));
        const originalDocIds = new Set((editingTrip?.documents ?? []).map((d) => d.id));
        const newDocs = trip.documents.filter((d) => !originalDocIds.has(d.id));
        const removedDocs = (editingTrip?.documents ?? []).filter((d) => !trip.documents.some((td) => td.id === d.id));
        await api.updateTrip(trip.id, {
          vehicle: trip.vehicle, waybillNo: trip.waybillNo, itemNo: trip.itemNo, loadDate: trip.loadDate,
          unloadDate: trip.unloadDate, from: trip.from, to: trip.to, tons: trip.tons, odoStart: trip.odoStart,
          revenue: trip.revenue, remarks: trip.remarks
        });
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

  async function approveTrip(tripId: string) {
    try {
      await api.approveTrip(tripId);
      await Promise.all([api.fetchTrips().then(setTrips), api.fetchNotifications().then(setNotifications)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve movement');
    }
  }

  async function deleteTrip(trip: Trip) {
    if (!window.confirm(`Delete the movement for ${trip.vehicle} (waybill ${trip.waybillNo})? This cannot be undone.`)) return;
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

  async function addExpense(expense: MonthlyExpense) {
    try {
      await api.createMonthlyExpense(expense);
      setExpenses(await api.fetchMonthlyExpenses());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add expense');
    }
  }

  async function addVehicle(vehicle: Vehicle) {
    try {
      await api.createVehicle(vehicle);
      setVehicles(await api.fetchVehicles());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add truck');
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

  async function addDriver(driver: DriverMaster) {
    try {
      await api.createDriver(driver);
      setDrivers(await api.fetchDrivers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add driver');
    }
  }

  async function removeDriver(name: string) {
    try {
      await api.deleteDriver(name);
      setDrivers(await api.fetchDrivers());
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
          lockedDriverName={role === 'Driver' ? currentUserName : undefined}
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
          onEdit={startEditingTrip}
          onDelete={deleteTrip}
          isDriver={role === 'Driver'}
        />
      )}
      {tab === 'expenses' && (
        <MonthlyExpenses
          expenses={expenses}
          vehicles={vehicles}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
          onResetFilters={resetFilters}
          onAdd={addExpense}
        />
      )}
      {tab === 'report' && (
        <MonthlyReport
          trips={trips}
          expenses={expenses}
          vehicles={vehicles}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
          onResetFilters={resetFilters}
        />
      )}
      {tab === 'people' && (
        <People
          trips={trips}
          vehicles={vehicles}
          drivers={drivers}
          users={users}
          onAddVehicle={addVehicle}
          onRemoveVehicle={removeVehicle}
          onAddDriver={addDriver}
          onRemoveDriver={removeDriver}
          onRemoveUser={removeUser}
          canDeleteAccounts={role === 'Manager'}
        />
      )}
      {tab === 'schema' && <DataModel />}
    </AppShell>
  );
}
