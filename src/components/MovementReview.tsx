import { useEffect, useRef } from 'react';
import type { TripDocument, TripExpenseLine, TripFormState } from '../types';
import { TRIP_EXPENSE_LABEL } from '../data/mockData';
import { formatDisplayDate } from '../lib/api';
import { rupees, toNumber } from '../utils/calc';

type Action = 'create' | 'start' | 'save' | 'complete';

interface Props {
  action: Action;
  form: TripFormState;
  // The saved values when editing, so what changed can be flagged; null for a new movement.
  original: TripFormState | null;
  lines: TripExpenseLine[];
  originalLines: TripExpenseLine[];
  documents: TripDocument[];
  originalDocuments: TripDocument[];
  showFinancials: boolean;
  wasCompleted: boolean;
  totals: { km: number; expense: number; profit: number };
  onConfirm: () => void;
  onBack: () => void;
  // Set when the review is shown as a dialog over the Trip Log rather than inside the form.
  standalone?: {
    // Things still missing that stop the movement being completed.
    blockers: string[];
    onEdit: () => void;
    busy: boolean;
  };
}

type FieldKind = 'date' | 'text' | 'tons' | 'km' | 'money';
const FIELDS: { key: keyof TripFormState; label: string; kind: FieldKind; financial?: boolean }[] = [
  { key: 'loadDate', label: 'Loading date', kind: 'date' },
  { key: 'unloadDate', label: 'Unloading date', kind: 'date' },
  { key: 'vehicle', label: 'Vehicle', kind: 'text' },
  { key: 'driver', label: 'Driver', kind: 'text' },
  { key: 'waybillNo', label: 'Invoice no.', kind: 'text' },
  { key: 'itemNo', label: 'Item no.', kind: 'text' },
  { key: 'from', label: 'Loading location', kind: 'text' },
  { key: 'to', label: 'Unloading location', kind: 'text' },
  { key: 'tons', label: 'Loading weight', kind: 'tons' },
  { key: 'odoStart', label: 'Odometer start', kind: 'km' },
  { key: 'odoEnd', label: 'Odometer end', kind: 'km' },
  { key: 'revenue', label: 'Revenue', kind: 'money', financial: true },
  { key: 'remarks', label: 'Remarks', kind: 'text' }
];

function show(kind: FieldKind, v: string): string {
  if (kind === 'money') return rupees(toNumber(v));
  if (!v || !v.trim()) return '—';
  if (kind === 'date') return formatDisplayDate(v);
  if (kind === 'tons') return `${v} t`;
  if (kind === 'km') return `${Number(v).toLocaleString('en-IN')} km`;
  return v;
}

// New lines carry an ISO date, saved ones already a display date.
const lineDate = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? formatDisplayDate(d) : d);

function lineDetail(l: TripExpenseLine): string {
  if (l.litres != null && l.ratePerLitre != null) return `${l.litres} L × ₹${l.ratePerLitre}`;
  if (l.litres != null) return `${l.litres} L`;
  return l.details ?? '—';
}

const TITLE: Record<Action, string> = {
  create: 'Review before adding this movement',
  start: 'Review before starting this movement',
  save: 'Review before saving',
  complete: 'Review before completing this movement'
};

const NOTE: Partial<Record<Action, string>> = {
  start: 'This saves as an open movement — you or documentation can keep adding entries and complete it later.',
  create: 'This records the movement as complete — a driver can no longer edit or delete it.',
  complete: 'This marks the movement complete and locks it — a driver can no longer edit or delete it.'
};

const muted = { color: 'var(--color-neutral-700)' } as const;
const changedColor = 'var(--color-accent-700)';

