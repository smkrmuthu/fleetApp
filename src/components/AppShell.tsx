import { useEffect, useState, type ReactNode } from 'react';
import {
  ChartColumn, ClipboardList, Database, FileText, Fuel, LayoutDashboard, LogOut, Menu, Receipt,
  SlidersHorizontal, Truck, Users, X, type LucideIcon
} from 'lucide-react';
import type { AppNotification, Role, TabId } from '../types';
import { ROLE_TABS, TAB_LABELS } from '../data/mockData';
import { NotificationBell } from './NotificationBell';
import { BrandMark } from './Brand';

interface Props {
  role: Role;
  userName: string;
  tab: TabId;
  onTabChange: (t: TabId) => void;
  onSignOut: () => void;
  notifications: AppNotification[];
  onOpenNotification: (n: AppNotification) => void;
  onMarkAllNotificationsRead: () => void;
  children: ReactNode;
}

interface NavSection { label?: string; items: TabId[] }

// Where each screen sits in the sidebar. Screens a role can't open are left out.
const NAV: NavSection[] = [
  { items: ['dashboard'] },
  { label: 'Operations', items: ['addtrip', 'triplog', 'fuel'] },
  { label: 'Reports', items: ['summary', 'expenses', 'report'] },
  { label: 'Management', items: ['people', 'master', 'schema'] }
];

const ICONS: Partial<Record<TabId, LucideIcon>> = {
  dashboard: LayoutDashboard,
  addtrip: Truck,
  triplog: ClipboardList,
  fuel: Fuel,
  summary: ChartColumn,
  expenses: Receipt,
  report: FileText,
  people: Users,
  master: SlidersHorizontal,
  schema: Database
};

function sectionOf(tab: TabId): string | undefined {
  return NAV.find((s) => s.items.includes(tab))?.label;
}

function initials(name: string): string {
  return name.split(/[\s.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
}

function Sidebar({ role, tab, onSelect, onClose }: {
  role: Role;
  tab: TabId;
  onSelect: (t: TabId) => void;
  onClose: () => void;
}) {
  const allowed = ROLE_TABS[role];

  const item = (t: TabId) => {
    const Icon = ICONS[t];
    const label = TAB_LABELS[t];
    return (
      <button
        key={t}
        type="button"
        className="nav-item"
        aria-current={tab === t ? 'page' : undefined}
        title={label}
        onClick={() => onSelect(t)}
      >
        {Icon && <Icon size={17} strokeWidth={1.75} aria-hidden="true" />}
        <span className="nav-label">{label}</span>
      </button>
    );
  };

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand">
        <BrandMark height={30} />
        <div className="sidebar-brand-text" style={{ flex: 1, minWidth: 0 }}>
          <div className="sidebar-brand-name">Fleet Ledger</div>
          <div className="sidebar-brand-sub">Shree Mira Trader</div>
        </div>
        <button type="button" className="btn btn-icon menu-toggle" aria-label="Close menu" onClick={onClose} style={{ color: 'var(--color-sidebar-text)' }}>
          <X size={18} />
        </button>
      </div>
      <nav className="sidebar-scroll">
        {NAV.map((section, i) => {
          const items = section.items.filter((t) => allowed.includes(t));
          if (items.length === 0) return null;
          return (
            <div key={section.label ?? i} className="sidebar-section">
              {section.label && <div className="sidebar-section-label">{section.label}</div>}
              {items.map(item)}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function TopHeader({ role, userName, tab, onMenu, onSignOut, notifications, onOpenNotification, onMarkAllNotificationsRead }: {
  role: Role;
  userName: string;
  tab: TabId;
  onMenu: () => void;
  onSignOut: () => void;
  notifications: AppNotification[];
  onOpenNotification: (n: AppNotification) => void;
  onMarkAllNotificationsRead: () => void;
}) {
  const section = sectionOf(tab);
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="btn btn-icon menu-toggle" aria-label="Open menu" onClick={onMenu}>
          <Menu size={20} />
        </button>
        <div className="topbar-crumb">
          {section && <>{section} <span aria-hidden="true">/</span> </>}
          <strong>{TAB_LABELS[tab]}</strong>
        </div>
      </div>
      <div className="topbar-right">
        {role !== 'Driver' && role !== 'Viewer' && (
          <NotificationBell notifications={notifications} onOpen={onOpenNotification} onMarkAllRead={onMarkAllNotificationsRead} />
        )}
        <div className="topbar-divider" />
        <div className="topbar-user">
          <div className="avatar" aria-hidden="true">{initials(userName)}</div>
          <div className="topbar-user-text">
            <div className="topbar-user-name">{userName}</div>
            <div className="topbar-user-role">{role}</div>
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onSignOut} aria-label="Sign out">
          <LogOut size={14} aria-hidden="true" /><span className="topbar-signout-label">Sign out</span>
        </button>
      </div>
    </header>
  );
}

export function AppShell({
  role, userName, tab, onTabChange, onSignOut, notifications, onOpenNotification, onMarkAllNotificationsRead, children
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A fresh screen starts at the top, and the phone drawer closes behind it.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setDrawerOpen(false);
  }, [tab]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className="app-layout" data-drawer={drawerOpen ? 'open' : 'closed'}>
      <Sidebar role={role} tab={tab} onSelect={onTabChange} onClose={() => setDrawerOpen(false)} />
      <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} />
      <div className="app-main">
        <TopHeader
          role={role}
          userName={userName}
          tab={tab}
          onMenu={() => setDrawerOpen(true)}
          onSignOut={onSignOut}
          notifications={notifications}
          onOpenNotification={onOpenNotification}
          onMarkAllNotificationsRead={onMarkAllNotificationsRead}
        />
        <main className="app-shell-main">{children}</main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Shree Mira Trader. All rights reserved.</span>
          <span>Fleet Ledger · Goods movement &amp; expense log</span>
        </footer>
      </div>
    </div>
  );
}
