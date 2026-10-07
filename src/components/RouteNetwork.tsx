import { lazy, Suspense, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { groupRoutes } from '../utils/placeGeo';
import { StatusBadge } from './ui';
import { usePlacePositions } from './usePlacePositions';
import type { MapLane, MapSpot } from './RouteMap';

const RouteMap = lazy(() => import('./RouteMap'));

// The lanes trucks ran in the period, on a map (OpenStreetMap) with the same
// lanes listed beside it. Positions come from the place names on each
// movement, and lines join the two places directly: there is no GPS, so they
// are not the roads driven. A place that cannot be found stays in the list.
export function RouteNetwork({ trips, periodLabel }: { trips: { from: string; to: string; stops?: string[]; open: boolean }[]; periodLabel: string }) {
  // The dashboard hands over a fresh array on every render; key on the content so the map is not redrawn (and re-zoomed) each time.
  const tripSig = trips.map((t) => `${t.from}\u0001${(t.stops ?? []).join('\u0003')}\u0001${t.to}\u0001${t.open ? 1 : 0}`).join('\u0002');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { groups, singles, skipped } = useMemo(() => groupRoutes(trips), [tripSig]);
  const keys = useMemo(() => [...new Set([...groups.flatMap((g) => g.path), ...singles.map((s) => s.place)])], [groups, singles]);
  const { positions, pending, missing } = usePlacePositions(keys);

  // Each lane is drawn through the places that have a position, in order. A lane
  // with only one placed place is marked instead; the places not found are noted.
  const fresh: MapLane[] = [];
  const freshSpots: MapSpot[] = [];
  const spotAt = new Map<string, MapSpot>();
  const addSpot = (name: string, at: [number, number], trips: number, open: boolean) => {
    const prev = spotAt.get(name.toLowerCase());
    if (prev) { prev.trips += trips; prev.open = prev.open || open; return; }
    const spot = { name, at, trips, open };
    spotAt.set(name.toLowerCase(), spot);
    freshSpots.push(spot);
  };
  for (const g of groups) {
    const placed = g.path.flatMap((name) => {
      const p = positions.get(name.toLowerCase());
      return p ? [{ name, at: [p.lat, p.lon] as [number, number] }] : [];
    });
    if (placed.length >= 2) fresh.push({ names: placed.map((p) => p.name), points: placed.map((p) => p.at), trips: g.trips, open: g.open });
    else if (placed.length === 1) addSpot(placed[0]!.name, placed[0]!.at, g.trips, g.open);
  }
  for (const s of singles) {
    const p = positions.get(s.place.toLowerCase());
    if (p) addSpot(s.place, [p.lat, p.lon], s.trips, s.open);
  }
  const spotSig = JSON.stringify(freshSpots);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const spots = useMemo(() => freshSpots, [spotSig]);
  const laneSig = JSON.stringify(fresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lanes = useMemo(() => fresh, [laneSig]);

  const unplaced = (g: { path: string[] }) => g.path.filter((p) => positions.has(p.toLowerCase())).length < 2;

  return (
    <div className="card map-card">
      <div className="map-canvas">
        <div className="map-tag"><StatusBadge>Straight lines · not road routes</StatusBadge></div>
        {groups.length === 0 && singles.length === 0 ? (
          <div className="map-empty">No routes to show for this period</div>
        ) : lanes.length === 0 && spots.length === 0 ? (
          <div className="map-empty">{pending.length ? `Locating ${pending.length} ${pending.length === 1 ? 'place' : 'places'}…` : 'None of the places could be found on the map. The routes are listed beside it.'}</div>
        ) : (
          <Suspense fallback={<div className="map-empty">Loading map…</div>}>
            <RouteMap lanes={lanes} spots={spots} />
          </Suspense>
        )}
      </div>

      <div className="map-side">
        <div>
          <h3>Route network</h3>
          <div className="map-sub">Lanes run in {periodLabel}</div>
        </div>
        {groups.length === 0 && singles.length === 0 ? (
          <div className="map-sub">Routes appear here once movements with a loading and an unloading place are recorded.</div>
        ) : (
          <ul className="lane-list">
            {groups.slice(0, 8).map((g) => (
              <li key={g.path.join('>')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 6px', minWidth: 0 }}>
                  {g.path.map((place, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {i > 0 && <ArrowRight size={13} aria-hidden="true" style={{ color: 'var(--color-sidebar-muted)', flex: 'none' }} />}
                      {place}
                    </span>
                  ))}
                  {unplaced(g) && !pending.length && <span className="map-sub" title="Not on the map">· not mapped</span>}
                </span>
                <span className="lane-count">{g.trips}×</span>
              </li>
            ))}
          </ul>
        )}
        {groups.length > 8 && <div className="map-sub">+{groups.length - 8} more lanes</div>}
        {singles.length > 0 && (
          <ul className="lane-list">
            {singles.slice(0, 6).map((s) => (
              <li key={s.place}>
                <span style={{ minWidth: 0 }}>{s.place} <span className="map-sub">· one place only</span></span>
                <span className="lane-count">{s.trips}×</span>
              </li>
            ))}
          </ul>
        )}
        <div className="map-legend"><span><i /> Completed</span><span><i className="open" /> Open movement</span></div>
        {singles.length > 0 && <div className="map-sub">"One place only" means the other end is not recorded yet (for example an open movement before its unloading place is entered) or both ends are the same place, so it is marked on the map without a line.</div>}
        <div className="map-sub">
          Places are found by searching OpenStreetMap for the place names on each movement; only the names are sent. Lines join the loading place, the stops in order and the unloading place directly, as there is no GPS.
          {pending.length > 0 && <> Locating {pending.length} more {pending.length === 1 ? 'place' : 'places'}…</>}
          {!pending.length && missing.length > 0 && <> Not found on the map: {missing.join(', ')}.</>}
          {skipped > 0 && <> {skipped} {skipped === 1 ? 'movement has' : 'movements have'} no loading or unloading place recorded.</>}
        </div>
      </div>
    </div>
  );
}
