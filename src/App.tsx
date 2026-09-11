import { useState } from 'react';
import type { MonthlyExpense, Role, TabId, Trip } from './types';
import { MONTHLY_EXPENSES, ROLE_TABS, TRIPS } from './data/mockData';
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

  // Drivers only ever see their own rows — the demo driver account is Murugan S.
  const visibleTrips = role === 'Driver' ? trips.filter((t) => t.driver === 'Murugan S') : trips;

  if (!authed) {
    return <SignIn onSignIn={signIn} />;
  }

  return (
    <AppShell role={role} tab={tab} onRoleChange={changeRole} onTabChange={setTab} onSignOut={signOut}>
      {tab === 'summary' && (
        <MovementSummary
          trips={visibleTrips}
          expenses={expenses}
          vehicleFilter={vehicleFilter}
          driverFilter={driverFilter}
          onVehicleFilter={setVehicleFilter}
          onDriverFilter={setDriverFilter}
          onResetFilters={resetFilters}
        />
      )}
      {tab === 'addtrip' && <AddMovement onAdd={addTrip} driverOnly={role === 'Driver'} />}
      {tab === 'triplog' && (
        <TripLog
          trips={visibleTrips}
          vehicleFilter={vehicleFilter}
          driverFilter={driverFilter}
          onVehicleFilter={setVehicleFilter}
          onDriverFilter={setDriverFilter}
          onResetFilters={resetFilters}
          onAddMovement={() => setTab('addtrip')}
        />
      )}
      {tab === 'expenses' && <MonthlyExpenses expenses={expenses} onAdd={addExpense} />}
      {tab === 'report' && <MonthlyReport trips={trips} expenses={expenses} />}
      {tab === 'people' && <People trips={trips} />}
      {tab === 'schema' && <DataModel />}
    </AppShell>
  );
}
