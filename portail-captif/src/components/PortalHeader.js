import React from 'react';


export default function PortalHeader({ borneInfo }) {
  return (
    <header className="portal-header">
      <div className="portal-logo">
        <div className="portal-logo-image">
          <img src={require('../assets/logo.png')} alt="Logo Village Connecté" style={{ width: 55, height: 42, borderRadius: 6 }} />
        </div>
        <div className="portal-logo-text">
          <div className="portal-logo-title">Village Connecté</div>
          <div className="portal-logo-sub">Dioradougou</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {borneInfo && (
          <div style={{ fontSize: '0.85rem', marginTop: '4px', color: 'var(--text-muted)', textAlign: 'right' }} className="borne-info">
            <strong>Borne&nbsp;:</strong> <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--brand-primary)' }}>{borneInfo.id}</span>
            {borneInfo.zone && (
              <>
                <br />
                {/* <span style={{ fontSize: '0.8em' }}>{borneInfo.zone}</span> */}
              </>
            )}
          </div>
        )}
        <div className="network-status" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <WifiLogo />
          <span>WiFi disponible</span>
        </div>
      </div>
    </header>
  );
}

function WifiLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
      <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
  );
}
