import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Activity,
  Bell,
  CircleDollarSign,
  LayoutGrid,
  LogOut,
  Monitor,
  Radio,
  Settings,
  Ticket,
  Users,
  Wifi,
} from 'lucide-react';

const NAV_ITEMS = [
  { section: 'Vue d\'ensemble' },
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'monitoring', label: 'Monitoring en direct', icon: 'activity', badge: null },
  { id: 'sessions', label: 'Sessions Utilisateurs', icon: 'monitor' },
  { section: 'Infrastructure' },
  { id: 'bornes', label: 'Gestion des Bornes', icon: 'wifi' },
  { id: 'alerts', label: 'Alertes & Incidents', icon: 'bell', badgeKey: 'alertesActives' },
  { section: 'Commercial' },
  { id: 'agents', label: 'Gestion des Agents', icon: 'users' },
  { id: 'vouchers', label: 'Vouchers', icon: 'ticket' },
  { id: 'transactions', label: 'Transactions & Revenus', icon: 'dollar' },
  { section: 'Configuration' },
  { id: 'settings', label: 'Paramètres', icon: 'settings' },
];

const ICONS = {
  grid: LayoutGrid,
  activity: Activity,
  wifi: Wifi,
  bell: Bell,
  users: Users,
  ticket: Ticket,
  dollar: CircleDollarSign,
  monitor: Monitor,
  settings: Settings,
  logout: LogOut,
};

export default function Sidebar({ currentPage, onNavigate, className = '' }) {
  const [logoError, setLogoError] = useState(false);
  const { user, logout, alertes } = useApp();
  const alertCount = alertes.filter(a => !a.resolue).length;

  return (
    <aside className={`sidebar ${className}`.trim()}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoError ? (
            <div className="sidebar-logo-fallback">
              <Radio size={20} color="var(--brand-primary)" strokeWidth={2} />
            </div>
          ) : (
            <img
              src="/logo.png"
              alt="Village Connecte"
              className="sidebar-logo-image"
              onError={() => setLogoError(true)}
            />
          )}
          <div>
            <div className="sidebar-brand-text" style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2 }}>Village Connecté</div>
            <div className="sidebar-brand-text" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              {/* <span className="pulse-dot online" style={{ width: 5, height: 5 }}></span> */}
              Plateforme Admin
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item, idx) => {
          if (item.section) {
            return (
              <div key={idx} className="nav-section-label" style={{ marginTop: idx > 0 ? 8 : 0 }}>
                {item.section}
              </div>
            );
          }
          const badgeCount = item.badgeKey === 'alertesActives' ? alertCount : item.badge;
          const Icon = ICONS[item.icon];
          return (
            <button
              key={item.id}
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon">
                {Icon ? <Icon size={16} strokeWidth={2} /> : null}
              </span>
              <span className="nav-label" style={{ flex: 1 }}>{item.label}</span>
              {badgeCount > 0 && (
                <span className="nav-badge">{badgeCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {user?.avatar || 'AD'}
          </div>
          <div className="sidebar-user-meta" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, truncate: true }}>{user?.prenom}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Super Admin</div>
          </div>
        </div>
        <button className="btn btn-ghost w-full btn-sm" onClick={logout} style={{ justifyContent: 'center', color: 'var(--brand-danger)' }}>
          <LogOut size={14} strokeWidth={2} />
          <span className="logout-label">Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
