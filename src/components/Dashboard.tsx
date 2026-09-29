import type { DriverLeave, DriverMaster, MonthlyExpense, TabId, Trip, Vehicle, VehicleUnavailability } from '../types';
import { parseDisplayDate } from '../lib/api';
import { dueStatus, formatNum, rupees, tripCost } from '../utils/calc';

interface Props {
  trips: Trip[];
  expenses: MonthlyExpense[];
  vehicles: Vehicle[];
  drivers: DriverMaster[];
  leaves: DriverLeave[];
  unavailability: VehicleUnavailability[];
  onTabChange: (t: TabId) => void;
  onEditTrip: (t: Trip) => void;
}

function currentMonthRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const from = `${y}-${pad(m + 1)}-01`;
  const to = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
  const label = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return { from, to, label };
}

// A naive "YYYY-MM-DDTHH:MM" for right now, in the same local-no-timezone
// format leaves and unavailability windows are stored in.
function nowDateTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const cardStyle: React.CSSProperties = { border: '2px solid var(--color-divider)', padding: 16 };
const alertHeading = { fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } as const;
const rowStyle = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--color-neutral-300)', fontSize: 13 } as const;

export function Dashboard({ trips, expenses, vehicles, drivers, leaves, unavailability, onTabChange, onEditTrip }: Props) {
  const { from, to, label } = currentMonthRange();
  const monthTrips = trips.filter((t) => {
    const d = parseDisplayDate(t.loadDate);
    return d && d >= from && d <= to;
  });
  const monthExpenses = expenses.filter((e) => {
    const d = parseDisplayDate(e.date);
    return d && d >= from && d <= to;
  });
  const totals = monthTrips.reduce(
    (a, t) => {
      const c = tripCost(t);
      a.km += t.km;
      a.tripExpense += c.expense;
      a.revenue += t.revenue;
      return a;
    },
    { km: 0, tripExpense: 0, revenue: 0 }
  );
  const fixedCosts = monthExpenses.reduce((a, e) => a + e.amount, 0);
  const profit = totals.revenue - totals.tripExpense - fixedCosts;
  const stats = [
    { label: 'Movements', value: formatNum(monthTrips.length) },
    { label: 'Total KM', value: formatNum(totals.km) },
    { label: 'Revenue', value: rupees(totals.revenue) },
    { label: 'Trip + fixed costs', value: rupees(totals.tripExpense + fixedCosts) },
    { label: 'Profit', value: rupees(profit), accent: profit >= 0 ? 'var(--color-profit)' : 'var(--color-accent-700)' },
    { label: 'Avg ₹/km', value: totals.km ? rupees((totals.tripExpense + fixedCosts) / totals.km) : '—' }
  ];

  const openTrips = trips.filter((t) => t.status !== 'approved').sort((a, b) => (a.loadDate < b.loadDate ? -1 : 1));

  type Flagged<T extends object> = T & { status: NonNullable<ReturnType<typeof dueStatus>> };
  const isFlagged = <T extends { status: ReturnType<typeof dueStatus> }>(x: T): x is Flagged<T> => x.status !== null;

  const compliance = vehicles
    .flatMap((v) =>
      ([
        ['Tax', v.taxDate], ['Inspection', v.inspectionDate], ['NP', v.npDate], ['FC', v.fcDate], ['Pollution', v.pollutionDate]
      ] as const).map(([name, date]) => ({ vehicle: v.id, name, status: dueStatus(date) }))
    )
    .filter(isFlagged)
    .sort((a, b) => a.status.days - b.status.days);

  const licences = drivers
    .map((d) => ({ driver: d.name, status: dueStatus(d.expiry) }))
    .filter(isFlagged)
    .sort((a, b) => a.status.days - b.status.days);

  const now = nowDateTime();
  const onLeaveNow = leaves.filter((l) => l.startsAt <= now && now <= l.endsAt);
  const unavailableNow = unavailability.filter((w) => w.startsAt <= now && now <= w.endsAt);

  const recent = trips.slice(0, 6);

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <div className="kicker">Manager · {label}</div>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>Dashboard</h1>
        <p style={{ color: 'var(--color-neutral-700)', marginTop: 6, fontSize: 13 }}>
          Where things stand right now — this month's numbers, and what needs your attention.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
        <button type="button" className="btn btn-primary" onClick={() => onTabChange('addtrip')}>Add movement</button>
        <button type="button" className="btn btn-secondary" onClick={() => onTabChange('triplog')}>Trip Log</button>
        <button type="button" className="btn btn-secondary" onClick={() => onTabChange('people')}>People</button>
        <button type="button" className="btn btn-secondary" onClick={() => onTabChange('master')}>Master</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, background: 'var(--color-divider)', border: '2px solid var(--color-divider)', marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: 'var(--color-bg)', padding: '16px 18px 18px' }}>
            <div className="stat-label">{s.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1, color: s.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Needs attention</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={cardStyle}>
          <div style={alertHeading}>
            <span>Open movements</span>
            {openTrips.length > 0 && <span className="tag tag-accent">{openTrips.length}</span>}
          </div>
          {openTrips.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Nothing waiting — every movement is approved.</div>
          ) : (
            <>
              {openTrips.slice(0, 5).map((t) => (
                <div key={t.id} style={rowStyle}>
                  <button type="button" className="btn btn-ghost" style={{ padding: 0, textAlign: 'left' }} onClick={() => onEditTrip(t)}>
                    {t.waybillNo} · {t.vehicle}
                  </button>
                  <span className={t.status === 'pending' ? 'tag tag-accent' : 'tag tag-outline'}>{t.status === 'pending' ? 'Pending' : 'Draft'}</span>
                </div>
              ))}
              {openTrips.length > 5 && (
                <button type="button" className="btn btn-ghost" style={{ marginTop: 8, padding: 0 }} onClick={() => onTabChange('triplog')}>
                  +{openTrips.length - 5} more in Trip Log
                </button>
              )}
            </>
          )}
        </div>

        <div style={cardStyle}>
          <div style={alertHeading}>
            <span>Truck compliance dates</span>
            {compliance.length > 0 && <span className="tag tag-accent">{compliance.length}</span>}
          </div>
          {compliance.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Nothing due within 60 days.</div>
          ) : (
            <>
              {compliance.slice(0, 5).map((c, i) => (
                <div key={i} style={rowStyle}>
                  <span>{c.vehicle} · {c.name}</span>
                  <span style={{ color: c.status.expired ? 'var(--color-accent-700)' : 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{c.status.label}</span>
                </div>
              ))}
              {compliance.length > 5 && (
                <button type="button" className="btn btn-ghost" style={{ marginTop: 8, padding: 0 }} onClick={() => onTabChange('people')}>
                  +{compliance.length - 5} more under People
                </button>
              )}
            </>
          )}
        </div>

        <div style={cardStyle}>
          <div style={alertHeading}>
            <span>Driver licences</span>
            {licences.length > 0 && <span className="tag tag-accent">{licences.length}</span>}
          </div>
          {licences.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>No licences due within 60 days.</div>
          ) : (
            licences.map((l, i) => (
              <div key={i} style={rowStyle}>
                <span>{l.driver}</span>
                <span style={{ color: l.status.expired ? 'var(--color-accent-700)' : 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{l.status.label}</span>
              </div>
            ))
          )}
        </div>

        <div style={cardStyle}>
          <div style={alertHeading}>
            <span>On leave / off the road today</span>
            {(onLeaveNow.length + unavailableNow.length) > 0 && <span className="tag tag-accent">{onLeaveNow.length + unavailableNow.length}</span>}
          </div>
          {onLeaveNow.length === 0 && unavailableNow.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Every driver and truck is available.</div>
          ) : (
            <>
              {onLeaveNow.map((l) => (
                <div key={l.id} style={rowStyle}><span>{l.driver}</span><span style={{ color: 'var(--color-neutral-700)' }}>On leave</span></div>
              ))}
              {unavailableNow.map((w) => (
                <div key={w.id} style={rowStyle}><span>{w.vehicle}</span><span style={{ color: 'var(--color-neutral-700)' }}>Unavailable</span></div>
              ))}
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12 }}>
        <h2 style={{ fontSize: 20 }}>Recent movements</h2>
        <button type="button" className="btn btn-ghost" style={{ padding: 0 }} onClick={() => onTabChange('triplog')}>View all in Trip Log</button>
      </div>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
        <table className="table" style={{ minWidth: 640 }}>
          <thead>
            <tr><th>Trip No.</th><th>Loading Date</th><th>Vehicle</th><th>Driver</th><th>Status</th></tr>
          </thead>
          <tbody>
            {recent.map((t) => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{t.waybillNo}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{t.loadDate}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{t.vehicle}</td>
                <td>{t.driver}</td>
                <td>
                  <span className={t.status === 'approved' ? 'tag tag-outline' : t.status === 'pending' ? 'tag tag-accent' : 'tag tag-neutral'}>
                    {t.status === 'approved' ? 'Approved' : t.status === 'pending' ? 'Pending' : 'Draft'}
                  </span>
                </td>
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--color-neutral-700)' }}>No movements recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

