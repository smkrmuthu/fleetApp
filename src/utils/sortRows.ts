export type SortDir = 'asc' | 'desc';
export type SortState<K extends string> = { key: K; dir: SortDir } | null;

const isEmpty = (v: number | string | null | undefined) => v === null || v === undefined || v === '' || v === '—' || (typeof v === 'number' && Number.isNaN(v));

// Orders rows by the picked column. Empty values ("—", blank) always go last whichever way
// the column is sorted, and rows that compare equal keep the order they came in.
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  valueOf: (row: T, key: K) => number | string | null | undefined
): T[] {
  if (!sort) return rows;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = valueOf(a, sort.key);
    const bv = valueOf(b, sort.key);
    const ae = isEmpty(av);
    const be = isEmpty(bv);
    if (ae || be) return ae && be ? 0 : ae ? 1 : -1;
    if (typeof av === 'number' && typeof bv === 'number') return sign * (av - bv);
    return sign * String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
  });
}

// The next state when a column heading is clicked: first click sorts the way that column
// usually wants (largest first for money and counts, A to Z for names, oldest first for
// dates), the second click reverses it, the third goes back to the page's default order.
export function nextSort<K extends string>(prev: SortState<K>, key: K, firstDir: SortDir, fallback: SortState<K>): SortState<K> {
  if (!prev || prev.key !== key) return { key, dir: firstDir };
  if (prev.dir === firstDir) return { key, dir: firstDir === 'asc' ? 'desc' : 'asc' };
  return fallback;
}
