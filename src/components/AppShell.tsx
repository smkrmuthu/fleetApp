import type { ReactNode } from 'react';
import type { AppNotification, Role, TabId } from '../types';
import { ROLE_NOTE, ROLE_TABS, TAB_LABELS } from '../data/mockData';
import { NotificationBell } from './NotificationBell';
import logoMark from '../assets/logo-mark-red.png';

interface Props {
  role: Role;
  userName: string;
  tab: TabId;
  onRoleChange: (r: Role) => void;
  onTabChange: (t: TabId) => void;
  onSignOut: () => void;
  notifications: AppNotification[];
  onOpenNotification: (n: AppNotification) => void;
  onMarkAllNotificationsRead: () => void;
  children: ReactNode;
}

const ALL_ROLES: Role[] = ['Driver', 'Office', 'Manager'];

export function AppShell({
  role, userName, tab, onRoleChange, onTabChange, onSignOut, notifications, onOpenNotification, onMarkAllNotificationsRead, children
}: Props) {
  const tabs = ROLE_TABS[role];

  return (
    <>
      <header className="app-shell-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, borderBottom: '2px solid var(--color-divider)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={logoMark} alt="" style={{ height: 28, width: 'auto' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>Fleet Ledger</div>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>Goods movement &amp; expense log</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>Signed in as</span>
            <div style={{ display: 'flex', border: '2px solid var(--color-text)' }}>
              {ALL_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRoleChange(r)}
                  style={{
                    appearance: 'none', border: 0, borderLeft: '2px solid var(--color-text)', background: r === role ? 'var(--color-accent)' : 'transparent',
                    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '7px 14px', cursor: 'pointer', color: r === role ? '#fff' : 'var(--color-text)'
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {role !== 'Driver' && (
              <NotificationBell notifications={notifications} onOpen={onOpenNotification} onMarkAllRead={onMarkAllNotificationsRead} />
            )}
            <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
              <div style={{ fontWeight: 600 }}>{userName} · {role}</div>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>Meridian Logistics · Chennai</div>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-divider)', padding: '0 12px', overflowX: 'auto' }}>
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            style={{
              appearance: 'none', background: 'transparent', border: 0, padding: '14px 14px 12px',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
              color: t === tab ? 'var(--color-text)' : 'var(--color-neutral-700)', cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative'
            }}
          >
            {TAB_LABELS[t]}
            {t === tab && (
              <span style={{ position: 'absolute', left: 14, right: 14, bottom: -2, height: 4, background: 'var(--color-accent)' }} />
            )}
          </button>
        ))}
      </nav>

      <main className="app-shell-main">{children}</main>

      <footer className="app-shell-bar" style={{ borderTop: '2px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-neutral-700)' }}>
        <span>Fleet Ledger — prototype</span>
        <span>{ROLE_NOTE[role]}</span>
      </footer>
    </>
  );
}
