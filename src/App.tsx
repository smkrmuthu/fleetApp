import { useState } from 'react';
import type { DriverMaster, MonthlyExpense, Role, TabId, Trip, Vehicle } from './types';
import { DRIVER_MASTER, MONTHLY_EXPENSES, ROLE_TABS, TRIPS, VEHICLES } from './data/mockData';
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

  // Drivers only ever see their own rows — the demo driver account is Murugan S.
  const visibleTrips = role === 'Driver' ? trips.filter((t) => t.driver === 'Murugan S') : trips;
  const showFinancials = role !== 'Driver';

  if (!authed) {
    return <SignIn onSignIn={signIn} />;
  }

  return (
    <AppShell role={role} tab={tab} onRoleChange={changeRole} onTabChange={setTab} onSignOut={signOut}>
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
      {tab === 'addtrip' && <AddMovement onAdd={addTrip} driverOnly={role === 'Driver'} vehicles={vehicles} />}
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
          showFinancials={showFinancials}
        />
      )}
      {tab === 'expenses' && <MonthlyExpenses expenses={expenses} vehicles={vehicles} onAdd={addExpense} />}
      {tab === 'report' && <MonthlyReport trips={trips} expenses={expenses} vehicles={vehicles} />}
      {tab === 'people' && (
        <People
          trips={trips}
          vehicles={vehicles}
          drivers={drivers}
          onAddVehicle={addVehicle}
          onRemoveVehicle={removeVehicle}
          onAddDriver={addDriver}
          onRemoveDriver={removeDriver}
        />
      )}
      {tab === 'schema' && <DataModel />}
    </AppShell>
  );
}
