import { describe, expect, it } from 'vitest';
import { groupRoutes, knownPosition, lookupPlace, placeKey, readCache, rememberPlace, searchArea, type KeyValueStore } from './placeGeo';

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
    expect(groups[0]).toMatchObject({ path: ['Chennai', 'Pollachi'], trips: 2, open: true });
  });
  it('draws lanes between the Chennai sites and keeps a site with no other end as a single place', () => {
    const { groups, singles, skipped } = groupRoutes([
      { from: 'Bharathi Cements', to: '—', open: false },
      { from: 'Bharathi Cements', to: 'Shree Mira Yard', open: true },
      { from: 'NTECL Vallur', to: 'Bharathi Cements', open: false },
      { from: 'Bharathi Cements', to: 'Bharathi Cements Manali', open: true }
    ]);
    expect(skipped).toBe(0);
    expect(groups.map((g) => g.path.join('>')).sort()).toEqual(['Bharathi (Manali)>Shree Mira (Guindy)', 'NTECL (Vallur)>Bharathi (Manali)']);
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
  it('runs a lane through the stops, in order, and keeps movements with the same path together', () => {
    const { groups, singles, skipped } = groupRoutes([
      { from: 'Chennai Yard', to: 'Madurai', stops: ['Salem', 'Trichy Depot'], open: false },
      { from: 'Chennai', to: 'Madurai', stops: ['Salem Godown', 'Trichy'], open: true },
      { from: 'Chennai', to: 'Madurai', open: false }
    ]);
    expect(skipped).toBe(0);
    expect(singles).toEqual([]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ path: ['Chennai', 'Salem', 'Trichy', 'Madurai'], trips: 2, open: true });
    expect(groups[1]).toMatchObject({ path: ['Chennai', 'Madurai'], trips: 1 });
  });
  it('draws an open movement that has stops but no unloading place yet, and ignores blank or repeated stops', () => {
    const { groups } = groupRoutes([
      { from: 'Chennai', to: '—', stops: ['', 'Hosur', 'Hosur Warehouse', ' - '], open: true }
    ]);
    expect(groups).toEqual([{ path: ['Chennai', 'Hosur'], trips: 1, open: true }]);
  });
  it('treats a movement whose stops all sit at its one place as a single place', () => {
    const { groups, singles } = groupRoutes([{ from: 'Hosur', to: 'Hosur Yard', stops: ['Hosur Warehouse'], open: false }]);
    expect(groups).toEqual([]);
    expect(singles).toEqual([{ place: 'Hosur', trips: 1, open: false }]);
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

describe('searchArea', () => {
  it('uses the area after the customer name', () => {
    expect(searchArea('KMR - KUNDRATHUR')).toBe('KUNDRATHUR');
    expect(searchArea('Aarov buildmart \u2013 kundrathur')).toBe('kundrathur');
    expect(searchArea('CONCRETE OEM - SUNCITY')).toBe('SUNCITY');
    expect(searchArea('WORKSHOP STOP')).toBe('WORKSHOP STOP');
    expect(searchArea('Pollachi')).toBe('Pollachi');
  });
});

describe('lookupPlace', () => {
  const noPause = async () => {};
  it('searches the area inside Chennai first and returns the result', async () => {
    const asked: string[] = [];
    const found = await lookupPlace('KMR - KUNDRATHUR', async (u) => {
      asked.push(decodeURIComponent(u));
      return { ok: true, json: async () => [{ lat: '13.02', lon: '80.14', display_name: 'Kundrathur, Chennai, Tamil Nadu' }] };
    }, noPause);
    expect(found).toEqual({ lat: 13.02, lon: 80.14 });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('q=KUNDRATHUR, Chennai');
    expect(asked[0]).toContain('bounded=1');
    expect(asked[0]).toContain('viewbox=79.85,13.55,80.45,12.65');
  });
  it('returns null when nothing is found, and does not guess', async () => {
    expect(await lookupPlace('Nowhere', reply([]), noPause)).toBeNull();
  });
  it('tries without the site words, then the wider region', async () => {
    const asked: string[] = [];
    const found = await lookupPlace('Pollachi Godown', async (u) => {
      asked.push(decodeURIComponent(u.split('q=')[1]!));
      return { ok: true, json: async () => (asked.length < 3 ? [] : [{ lat: '10.66', lon: '77.01', display_name: 'Pollachi, Coimbatore, Tamil Nadu' }]) };
    }, noPause);
    expect(asked).toEqual(['Pollachi Godown, Chennai', 'Pollachi, Chennai', 'Pollachi Godown, Tamil Nadu']);
    expect(found).toEqual({ lat: 10.66, lon: 77.01 });
  });
  it('refuses a wider-region result that is in another state', async () => {
    const kerala = reply([{ lat: '10.31', lon: '76.21', display_name: 'workshop stop, Thrissur, Kerala' }]);
    expect(await lookupPlace('WORKSHOP STOP', async (u) => (u.includes('Tamil%20Nadu') ? kerala() : { ok: true, json: async () => [] }), noPause)).toBeNull();
  });
  it('waits between searches', async () => {
    let pauses = 0;
    await lookupPlace('Nowhere Yard', reply([]), async () => { pauses++; });
    expect(pauses).toBe(2);
  });
  it('throws on a failed search so it is never remembered as "not found"', async () => {
    await expect(lookupPlace('Pollachi', async () => ({ ok: false, json: async () => [] }), noPause)).rejects.toThrow();
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
