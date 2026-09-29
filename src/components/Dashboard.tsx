import { useState } from 'react';
import type { DriverLeave, DriverMaster, MonthlyExpense, TabId, Trip, Vehicle, VehicleUnavailability } from '../types';
import { parseDisplayDate } from '../lib/api';
import { dieselLitres, dueStatus, formatDateRange, formatNum, rupees, tripCost, tripDurationDays, yearOptions } from '../utils/calc';
import { MonthYearFilter } from './MonthYearFilter';

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

// The 6 calendar months up to and including this one, oldest first — a fixed
// recent-history window, independent of whatever period the Month/Year
// filter above has picked for the KPI tiles.
function lastMonths(n: number): { from: string; to: string; label: string }[] {
  const now = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  const out: { from: string; to: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const from = `${y}-${pad(m + 1)}-01`;
    const to = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
    out.push({ from, to, label: d.toLocaleDateString('en-IN', { month: 'short' }) });
  }
  return out;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const from = `${y}-${pad(m + 1)}-01`;
  const to = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
  return { from, to };
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

interface VehicleSeries { key: string; label: string; color: string; fmt: (n: number) => string }

// A small grouped column chart, one group per truck — shared scale across
// every bar in the chart (matching how the reference sheet this was modelled
// on pairs very different metrics, e.g. trip counts against km/l mileage).
function VehicleGroupChart({ title, data, series }: { title: string; data: Record<string, number | string>[]; series: VehicleSeries[] }) {
  const chartH = 120;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]))));
  return (
    <div style={cardStyle}>
      <div style={alertHeading}>
        <span>{title}</span>
        {series.length > 1 && (
          <span style={{ display: 'flex', gap: 10, fontWeight: 400, fontSize: 12, color: 'var(--color-neutral-700)' }}>
            {series.map((s) => (
              <span key={s.key}><span style={{ display: 'inline-block', width: 9, height: 9, background: s.color, marginRight: 5 }} />{s.label}</span>
            ))}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {data.map((d) => (
          <div key={d.id as string} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 3, height: chartH }}>
            {series.map((s) => {
              const val = Number(d[s.key]);
              return (
                <div key={s.key} style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 2 }}>
                  <div title={`${d.id}: ${s.label} ${s.fmt(val)}`} style={{ width: 14, height: Math.max(1, (val / max) * chartH), background: s.color, borderRadius: '2px 2px 0 0' }} />
                  <div style={{ fontSize: 10, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{s.fmt(val)}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 6 }}>
        {data.map((d) => (
          <div key={d.id as string} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.id}</div>
        ))}
      </div>
    </div>
  );
}

export function Dashboard({ trips, expenses, vehicles, drivers, leaves, unavailability, onTabChange, onEditTrip }: Props) {
  const [dateFrom, setDateFrom] = useState(() => currentMonthRange().from);
  const [dateTo, setDateTo] = useState(() => currentMonthRange().to);
  const label = formatDateRange(dateFrom, dateTo);
  const monthTrips = trips.filter((t) => {
    const d = parseDisplayDate(t.loadDate);
    return d && d >= dateFrom && d <= dateTo;
  });
  const monthExpenses = expenses.filter((e) => {
    const d = parseDisplayDate(e.date);
    return d && d >= dateFrom && d <= dateTo;
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

  // Revenue & profit trend, fixed to the last 6 real calendar months.
  const trend = lastMonths(6).map((bucket) => {
    const bTrips = trips.filter((t) => {
      const d = parseDisplayDate(t.loadDate);
      return d && d >= bucket.from && d <= bucket.to;
    });
    const bExpenses = expenses.filter((e) => {
      const d = parseDisplayDate(e.date);
      return d && d >= bucket.from && d <= bucket.to;
    });
    const revenue = bTrips.reduce((a, t) => a + t.revenue, 0);
    const cost = bTrips.reduce((a, t) => a + tripCost(t).expense, 0) + bExpenses.reduce((a, e) => a + e.amount, 0);
    return { label: bucket.label, revenue, profit: revenue - cost };
  });
  // Revenue and profit get independent scales, not a shared one — a single
  // very bad month's loss would otherwise dwarf normal revenue bars and
  // crush the other five months to invisibility.
  const chartH = 120;
  const maxRevenue = Math.max(1, ...trend.map((t) => t.revenue));
  const revenueScale = chartH / maxRevenue;
  const maxProfitUp = Math.max(1, ...trend.map((t) => Math.max(0, t.profit)));
  const maxProfitDown = Math.max(0, ...trend.map((t) => (t.profit < 0 ? -t.profit : 0)));
  const profitZeroY = (maxProfitUp / (maxProfitUp + maxProfitDown)) * chartH;
  const profitScale = chartH / (maxProfitUp + maxProfitDown);

  // Revenue by vehicle, for whichever period the filter above is set to.
  const byVehicleRevenue = vehicles
    .map((v) => ({ vehicle: v.id, revenue: monthTrips.filter((t) => t.vehicle === v.id).reduce((a, t) => a + t.revenue, 0) }))
    .filter((v) => v.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
  const maxVehicleRevenue = Math.max(1, ...byVehicleRevenue.map((v) => v.revenue));

  // Full per-truck breakdown for the filtered period — trucks with no
  // movements in it are left out rather than shown as a row of zeroes.
  const vehicleStats = vehicles
    .map((v) => {
      const vTrips = monthTrips.filter((t) => t.vehicle === v.id);
      const km = vTrips.reduce((a, t) => a + t.km, 0);
      const dieselL = vTrips.reduce((a, t) => a + dieselLitres(t.expenses), 0);
      const tons = vTrips.reduce((a, t) => a + t.tons, 0);
      const onRoadDays = vTrips.reduce((a, t) => a + (tripDurationDays(t.loadDate, t.unloadDate) ?? 0), 0);
      const tripExpense = vTrips.reduce((a, t) => a + tripCost(t).expense, 0);
      const fixed = monthExpenses.filter((e) => e.vehicle === v.id).reduce((a, e) => a + e.amount, 0);
      const revenue = vTrips.reduce((a, t) => a + t.revenue, 0);
      return {
        id: v.id, trips: vTrips.length, km, onRoadDays, dieselL, tons,
        mileage: dieselL ? km / dieselL : 0, expense: tripExpense + fixed, revenue, perTon: tons ? revenue / tons : 0
      };
    })
    .filter((v) => v.trips > 0);

  const recent = trips.slice(0, 6);

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div className="kicker">Manager · {label}</div>
          <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>Dashboard</h1>
          <p style={{ color: 'var(--color-neutral-700)', marginTop: 6, fontSize: 13 }}>
            Where things stand right now — the numbers for the period below, and what needs your attention today.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => onTabChange('addtrip')}>Add movement</button>
          <button type="button" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => onTabChange('triplog')}>Trip Log</button>
          <button type="button" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => onTabChange('people')}>People</button>
          <button type="button" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => onTabChange('master')}>Master</button>
        </div>
      </div>

      <div style={{ border: '2px solid var(--color-divider)', padding: 16, marginBottom: 24 }}>
        <div className="filters-grid">
          <MonthYearFilter
            dateFrom={dateFrom} dateTo={dateTo} onDateFrom={setDateFrom} onDateTo={setDateTo}
            years={yearOptions([...trips.map((t) => t.loadDate), ...expenses.map((e) => e.date)])}
          />
          <button
            type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }}
            onClick={() => { setDateFrom(currentMonthRange().from); setDateTo(currentMonthRange().to); }}
          >
            Back to this month
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, background: 'var(--color-divider)', border: '2px solid var(--color-divider)', marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: 'var(--color-bg)', padding: '16px 18px 18px' }}>
            <div className="stat-label">{s.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1, color: s.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={cardStyle}>
          <div style={alertHeading}><span>Revenue — last 6 months</span></div>
          <div style={{ position: 'relative', height: chartH, marginTop: 4, display: 'flex', alignItems: 'flex-end' }}>
            {trend.map((t) => (
              <div key={t.label} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div
                  title={`${t.label}: ${rupees(t.revenue)}`}
                  style={{ width: 16, height: Math.max(1, t.revenue * revenueScale), background: 'var(--color-neutral-800)', borderRadius: '2px 2px 0 0' }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', marginTop: 6 }}>
            {trend.map((t) => (
              <div key={t.label} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--color-neutral-700)' }}>{t.label}</div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={alertHeading}>
            <span>Profit — last 6 months</span>
            <span style={{ display: 'flex', gap: 10, fontWeight: 400, fontSize: 12, color: 'var(--color-neutral-700)' }}>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, background: 'var(--color-profit)', marginRight: 5 }} />Profit</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, background: 'var(--color-accent-700)', marginRight: 5 }} />Loss</span>
            </span>
          </div>
          <div style={{ position: 'relative', height: chartH, marginTop: 4 }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: profitZeroY, height: 1, background: 'var(--color-divider)' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
              {trend.map((t) => (
                <div key={t.label} style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  {t.profit >= 0 ? (
                    <div
                      title={`${t.label}: Profit ${rupees(t.profit)}`}
                      style={{ width: 16, position: 'absolute', bottom: chartH - profitZeroY, height: Math.max(1, t.profit * profitScale), background: 'var(--color-profit)', borderRadius: '2px 2px 0 0' }}
                    />
                  ) : (
                    <div
                      title={`${t.label}: Loss ${rupees(-t.profit)}`}
                      style={{ width: 16, position: 'absolute', top: profitZeroY, height: Math.max(1, -t.profit * profitScale), background: 'var(--color-accent-700)', borderRadius: '0 0 2px 2px' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', marginTop: 6 }}>
            {trend.map((t) => (
              <div key={t.label} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--color-neutral-700)' }}>{t.label}</div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={alertHeading}><span>Revenue by truck — {label}</span></div>
          {byVehicleRevenue.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>No movements with revenue in this period.</div>
          ) : (
            byVehicleRevenue.map((v) => (
              <div key={v.vehicle} style={{ display: 'grid', gridTemplateColumns: '90px minmax(0,1fr) auto', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.vehicle}</div>
                <div style={{ height: 14, background: 'var(--color-neutral-200)' }}>
                  <div title={rupees(v.revenue)} style={{ height: 14, background: 'var(--color-accent)', width: `${Math.round((v.revenue / maxVehicleRevenue) * 100)}%` }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{rupees(v.revenue)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Fleet performance, by truck — {label}</h2>
      {vehicleStats.length === 0 ? (
        <div style={{ border: '2px solid var(--color-divider)', padding: 16, color: 'var(--color-neutral-700)', marginBottom: 28 }}>No movements in this period.</div>
      ) : (
        <>
          <div className="scroll-x" style={{ border: '2px solid var(--color-divider)', marginBottom: 16 }}>
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Truck</th><th style={{ textAlign: 'right' }}>Trips</th><th style={{ textAlign: 'right' }}>KM</th>
                  <th style={{ textAlign: 'right' }}>On-road days</th><th style={{ textAlign: 'right' }}>Diesel (L)</th>
                  <th style={{ textAlign: 'right' }}>Load (t)</th><th style={{ textAlign: 'right' }}>Mileage (km/L)</th>
                  <th style={{ textAlign: 'right' }}>Expense</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>₹/ton</th>
                </tr>
              </thead>
              <tbody>
                {vehicleStats.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{v.id}</td>
                    <td style={{ textAlign: 'right' }}>{formatNum(v.trips)}</td>
                    <td style={{ textAlign: 'right' }}>{formatNum(v.km)}</td>
                    <td style={{ textAlign: 'right' }}>{formatNum(v.onRoadDays)}</td>
                    <td style={{ textAlign: 'right' }}>{formatNum(v.dieselL)}</td>
                    <td style={{ textAlign: 'right' }}>{formatNum(v.tons, 1)}</td>
                    <td style={{ textAlign: 'right' }}>{v.mileage ? v.mileage.toFixed(2) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{rupees(v.expense)}</td>
                    <td style={{ textAlign: 'right' }}>{rupees(v.revenue)}</td>
                    <td style={{ textAlign: 'right' }}>{v.perTon ? rupees(v.perTon) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 28 }}>
            <VehicleGroupChart
              title="Trips vs Mileage" data={vehicleStats}
              series={[
                { key: 'trips', label: 'Trips', color: 'var(--color-neutral-800)', fmt: (n) => formatNum(n) },
                { key: 'mileage', label: 'Mileage (km/L)', color: 'var(--color-accent)', fmt: (n) => n.toFixed(2) }
              ]}
            />
            <VehicleGroupChart
              title="KM vs Diesel vs Load" data={vehicleStats}
              series={[
                { key: 'km', label: 'KM', color: 'var(--color-neutral-800)', fmt: (n) => formatNum(n) },
                { key: 'dieselL', label: 'Diesel (L)', color: 'var(--color-accent)', fmt: (n) => formatNum(n) },
                { key: 'tons', label: 'Load (t)', color: 'var(--color-profit)', fmt: (n) => formatNum(n, 1) }
              ]}
            />
            <VehicleGroupChart
              title="Expense vs Revenue" data={vehicleStats}
              series={[
                { key: 'expense', label: 'Expense', color: 'var(--color-accent-700)', fmt: (n) => rupees(n) },
                { key: 'revenue', label: 'Revenue', color: 'var(--color-profit)', fmt: (n) => rupees(n) }
              ]}
            />
            <VehicleGroupChart
              title="On-road days" data={vehicleStats}
              series={[{ key: 'onRoadDays', label: 'On-road days', color: 'var(--color-neutral-800)', fmt: (n) => formatNum(n) }]}
            />
          </div>
        </>
      )}

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

