import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RadioTower } from 'lucide-react';

const PAGE_TITLES = {
  dashboard: 'Dashboard Global',
  monitoring: 'Monitoring Temps Réel',
  bornes: 'Gestion des Bornes',
  agents: 'Gestion des Agents',
  vouchers: 'Gestion des Vouchers',
  transactions: 'Transactions & Revenus',
  sessions: 'Sessions Actives',
  alerts: 'Alertes & Incidents',
  settings: 'Paramètres',
};

export default function Header({ currentPage, onToggleSidebar }) {
  const { theme, setTheme, notifications, markNotificationsRead, kpis } = useApp();
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = notifications.filter(n => !n.read).length;

  const handleNotifClick = () => {
    setShowNotifs(p => !p);
    if (!showNotifs) markNotificationsRead();
  };

  return (
    <header className="header">
      {/* Menu toggle */}
      <button className="btn btn-ghost btn-icon" onClick={onToggleSidebar}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <div className="header-title-wrap" style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{PAGE_TITLES[currentPage] || 'Dashboard'}</h2>
        <p className="header-date" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Live indicator */}
      <div className="header-live-pill" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'var(--bg-elevated)', borderRadius: 20 }}>
        <RadioTower className='pulse' size={16} color="var(--text-secondary)" strokeWidth={2.2} />
        <span style={{ fontSize: '0.9rem', marginTop: 2, fontWeight: 600, color:"var(--text-secondary)" }}>
          {kpis.usersConnectes} connectés
        </span>
      </div>

      {/* Theme toggle */}
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
      >
        {theme === 'dark' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>

      {/* Notifications */}
      <div className="dropdown">
        <button className="btn btn-ghost btn-icon" onClick={handleNotifClick} style={{ position: 'relative' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unread > 0 && (
            <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, background: 'var(--brand-danger)', borderRadius: '50%', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {showNotifs && (
          <div className="dropdown-menu" style={{ width: 320, maxHeight: 400, overflowY: 'auto' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.85rem' }}>
              Notifications récentes
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Aucune notification
              </div>
            ) : notifications.slice(0, 10).map(n => (
              <div key={n.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-success)', marginTop: 4, flexShrink: 0 }}></div>
                  <div>
                    <div style={{ color: 'var(--text-primary)' }}>{n.message}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: 2 }}>
                      {formatTimeAgo(n.time)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {showNotifs && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 59 }} onClick={() => setShowNotifs(false)} />
      )}
    </header>
  );
}

function formatTimeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
  return `Il y a ${Math.floor(diff / 3600000)}h`;
}
