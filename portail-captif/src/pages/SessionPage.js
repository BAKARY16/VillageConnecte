import React, { useState, useEffect, useRef } from 'react';
import { usePortal } from '../context/PortalContext';
import {Sun, CalendarDays, Calendar1, Lightbulb, Gift} from 'lucide-react';

function pad(n) { return String(n).padStart(2, '0'); }

function formatDuration(seconds) {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}j ${pad(rh)}h ${pad(m)}min`;
  }
  return `${pad(h)}h ${pad(m)}min ${pad(s)}s`;
}

function formatMbps(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '0.000';
  return n.toFixed(3);
}

function formatMb(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '0.000';
  return n.toFixed(3);
}

const SESSION_STATUS_REFRESH_MS = Math.min(
  5000,
  Math.max(1000, Number(process.env.REACT_APP_SESSION_STATUS_REFRESH_MS || 5000)),
);

export default function SessionPage({ session }) {
  const { disconnect, addToast, getSessionStatus, portalMeta } = usePortal();
  const autoDisconnectedRef = useRef(false);

  const baseTotalSeconds = Math.max(1, (session?.duree || 0) * 3600);
  const [liveSession, setLiveSession] = useState(session);
  const [remaining, setRemaining] = useState(Math.max(0, session?.secondesRestantes || baseTotalSeconds));
  const [speed, setSpeed] = useState({
    down: Number(session?.debitDownMbps || session?.vitesseMbps || portalMeta?.debitReferenceMbps || 0),
    up: Number(session?.debitUpMbps || Math.max(1, Math.round(Number(session?.vitesseMbps || portalMeta?.debitReferenceMbps || 5) / 3))),
  });
  const [dataDown, setDataDown] = useState(Number(session?.dataDownMb || 0));
  const [dataUp, setDataUp] = useState(Number(session?.dataUpMb || 0));
  const [dataUsed, setDataUsed] = useState(Number(session?.dataTotalMb || 0));
  const [lastMetricsAt, setLastMetricsAt] = useState(null);

  useEffect(() => {
    if (!session?.id) return undefined;

    let cancelled = false;

    const refreshStatus = async () => {
      const result = await getSessionStatus(session.id);
      if (cancelled || autoDisconnectedRef.current) return;

      const shouldForceDisconnect =
        !result?.ok ||
        !result?.session ||
        result?.active === false ||
        (result?.statut && result.statut !== 'active');

      if (shouldForceDisconnect) {
        autoDisconnectedRef.current = true;
        addToast('Session terminee automatiquement (code supprime, revoque ou expire).', 'warning');
        disconnect();
        return;
      }

      setLiveSession(result.session);
      setRemaining(Math.max(0, Number(result.session.secondesRestantes || 0)));
      setDataDown(Number(result.session.dataDownMb || 0));
      setDataUp(Number(result.session.dataUpMb || 0));
      setDataUsed(Number(result.session.dataTotalMb || 0));
      const down = Number(result.session.debitDownMbps ?? result.session.vitesseMbps ?? portalMeta?.debitReferenceMbps ?? 0);
      const up = Number(result.session.debitUpMbps ?? Math.max(1, Math.round(Number(result.session.vitesseMbps || portalMeta?.debitReferenceMbps || 5) / 3)));
      setSpeed({
        down,
        up,
      });
      setLastMetricsAt(Date.now());
    };

    refreshStatus();
    const poll = setInterval(refreshStatus, SESSION_STATUS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [session?.id, getSessionStatus, portalMeta?.debitReferenceMbps, addToast, disconnect]);

  useEffect(() => {
    const tick = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  const totalSeconds = Math.max(1, (liveSession?.duree || session?.duree || 1) * 3600);
  const pct = Math.max(0, Math.min(100, Math.round((remaining / totalSeconds) * 100)));

  const typeConfig = {
    journalier:   { color: '#10B981', icon: <Sun /> },
    hebdomadaire: { color: '#6366F1', icon: <Calendar1 /> },
    mensuel:      { color: '#F5A623', icon: <CalendarDays /> },
  };
  const sessionType = liveSession?.type || session?.type || 'journalier';
  const cfg = typeConfig[sessionType] || typeConfig.journalier;

  const handleDisconnect = () => {
    addToast('Déconnexion en cours...', 'info');
    setTimeout(() => disconnect(), 600);
  };

  return (
    <div className="animate-fadeInUp">
      {/* Hero — Connecté */}
      <div style={{
        background: '#f9f7fc',
        border: '1.5px solid rgba(0,200,150,0.25)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px 24px',
        textAlign: 'center',
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* background circles */}
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(0,200,150,0.05)', top: -80, right: -60, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'rgba(0,200,150,0.04)', bottom: -50, left: -40, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Status badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 99, marginBottom: 16 }}>
            <span className="pulse-dot"></span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-success)' }}>Connecté au WiFi</span>
          </div>

          {/* Big wifi icon */}
          <div style={{ marginBottom: 12 }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 12px rgba(0,200,150,0.4))' }}>
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          </div>

          <div style={{ fontSize: '1.1rem', gap: '0.6rem', alignItems: 'center', display: 'flex', justifyContent: 'center', fontWeight: 700, marginTop: 4 }}>
            <span>{cfg.icon} </span>
            <span>Pass {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}</span>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace',fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '0.1em',marginTop: 20, marginBottom: 40 }}>
            {liveSession?.code?.slice(0, 4)} {liveSession?.code?.slice(4)}
          </div>

          {/* Countdown */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>Temps restant</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '2rem', fontWeight: 800, color: remaining < 3600 ? 'var(--brand-warning)' : 'var(--brand-primary)', letterSpacing: '0.05em', lineHeight: 1 }}>
              {formatDuration(remaining)}
            </div>
          </div>

          {/* Progress ring (simplified as bar) */}
          <div style={{ width: '100%', maxWidth: 280, margin: '14px auto 0', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${cfg.color}, var(--brand-primary))`, borderRadius: 99, transition: 'width 1s linear' }} />
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 5 }}>{pct}% du temps restant</div>
        </div>
      </div>

      {/* Speed meters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {[
          { label: '↓ Débit reçu', value: formatMbps(speed.down), unit: 'Mbps', color: 'var(--text-primary)' },
          { label: '↑ Débit envoyé', value: formatMbps(speed.up), unit: 'Mbps', color: 'var(--text-primary)' },
          // { label: '↓ Data reçue', value: formatMb(dataDown), unit: 'MB', color: 'var(--brand-secondary)' },
          // { label: '↑ Data envoyée', value: formatMb(dataUp), unit: 'MB', color: 'var(--brand-secondary)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-primary)', marginTop: 1 }}>{s.unit}</div>
            <div style={{ fontSize: '0.63rem', color: '#000', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.65)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
          Total consommé: <strong>{formatMb(dataUsed)} MB</strong>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {lastMetricsAt ? 'Mesures en direct actives' : 'En attente des mesures'}
        </div>
      </div>

      {/* Session details */}
      {/* <div className="session-info" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 0 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
          Détails de la session
        </div>
        {[
          ['Borne WiFi', session.borne || 'B08 — HUB Ouest'],
          ['Connecté depuis', formatDateTime(session.heureDebut)],
          ['Expire le', formatDateTime(session.expireAt)],
          ['Adresse MAC', session.mac],
          ['Débit garanti', session.debit || '5 Mbps'],
        ].map(([k, v]) => (
          <div key={k} className="session-row">
            <span className="session-row-label">{k}</span>
            <span className="session-row-value" style={{
              fontFamily: k === 'Adresse MAC' ? 'JetBrains Mono, monospace' : undefined,
              fontSize: k === 'Adresse MAC' ? '0.75rem' : undefined,
              maxWidth: '55%',
              textAlign: 'right',
            }}>{v}</span>
          </div>
        ))}
      </div> */}

      {/* Tips */}
      <div className="info-box blue" style={{ marginBottom: 16, fontSize: '0.78rem' }}>
        <span><Lightbulb /></span>
        <span>Votre connexion est active sur toutes les <strong>{portalMeta?.totalBornes || 0} bornes WiFi</strong> du village. Déplacez-vous librement sans vous déconnecter.</span>
      </div>

      {/* Recharge link */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 2 }}>Recharger / Offrir</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Acheter un nouveau pass ou en offrir un</div>
        </div>
        <span style={{ fontSize: '1rem', color: 'var(--brand-secondary)' }}><Gift /></span>
      </div>

      {/* Disconnect */}
      <button
        onClick={handleDisconnect}
        style={{
          width: '100%',
          padding: '11px',
          borderRadius: 'var(--radius-md)',
          border: '1.5px solid rgba(239,68,68,0.25)',
          background: 'rgba(239,68,68,0.06)',
          color: 'var(--brand-danger)',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.target.style.background = 'rgba(239,68,68,0.12)'; }}
        onMouseLeave={e => { e.target.style.background = 'rgba(239,68,68,0.06)'; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Se déconnecter
      </button>
    </div>
  );
}