export function MovementReview({ action, form, original, lines, originalLines, documents, originalDocuments, showFinancials, wasCompleted, totals, onConfirm, onBack, standalone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!standalone) rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [standalone]);

  const editing = original !== null;
  const fields = FIELDS.filter((f) => showFinancials || !f.financial);
  const changedCount = editing ? fields.filter((f) => form[f.key] !== original[f.key]).length : 0;

  const originalLineIds = new Set(originalLines.map((l) => l.id));
  const newLineIds = new Set(lines.filter((l) => !originalLineIds.has(l.id)).map((l) => l.id));
  const removedLines = originalLines.filter((l) => !lines.some((x) => x.id === l.id));
  const originalDocIds = new Set(originalDocuments.map((d) => d.id));
  const removedDocs = originalDocuments.filter((d) => !documents.some((x) => x.id === d.id));
  const lineChanges = newLineIds.size + removedLines.length;
  const docChanges = documents.filter((d) => !originalDocIds.has(d.id)).length + removedDocs.length;
  const anyChange = changedCount + lineChanges + docChanges > 0;

  const tag = (text: string, color: string) => (
    <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color, border: `1px solid ${color}`, padding: '0 5px', marginLeft: 6 }}>{text}</span>
  );

  return (
    <div ref={rootRef} style={{ border: '2px solid var(--color-text)', marginTop: standalone ? 0 : 16, background: 'var(--color-bg)' }}>
      <div style={{ background: 'var(--color-text)', color: 'var(--color-bg)', padding: '8px 12px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {TITLE[action]}
      </div>

      {editing && (
        <div style={{ padding: '10px 12px', fontSize: 12, borderBottom: '1px solid var(--color-neutral-300)', ...(anyChange ? {} : muted) }}>
          {anyChange
            ? <>Changes from the saved version are marked in <span style={{ color: changedColor, fontWeight: 700 }}>red</span>, with the previous value beneath.</>
            : 'Nothing has been changed from the saved version.'}
        </div>
      )}

      <dl style={{ margin: 0, padding: '4px 12px', fontSize: 13 }}>
        {fields.map((f) => {
          const changed = editing && form[f.key] !== original[f.key];
          return (
            <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
              <dt style={muted}>{f.label}{changed && tag('Changed', changedColor)}</dt>
              <dd style={{ margin: 0, textAlign: 'right', overflowWrap: 'anywhere' }}>
                <span style={{ fontWeight: 600, color: changed ? changedColor : undefined }}>{show(f.kind, form[f.key])}</span>
                {changed && (
                  <div style={{ fontSize: 11, ...muted, fontWeight: 400 }}>was {show(f.kind, original[f.key])}</div>
                )}
              </dd>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
          <dt style={muted}>Distance</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{totals.km.toLocaleString('en-IN')} km</dd>
        </div>
      </dl>

      <div style={{ padding: '10px 12px 4px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', ...muted }}>
        Fuel &amp; expense entries ({lines.length})
      </div>
      {lines.length === 0 && removedLines.length === 0 ? (
        <div style={{ padding: '0 12px 10px', fontSize: 13, ...muted }}>None.</div>
      ) : (
        <div className="scroll-x" style={{ padding: '0 12px 8px' }}>
          <table className="table" style={{ minWidth: 480, fontSize: 13 }}>
            <thead>
              <tr><th>Date</th><th>Kind</th><th>Detail</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const isNew = editing && newLineIds.has(l.id);
                return (
                  <tr key={l.id} style={isNew ? { color: changedColor } : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>{lineDate(l.date)}</td>
                    <td>{TRIP_EXPENSE_LABEL[l.kind]}{isNew && tag('New', changedColor)}</td>
                    <td>{lineDetail(l)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{rupees(l.amount)}</td>
                  </tr>
                );
              })}
              {removedLines.map((l) => (
                <tr key={l.id} style={{ color: changedColor, textDecoration: 'line-through' }}>
                  <td style={{ whiteSpace: 'nowrap' }}>{lineDate(l.date)}</td>
                  <td>{TRIP_EXPENSE_LABEL[l.kind]}<span style={{ textDecoration: 'none', display: 'inline-block' }}>{tag('Removed', changedColor)}</span></td>
                  <td>{lineDetail(l)}</td>
                  <td style={{ textAlign: 'right' }}>{rupees(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ padding: '6px 12px 4px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', ...muted }}>
        Supporting documents ({documents.length})
      </div>
      {documents.length === 0 && removedDocs.length === 0 ? (
        <div style={{ padding: '0 12px 10px', fontSize: 13, ...muted }}>None.</div>
      ) : (
        <ul style={{ margin: 0, padding: '0 12px 10px 28px', fontSize: 13 }}>
          {documents.map((d) => {
            const isNew = editing && !originalDocIds.has(d.id);
            return <li key={d.id} style={isNew ? { color: changedColor } : undefined}>{d.filename}{isNew && tag('New', changedColor)}</li>;
          })}
          {removedDocs.map((d) => (
            <li key={d.id} style={{ color: changedColor }}><span style={{ textDecoration: 'line-through' }}>{d.filename}</span>{tag('Removed', changedColor)}</li>
          ))}
        </ul>
      )}

      <div style={{ borderTop: '1px solid var(--color-neutral-300)', padding: '10px 12px', display: 'grid', gap: 4, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={muted}>Total trip expense</span><span style={{ fontWeight: 700 }}>{rupees(totals.expense)}</span></div>
        {showFinancials && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={muted}>Profit</span>
            <span style={{ fontWeight: 700, color: totals.profit >= 0 ? 'var(--color-profit)' : 'var(--color-accent-700)' }}>{rupees(totals.profit)}</span>
          </div>
        )}
        {NOTE[action] && !wasCompleted && <div style={{ ...muted, marginTop: 6 }}>{NOTE[action]}</div>}
        {wasCompleted && <div style={{ ...muted, marginTop: 6 }}>This movement is already complete. Saving replaces what is recorded, and the change is kept in the audit log.</div>}
      </div>

      {standalone && standalone.blockers.length > 0 && (
        <div role="alert" style={{ borderTop: '1px solid var(--color-neutral-300)', padding: '10px 12px', fontSize: 13, color: changedColor, display: 'grid', gap: 2 }}>
          <strong>This movement can't be completed yet:</strong>
          {standalone.blockers.map((b) => <div key={b}>• {b}</div>)}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 12, borderTop: '1px solid var(--color-neutral-300)' }}>
        {standalone && standalone.blockers.length > 0 ? (
          <button type="button" className="btn btn-primary" onClick={standalone.onEdit}>Edit movement</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={standalone?.busy} onClick={onConfirm}>
            {standalone?.busy ? 'Completing…' : action === 'complete' ? 'Confirm & complete' : 'Confirm & save'}
          </button>
        )}
        <button type="button" className="btn btn-ghost" disabled={standalone?.busy} onClick={onBack}>{standalone ? 'Cancel' : 'Back to edit'}</button>
      </div>
    </div>
  );
}
