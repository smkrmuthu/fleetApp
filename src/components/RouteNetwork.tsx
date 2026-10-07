import { lazy, Suspense, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { groupRoutes } from '../utils/placeGeo';
import { StatusBadge } from './ui';
import { usePlacePositions } from './usePlacePositions';
import type { MapLane } from './RouteMap';

const RouteMap = lazy(() => import('./RouteMap'));

// The lanes trucks ran in the period, on a map (OpenStreetMap) with the same
// lanes listed beside it. Positions come from the place names on each
// movement, and lines join the two places directly: there is no GPS, so they
// are not the roads driven. A place that cannot be found stays in the list.
export function RouteNetwork({ trips, periodLabel }: { trips: { from: string; to: string; open: boolean }[]; periodLabel: string }) {
  // The dashboard hands over a fresh array on every render; key on the content so the map is not redrawn (and re-zoomed) each time.
  const tripSig = trips.map((t) => `${t.from}\u0001${t.to}\u0001${t.open ? 1 : 0}`).join('\u0002');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { groups, skipped } = useMemo(() => groupRoutes(trips), [tripSig]);
  const keys = useMemo(() => [...new Set(groups.flatMap((g) => [g.from, g.to]))], [groups]);
  const { positions, pending, missing } = usePlacePositions(keys);

  const fresh: MapLane[] = groups.flatMap((g) => {
    const a = positions.get(g.from.toLowerCase());
    const b = positions.get(g.to.toLowerCase());
    return a && b ? [{ from: g.from, to: g.to, a: [a.lat, a.lon] as [number, number], b: [b.lat, b.lon] as [number, number], trips: g.trips, open: g.open }] : [];
  });
  const laneSig = JSON.stringify(fresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lanes = useMemo(() => fresh, [laneSig]);

  const unplaced = (g: { from: string; to: string }) => !positions.has(g.from.toLowerCase()) || !positions.has(g.to.toLowerCase());

  return (
    <div className="card map-card">
      <div className="map-canvas">
        <div className="map-tag"><StatusBadge>Straight lines · not road routes</StatusBadge></div>
        {groups.length === 0 ? (
          <div className="map-empty">No routes to show for this period</div>
        ) : lanes.length === 0 ? (
          <div className="map-empty">{pending.length ? `Locating ${pending.length} ${pending.length === 1 ? 'place' : 'places'}…` : 'None of the places could be found on the map. The routes are listed beside it.'}</div>
        ) : (
          <Suspense fallback={<div className="map-empty">Loading map…</div>}>
            <RouteMap lanes={lanes} />
          </Suspense>
        )}
      </div>

      <div className="map-side">
        <div>
          <h3>Route network</h3>
          <div className="map-sub">Lanes run in {periodLabel}</div>
        </div>
        {groups.length === 0 ? (
          <div className="map-sub">Routes appear here once movements with a loading and an unloading place are recorded.</div>
        ) : (
          <ul className="lane-list">
            {groups.slice(0, 8).map((g) => (
              <li key={`${g.from}>${g.to}`}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {g.from} <ArrowRight size={13} aria-hidden="true" style={{ color: 'var(--color-sidebar-muted)', flex: 'none' }} /> {g.to}
                  {unplaced(g) && !pending.length && <span className="map-sub" title="Not on the map">· not mapped</span>}
                </span>
                <span className="lane-count">{g.trips}×</span>
              </li>
            ))}
          </ul>
        )}
        {groups.length > 8 && <div className="map-sub">+{groups.length - 8} more lanes</div>}
        <div className="map-legend"><span><i /> Completed</span><span><i className="open" /> Open movement</span></div>
        <div className="map-sub">
          Places are found by searching OpenStreetMap for the place names on each movement; only the names are sent. Lines join the two places directly, as there is no GPS.
          {pending.length > 0 && <> Locating {pending.length} more {pending.length === 1 ? 'place' : 'places'}…</>}
          {!pending.length && missing.length > 0 && <> Not found on the map: {missing.join(', ')}.</>}
          {skipped > 0 && <> {skipped} {skipped === 1 ? 'movement has' : 'movements have'} no usable loading or unloading place.</>}
        </div>
      </div>
    </div>
  );
}
