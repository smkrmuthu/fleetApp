import { findTown } from './routeGeo';

// Turns the free-text places on movements ("Bharathi Cements Yard") into map
// positions. Common towns come from the built-in list; the rest are searched
// on OpenStreetMap once and remembered on this device. Nothing is guessed: a
// place that cannot be found stays off the map and is listed instead.

export interface LatLon { lat: number; lon: number }

// Words that describe the kind of site, not where it is. Searching for them
// finds nothing, so a second search is made without them.
const SITE_WORDS = /\b(yard|warehouse|godown|factory|plant|depot|icd|hub|terminal|works|unit|company|co|ltd|pvt|private|limited|stockyard|siding|cfs|port)\b\.?/gi;

export function cleanPlace(place: string): string {
  return place.replace(/\s+/g, ' ').trim();
}

// The name a place is grouped and searched under: a known town's name, or the
// place with its site words removed ("Chennai Yard" and "Chennai" are one place).
// "-", "—", "N/A" and the like are what people type when there is no place.
const NO_PLACE = /^[\s\-\u2010-\u2015.?_/]*$|^(n\/?a|nil|none|null|tbd|na)$/i;

export function placeKey(place: string): string {
  const clean = cleanPlace(place);
  if (!clean || NO_PLACE.test(clean)) return '';
  const town = findTown(clean);
  if (town) return town.name;
  const stripped = cleanPlace(clean.replace(SITE_WORDS, ' ').replace(/[,;()]+/g, ' '));
  return stripped || clean;
}

export interface RouteGroup { from: string; to: string; trips: number; open: boolean }

// Groups movements into lanes (one per from → to pair of places). Movements
// with a missing place, or that start and end in the same place, are counted
// in `skipped`.
export function groupRoutes(trips: { from: string; to: string; open: boolean }[]): { groups: RouteGroup[]; skipped: number } {
  const byKey = new Map<string, RouteGroup>();
  let skipped = 0;
  for (const t of trips) {
    const from = placeKey(t.from);
    const to = placeKey(t.to);
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) { skipped++; continue; }
    const key = `${from.toLowerCase()}>${to.toLowerCase()}`;
    const g = byKey.get(key);
    if (g) { g.trips++; g.open = g.open || t.open; }
    else byKey.set(key, { from, to, trips: 1, open: t.open });
  }
  return { groups: [...byKey.values()].sort((a, b) => b.trips - a.trips), skipped };
}

// --- remembered lookups ---------------------------------------------------

const CACHE_KEY = 'fleet_place_geo_v1';
const MISS_RETRY_MS = 7 * 86_400_000;

interface CacheEntry { lat: number | null; lon: number | null; at: number }
export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void }

export function readCache(store: KeyValueStore | null): Record<string, CacheEntry> {
  try {
    const raw = store?.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function writeCache(store: KeyValueStore | null, cache: Record<string, CacheEntry>) {
  try { store?.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* storage full or blocked: lookups just repeat */ }
}

// What is already known about a place without any network: a built-in town, a
// remembered position, a remembered "not found" (until it is worth retrying),
// or undefined when it still has to be searched.
export function knownPosition(key: string, cache: Record<string, CacheEntry>, now = Date.now()): LatLon | null | undefined {
  const town = findTown(key);
  if (town) return { lat: town.lat, lon: town.lon };
  const hit = cache[key.toLowerCase()];
  if (!hit) return undefined;
  if (hit.lat != null && hit.lon != null) return { lat: hit.lat, lon: hit.lon };
  return now - hit.at < MISS_RETRY_MS ? null : undefined;
}

// --- OpenStreetMap search -------------------------------------------------

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
// OpenStreetMap's usage policy allows about one search a second.
export const SEARCH_GAP_MS = 1100;

type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

async function search(q: string, fetchImpl: FetchLike): Promise<LatLon | null> {
  const url = `${SEARCH_URL}?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error('search failed');
  const rows = (await res.json()) as { lat?: string; lon?: string }[];
  const first = Array.isArray(rows) ? rows[0] : undefined;
  const lat = first?.lat != null ? Number(first.lat) : NaN;
  const lon = first?.lon != null ? Number(first.lon) : NaN;
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

// Searches the place as written; if nothing comes back, once more without the
// site words. Returns null for "not found" and throws when the search itself
// failed (offline, blocked), so a failure is never remembered as "not found".
export async function lookupPlace(key: string, fetchImpl: FetchLike = (u) => fetch(u, { headers: { Accept: 'application/json' } })): Promise<LatLon | null> {
  const found = await search(`${key}, India`, fetchImpl);
  if (found) return found;
  const bare = cleanPlace(key.replace(SITE_WORDS, ' '));
  return bare && bare.toLowerCase() !== key.toLowerCase() ? search(`${bare}, India`, fetchImpl) : null;
}

export function rememberPlace(store: KeyValueStore | null, key: string, pos: LatLon | null, now = Date.now()) {
  const cache = readCache(store);
  cache[key.toLowerCase()] = { lat: pos?.lat ?? null, lon: pos?.lon ?? null, at: now };
  writeCache(store, cache);
}

export function browserStore(): KeyValueStore | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
