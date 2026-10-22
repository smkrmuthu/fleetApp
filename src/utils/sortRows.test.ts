import { describe, expect, it } from 'vitest';
import { nextSort, sortRows, type SortState } from './sortRows';

type Row = { id: string; amt: number | null; name: string };
const rows: Row[] = [
  { id: 'a', amt: 50, name: 'Truck 10' },
  { id: 'b', amt: null, name: 'Truck 2' },
  { id: 'c', amt: 200, name: '—' },
  { id: 'd', amt: 50, name: 'truck 1' }
];
const value = (r: Row, k: 'amt' | 'name') => r[k];
const ids = (rs: Row[]) => rs.map((r) => r.id).join('');

describe('sortRows', () => {
  it('leaves the order alone when nothing is picked', () => {
    expect(sortRows(rows, null, value)).toBe(rows);
  });
  it('sorts numbers both ways, empty values always last, ties keep their order', () => {
    expect(ids(sortRows(rows, { key: 'amt', dir: 'desc' }, value))).toBe('cadb');
    expect(ids(sortRows(rows, { key: 'amt', dir: 'asc' }, value))).toBe('adcb');
  });
  it('sorts text naturally and ignoring case, with "—" last', () => {
    expect(ids(sortRows(rows, { key: 'name', dir: 'asc' }, value))).toBe('dbac');
    expect(ids(sortRows(rows, { key: 'name', dir: 'desc' }, value))).toBe('abdc');
  });
  it('does not change the list it was given', () => {
    const copy = [...rows];
    sortRows(rows, { key: 'amt', dir: 'desc' }, value);
    expect(rows).toEqual(copy);
  });
});

describe('nextSort', () => {
  const fallback: SortState<'amt' | 'name'> = null;
  it('goes first direction, then reversed, then back to the default', () => {
    const s1 = nextSort<'amt' | 'name'>(null, 'amt', 'desc', fallback);
    expect(s1).toEqual({ key: 'amt', dir: 'desc' });
    const s2 = nextSort(s1, 'amt', 'desc', fallback);
    expect(s2).toEqual({ key: 'amt', dir: 'asc' });
    expect(nextSort(s2, 'amt', 'desc', fallback)).toBe(fallback);
  });
  it('starts a new column on its own first direction', () => {
    expect(nextSort({ key: 'amt', dir: 'asc' }, 'name', 'asc', fallback)).toEqual({ key: 'name', dir: 'asc' });
  });
  it('can fall back to a default sort such as oldest first', () => {
    const def: SortState<'date'> = { key: 'date', dir: 'asc' };
    expect(nextSort({ key: 'date', dir: 'desc' }, 'date', 'asc', def)).toBe(def);
  });
});
