import type { Trip } from '../types';
import { DRIVER_MASTER, USER_ROWS } from '../data/mockData';
import { formatNum, rupees, tripCost } from '../utils/calc';

interface Props {
  trips: Trip[];
}

export function People({ trips }: Props) {
  const driverRows = DRIVER_MASTER.map((d) => {
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
          <div className="kicker">Meridian Exim · 7 accounts, 3 branches</div>
          <h1 style={{ fontSize: 34, letterSpacing: '-0.02em' }}>People</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secondary">Add driver</button>
          <button type="button" className="btn btn-primary">Invite user</button>
        </div>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>User accounts</h2>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)', marginBottom: 30 }}>
        <table className="table" style={{ minWidth: 1000 }}>
          <thead>
            <tr><th>Name</th><th>Role</th><th>Mobile</th><th>Branch</th><th>Can see</th><th>Last active</th></tr>
          </thead>
          <tbody>
            {USER_ROWS.map((u) => (
              <tr key={u.phone}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{u.name}</td>
                <td>{u.isManager ? <span className="tag tag-accent">{u.role}</span> : <span className="tag tag-outline">{u.role}</span>}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{u.phone}</td>
                <td>{u.branch}</td>
                <td style={{ color: 'var(--color-neutral-700)' }}>{u.access}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{u.seen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Drivers</h2>
      <div className="scroll-x" style={{ border: '2px solid var(--color-divider)' }}>
        <table className="table" style={{ minWidth: 1120 }}>
          <thead>
            <tr>
              <th>Driver</th><th>Licence no</th><th>Expiry</th><th>Assigned vehicle</th><th>Credential</th>
              <th style={{ textAlign: 'right' }}>Movements</th><th style={{ textAlign: 'right' }}>Pending</th>
              <th style={{ textAlign: 'right' }}>KM</th><th style={{ textAlign: 'right' }}>₹/km</th><th style={{ textAlign: 'right' }}>Revenue</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ color: 'var(--color-neutral-700)', maxWidth: '74ch', lineHeight: 1.6, marginTop: 16 }}>
        Licences inside 60 days of expiry are flagged; the same check runs nightly and pushes a notification to the manager.
        A driver account only ever reads its own movements — enforced in the database, not the client.
      </p>
    </section>
  );
}
