import type { SortDir, SortState } from '../utils/sortRows';

interface Props<K extends string> {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  align?: 'left' | 'right';
  // The way the first click sorts this column; used for the hover hint.
  firstDir?: SortDir;
}

// A clickable table heading, styled like the sortable headings on the Movement Summary.
export function SortHeader<K extends string>({ label, sortKey, sort, onSort, align = 'left', firstDir = 'asc' }: Props<K>) {
  const dir = sort?.key === sortKey ? sort.dir : null;
  const word = (d: SortDir) => (d === 'asc' ? 'ascending' : 'descending');
  return (
    <th style={align === 'right' ? { textAlign: 'right' } : undefined} aria-sort={dir ? word(dir) : 'none'}>
      <button
        type="button" className="btn btn-ghost" onClick={() => onSort(sortKey)}
        style={{
          padding: 0, font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit',
          display: 'inline-flex', gap: 6, alignItems: 'center', flexDirection: align === 'right' ? 'row-reverse' : 'row'
        }}
        title={dir ? `Sorted ${word(dir)} — click to change` : `Not sorted — click to sort by ${label} (${word(firstDir)})`}
      >
        {label} <span aria-hidden="true">{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}</span>
      </button>
    </th>
  );
}
