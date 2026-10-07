import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapLane { from: string; to: string; a: [number, number]; b: [number, number]; trips: number; open: boolean }

// A real map (OpenStreetMap tiles) with a marker per place and a straight line
// per lane. Loaded on demand so the dashboard opens quickly without it.
export default function RouteMap({ lanes }: { lanes: MapLane[] }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const labels = useRef<{ marker: L.CircleMarker; name: string; weight: number }[]>([]);

  // Hides the name of a place that would sit on top of a busier place's name.
  // Zooming in gives them room, and they come back.
  const declutter = () => {
    const map = mapRef.current;
    if (!map) return;
    const taken: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const l of [...labels.current].sort((a, b) => b.weight - a.weight)) {
      const el = l.marker.getTooltip()?.getElement();
      if (!el) continue;
      const pt = map.latLngToContainerPoint(l.marker.getLatLng());
      const w = l.name.length * 7 + 16;
      const box = { x0: pt.x - w / 2, x1: pt.x + w / 2, y0: pt.y - 34, y1: pt.y - 8 };
      const clash = taken.some((t) => box.x0 < t.x1 && box.x1 > t.x0 && box.y0 < t.y1 && box.y1 > t.y0);
      el.style.visibility = clash ? 'hidden' : '';
      if (!clash) taken.push(box);
    }
  };

  useEffect(() => {
    if (!host.current) return;
    // one-finger drag is left to page scrolling on touch screens; pinch still zooms
    const map = L.map(host.current, { zoomControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    layer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.on('zoomend moveend', declutter);
    return () => { map.remove(); mapRef.current = null; layer.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current, group = layer.current;
    if (!map || !group) return;
    group.clearLayers();
    labels.current = [];
    const points = new Map<string, { name: string; at: [number, number]; open: boolean; weight: number }>();
    // completed lanes first so open ones are drawn on top
    for (const l of [...lanes].sort((x, y) => Number(x.open) - Number(y.open))) {
      L.polyline([l.a, l.b], {
        color: l.open ? '#EF2B1F' : '#5B6670', opacity: l.open ? 0.95 : 0.7, weight: 2 + Math.min(4, l.trips - 1), lineCap: 'round'
      }).bindTooltip(`${l.from} → ${l.to} · ${l.trips}×${l.open ? ' · open' : ''}`, { sticky: true }).addTo(group);
      for (const [name, at] of [[l.from, l.a], [l.to, l.b]] as const) {
        const prev = points.get(name.toLowerCase());
        points.set(name.toLowerCase(), { name, at, open: (prev?.open ?? false) || (l.open && name === l.to), weight: (prev?.weight ?? 0) + l.trips });
      }
    }
    for (const p of points.values()) {
      const marker = L.circleMarker(p.at, { radius: 6, color: p.open ? '#EF2B1F' : '#17212B', weight: 2, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip(p.name, { permanent: true, direction: 'top', offset: [0, -6], className: 'map-place-label' })
        .addTo(group);
      labels.current.push({ marker, name: p.name, weight: p.weight });
    }
    if (points.size) map.fitBounds(L.latLngBounds([...points.values()].map((p) => p.at)), { padding: [48, 48], maxZoom: 9 });
    declutter();
  }, [lanes]);

  return <div ref={host} className="map-leaflet" role="img" aria-label="Map of the routes run in this period" />;
}
