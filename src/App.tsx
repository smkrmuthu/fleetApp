import { useState } from 'react';
import type { AppNotification, DriverMaster, MonthlyExpense, Role, TabId, Trip, UserAccount, Vehicle } from './types';
import { DEMO_DRIVER_NAME, DRIVER_MASTER, MONTHLY_EXPENSES, NOTIFICATIONS, ROLE_TABS, TRIPS, USER_ROWS, VEHICLES } from './data/mockData';
import { SignIn } from './components/SignIn';
import { AppShell } from './components/AppShell';
import { MovementSummary } from './components/MovementSummary';
import { AddMovement } from './components/AddMovement';
import { TripLog } from './components/TripLog';
import { MonthlyExpenses } from './components/MonthlyExpenses';
import { MonthlyReport } from './components/MonthlyReport';
import { People } from './components/People';
import { DataModel } from './components/DataModel';

export function App() {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<Role>('Manager');
  const [tab, setTab] = useState<TabId>(ROLE_TABS['Manager'][0]);
  const [trips, setTrips] = useState<Trip[]>(TRIPS);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>(MONTHLY_EXPENSES);
  const [vehicles, setVehicles] = useState<Vehicle[]>(VEHICLES);
  const [drivers, setDrivers] = useState<DriverMaster[]>(DRIVER_MASTER);
  const [users, setUsers] = useState<UserAccount[]>(USER_ROWS);
  const [notifications, setNotifications] = useState<AppNotification[]>(NOTIFICATIONS);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('');

  function signIn(r: Role) {
    setRole(r);
    setTab(ROLE_TABS[r][0]);
    setAuthed(true);
  }

  function signOut() {
    setAuthed(false);
  }

  function changeRole(r: Role) {
    setRole(r);
    setTab(ROLE_TABS[r][0]);
  }

  function resetFilters() {
    setVehicleFilter('all');
    setDriverFilter('');
  }

  function addTrip(trip: Trip) {
    setTrips((prev) => [trip, ...prev]);
    setTab('triplog');
    if (trip.status === 'pending') {
      const notification: AppNotification = {
        id: 'n' + Date.now(),
        kind: 'approval',
        message: `${trip.driver} logged ${trip.vehicle} — pending approval`,
        tab: 'triplog',
        createdAt: 'Just now',
        read: false,
        relatedTripId: trip.id
      };
      setNotifications((prev) => [notification, ...prev]);
    }
  }

  function approveTrip(tripId: string) {
    setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, status: 'approved' } : t)));
    setNotifications((prev) => prev.map((n) => (n.relatedTripId === tripId ? { ...n, read: true } : n)));
  }

  function openNotification(n: AppNotification) {
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setTab(n.tab);
  }

  function markAllNotificationsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function addExpense(expense: MonthlyExpense) {
    setExpenses((prev) => [expense, ...prev]);
  }

  function addVehicle(vehicle: Vehicle) {
    setVehicles((prev) => (prev.some((v) => v.id === vehicle.id) ? prev : [...prev, vehicle]));
  }

  function removeVehicle(id: string) {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    if (vehicleFilter === id) setVehicleFilter('all');
  }

  function addDriver(driver: DriverMaster) {
    setDrivers((prev) => (prev.some((d) => d.name === driver.name) ? prev : [...prev, driver]));
  }

  function removeDriver(name: string) {
    setDrivers((prev) => prev.filter((d) => d.name !== name));
  }

  function removeUser(phone: string) {
    setUsers((prev) => prev.filter((u) => u.phone !== phone));
  }

  // Drivers only ever see their own rows.
  const visibleTrips = role === 'Driver' ? trips.filter((t) => t.driver === DEMO_DRIVER_NAME) : trips;

  if (!authed) {
    return <SignIn onSignIn={signIn} />;
  }

  return (
    <AppShell
      role={role}
      tab={tab}
      onRoleChange={changeRole}
      onTabChange={setTab}
      onSignOut={signOut}
      notifications={notifications}
      onOpenNotification={openNotification}
      onMarkAllNotificationsRead={markAllNotificationsRead}
    >
      {tab === 'summary' && (
        <MovementSummary
          trips={visibleTrips}
          expenses={expenses}
          vehicles={vehicles}
          vehicleFilter={vehicleFilter}
          driverFilter={driverFilter}
          onVehicleFilter={setVehicleFilter}
          onDriverFilter={setDriverFilter}
          onResetFilters={resetFilters}
        />
      )}
      {tab === 'addtrip' && (
        <AddMovement
          key={role}
          onAdd={addTrip}
          driverOnly={role === 'Driver'}
          vehicles={vehicles}
          drivers={drivers}
          lockedDriverName={role === 'Driver' ? DEMO_DRIVER_NAME : undefined}
        />
      )}
      {tab === 'triplog' && (
        <TripLog
          trips={visibleTrips}
          vehicles={vehicles}
          vehicleFilter={vehicleFilter}
          driverFilter={driverFilter}
          onVehicleFilter={setVehicleFilter}
          onDriverFilter={setDriverFilter}
          onResetFilters={resetFilters}
          onAddMovement={() => setTab('addtrip')}
          onApprove={approveTrip}
          isDriver={role === 'Driver'}
        />
      )}
      {tab === 'expenses' && <MonthlyExpenses expenses={expenses} vehicles={vehicles} onAdd={addExpense} />}
      {tab === 'report' && <MonthlyReport trips={trips} expenses={expenses} vehicles={vehicles} />}
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
