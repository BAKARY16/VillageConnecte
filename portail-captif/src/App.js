import React, { useState } from 'react';
import { PortalProvider, usePortal } from './context/PortalContext';
import PortalHeader from './components/PortalHeader';
import PortalFooter from './components/PortalFooter';
import ToastContainer from './components/Toast';
import VoucherPage from './pages/VoucherPage';
import AchatPage from './pages/AchatPage';
import SessionPage from './pages/SessionPage';
import { ArrowDownUp, ShieldCheck, Wifi } from 'lucide-react';
import './index.css';

// ── Borne info (injectée par nodogsplash en production) ──────────────────────
function PortalInner() {
  const { session, setSession, portalMeta } = usePortal();
  const [activeTab, setActiveTab] = useState('voucher'); // 'voucher' | 'achat'
  const borneInfo = portalMeta?.borne || null;

  // Si une session est active, afficher la page de session
  if (session) {
    return (
      <div className="portal-root">
        <PortalHeader borneInfo={borneInfo} />
        <main className="portal-main">
          <div className="portal-container">
            <SessionPage session={session} />
          </div>
        </main>
        <PortalFooter />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="portal-root">
      <PortalHeader borneInfo={borneInfo} />

      <main className="portal-main">
        <div className="portal-container">
          {/* Welcome message */}
          <div style={{ textAlign: 'center', marginBottom: 20 }} className="animate-fadeInUp">
            {/* <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>
              📡 Borne <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--brand-primary)', fontWeight: 700 }}>{BORNE_INFO.id}</span> · {BORNE_INFO.zone}
            </div> */}
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 6 }}>
              Accédez à Internet
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Saisissez votre code voucher ou achetez un pass WiFi directement
            </p>
          </div>

          {/* Main card */}
          <div className="card animate-fadeInUp delay-1">
            {/* Tabs */}
            <div className="page-tabs">
              <button
                className={`page-tab ${activeTab === 'voucher' ? 'active' : ''}`}
                onClick={() => setActiveTab('voucher')}
              >
                <TicketIcon />
                J'ai un code
              </button>
              <button
                className={`page-tab ${activeTab === 'achat' ? 'active' : ''}`}
                onClick={() => setActiveTab('achat')}
              >
                <ShopIcon />
                Acheter un pass
              </button>
            </div>

            {/* Page body */}
            <div className="card-body">
              {activeTab === 'voucher' && (
                <VoucherPage
                  key="voucher"
                  onSuccess={(sess) => setSession(sess)}
                />
              )}
              {activeTab === 'achat' && (
                <AchatPage
                  key="achat"
                  onSuccess={(sess) => setSession(sess)}
                />
              )}
            </div>
          </div>

          {/* Info cards avec icônes Lucide React */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16 }} className="animate-fadeInUp delay-2">
            {[
              { Icon: ArrowDownUp , label: (portalMeta?.debitReferenceMbps || 0) + ' Mbps', sub: 'Débit garanti' },
              { Icon: ShieldCheck, label: 'Sécurisé', sub: 'Paiement CinetPay' },
              { Icon: Wifi, label: (portalMeta?.totalBornes || 0) + ' bornes', sub: 'Roaming gratuit' },
            ].map((c, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
                  <c.Icon size={22} color="#7A2A7A" strokeWidth={2.2} />
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{c.label}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Help */}
          <div style={{ marginTop: 16, textAlign: 'center' }} className="animate-fadeInUp delay-3">
            <button
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}
              onClick={() => setActiveTab('achat')}
            >
              <PhoneIcon /> Besoin d'aide ? Contactez un agent local
            </button>
          </div>
        </div>
      </main>

      <PortalFooter />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <PortalProvider>
      <PortalInner />
    </PortalProvider>
  );
}

// Icons
const TicketIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
    <path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>
  </svg>
);

const ShopIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);

const PhoneIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3-8.57A2 2 0 0 1 3.18 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.1 6.1l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);


