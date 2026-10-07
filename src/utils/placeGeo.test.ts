import { describe, expect, it } from 'vitest';
import { groupRoutes, knownPosition, lookupPlace, placeKey, readCache, rememberPlace, type KeyValueStore } from './placeGeo';

const memory = (): KeyValueStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
};
const reply = (rows: unknown) => async () => ({ ok: true, json: async () => rows });

describe('placeKey', () => {
  it('uses the town for a known place and drops site words from the rest', () => {
    expect(placeKey('Chennai Yard')).toBe('Chennai');
    expect(placeKey('Kallakurichi Cements Pvt Ltd Plant')).toBe('Kallakurichi Cements');
    expect(placeKey('  Pollachi   Godown ')).toBe('Pollachi');
  });
  it('gives Bharathi, Shree Mira and NTECL their own spot in Chennai', () => {
    expect(placeKey('Bharathi Cements')).toBe('Bharathi (Manali)');
    expect(placeKey('Bharathi Cements, Chennai')).toBe('Bharathi (Manali)');
    expect(placeKey('NTECL Vallur')).toBe('NTECL (Vallur)');
    expect(placeKey('Shree Mira Trader Yard')).toBe('Shree Mira (Guindy)');
    expect(placeKey('Chennai Port')).toBe('Chennai');
  });
  it('treats a dash or N/A as no place at all', () => {
    for (const none of ['—', '-', ' – ', 'N/A', 'na', 'nil', '.', '']) expect(placeKey(none)).toBe('');
  });
  it('keeps the whole text when stripping would leave nothing', () => {
    expect(placeKey('Depot')).toBe('Depot');
    expect(placeKey('')).toBe('');
  });
});

describe('groupRoutes', () => {
  it('groups repeat trips, treats Chennai Yard and Chennai as one place, and marks a lane open if any trip is open', () => {
    const { groups, skipped } = groupRoutes([
      { from: 'Chennai Yard', to: 'Pollachi Godown', open: false },
      { from: 'Chennai', to: 'Pollachi', open: true },
      { from: 'Pollachi', to: 'Chennai', open: false }
    ]);
    expect(skipped).toBe(0);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ from: 'Chennai', to: 'Pollachi', trips: 2, open: true });
  });
  it('draws lanes between the Chennai sites and keeps a site with no other end as a single place', () => {
    const { groups, singles, skipped } = groupRoutes([
      { from: 'Bharathi Cements', to: '—', open: false },
      { from: 'Bharathi Cements', to: 'Shree Mira Yard', open: true },
      { from: 'NTECL Vallur', to: 'Bharathi Cements', open: false },
      { from: 'Bharathi Cements', to: 'Bharathi Cements Manali', open: true }
    ]);
    expect(skipped).toBe(0);
    expect(groups.map((g) => `${g.from}>${g.to}`).sort()).toEqual(['Bharathi (Manali)>Shree Mira (Guindy)', 'NTECL (Vallur)>Bharathi (Manali)']);
    expect(singles).toEqual([{ place: 'Bharathi (Manali)', trips: 2, open: true }]);
  });
  it('marks a place used at only one end (open movement, no unloading place yet) instead of dropping it', () => {
    const { groups, singles, skipped } = groupRoutes([
      { from: 'Hosur Warehouse', to: '', open: true },
      { from: '', to: 'Madurai', open: false },
      { from: 'Chennai Port', to: 'Chennai Yard', open: false }
    ]);
    expect(groups).toEqual([]);
    expect(singles.map((x) => x.place).sort()).toEqual(['Chennai', 'Hosur', 'Madurai']);
    expect(skipped).toBe(0);
  });
  it('skips only a movement with no usable place at all', () => {
    const { groups, singles, skipped } = groupRoutes([
      { from: '', to: '—', open: false },
      { from: ' - ', to: 'N/A', open: false },
      { from: 'Madurai', to: 'Tuticorin', open: false }
    ]);
    expect(groups).toHaveLength(1);
    expect(singles).toEqual([]);
    expect(skipped).toBe(2);
  });
});

describe('lookupPlace', () => {
  it('returns the first result', async () => {
    expect(await lookupPlace('Pollachi', reply([{ lat: '10.66', lon: '77.01' }]))).toEqual({ lat: 10.66, lon: 77.01 });
  });
  it('returns null when nothing is found, and does not guess', async () => {
    expect(await lookupPlace('Nowhere', reply([]))).toBeNull();
  });
  it('tries again without the site words', async () => {
    const asked: string[] = [];
    const found = await lookupPlace('Pollachi Godown', async (u) => {
      asked.push(decodeURIComponent(u.split('q=')[1]!));
      return { ok: true, json: async () => (asked.length === 1 ? [] : [{ lat: '10.66', lon: '77.01' }]) };
    });
    expect(asked).toEqual(['Pollachi Godown, India', 'Pollachi, India']);
    expect(found).toEqual({ lat: 10.66, lon: 77.01 });
  });
  it('throws on a failed search so it is never remembered as "not found"', async () => {
    await expect(lookupPlace('Pollachi', async () => ({ ok: false, json: async () => [] }))).rejects.toThrow();
  });
});

describe('remembered places', () => {
  it('knows built-in towns without any search', () => {
    expect(knownPosition('Hosur', {})).toMatchObject({ lat: expect.any(Number) });
  });
  it('remembers a found place and a miss, and retries a miss after a week', () => {
    const store = memory(); const t0 = 1_000_000;
    rememberPlace(store, 'Pollachi', { lat: 10.66, lon: 77.01 }, t0);
    rememberPlace(store, 'Nowhere', null, t0);
    const cache = readCache(store);
    expect(knownPosition('pollachi', cache, t0 + 1)).toEqual({ lat: 10.66, lon: 77.01 });
    expect(knownPosition('Nowhere', cache, t0 + 1000)).toBeNull();
    expect(knownPosition('Nowhere', cache, t0 + 8 * 86_400_000)).toBeUndefined();
    expect(knownPosition('Unseen', cache)).toBeUndefined();
  });
  it('copes with storage that is missing or holds junk', () => {
    expect(readCache(null)).toEqual({});
    expect(readCache({ getItem: () => 'not json', setItem: () => {} })).toEqual({});
  });
});
