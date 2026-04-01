import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, BellOff, CheckCircle2, ChevronDown, ClipboardCheck, History, Info, MoreHorizontal, RotateCw, Siren, Stethoscope, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function AlertsPage() {
  const { alertes, resolveAlerte, addToast } = useApp();
  const [filter, setFilter] = useState('all');
  const [showHistory, setShowHistory] = useState(false);
  const [silencedUntil, setSilencedUntil] = useState({});

  const active = alertes.filter(a => !a.resolue);
  const resolved = alertes.filter(a => a.resolue);

  const filtered = (showHistory ? alertes : active).filter(a =>
    filter === 'all' || a.type === filter
  );

  function getRecommendations(alert) {
    if (alert.type === 'critical') {
      return ['Diagnostic immédiat', 'Assigner un agent terrain', 'Escalade support N2'];
    }
    if (alert.type === 'warning') {
      return ['Vérifier métriques de la borne', 'Programmer intervention', 'Silence 15 min si déjà traité'];
    }
    return ['Tracer l’événement', 'Surveiller évolution', 'Clôturer si non bloquant'];
  }

  function runAlertAction(alert, action) {
    if (action === 'resolve') {
      resolveAlerte(alert.id);
      addToast(`Alerte ${alert.id} marquée comme résolue`, 'success');
      return;
    }

    if (action === 'diagnose') {
      addToast(`Diagnostic lancé pour ${alert.borneId || 'l\'infrastructure réseau'}`, 'info');
      return;
    }

    if (action === 'assign') {
      addToast(`Intervention assignée pour ${alert.borneId || 'zone globale'}`, 'info');
      return;
    }

    if (action === 'restart') {
      addToast(`Commande de redémarrage envoyée à ${alert.borneId || 'la passerelle'}`, 'warning');
      return;
    }

    if (action === 'escalate') {
      addToast(`Alerte ${alert.id} escaladée au support niveau 2`, 'warning');
      return;
    }

    if (action === 'silence') {
      const until = Date.now() + 15 * 60 * 1000;
      setSilencedUntil(prev => ({ ...prev, [alert.id]: until }));
      addToast(`Alerte ${alert.id} silencée pendant 15 min`, 'info');
    }
  }

  function formatTime(date) {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
    return new Date(date).toLocaleDateString('fr-FR');
  }

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-4 mb-6">
        {[
          { label: 'Critiques', count: active.filter(a => a.type === 'critical').length, color: 'var(--brand-danger)' },
          { label: 'Avertissements', count: active.filter(a => a.type === 'warning').length, color: 'var(--brand-warning)' },
          { label: 'Informatifs', count: active.filter(a => a.type === 'info').length, color: 'var(--text-secondary)' },
          { label: 'Résolus (total)', count: resolved.length, color: 'var(--brand-success)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{s.count}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }}></span>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="tabs">
          <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Tous</button>
          <button className={`tab ${filter === 'critical' ? 'active' : ''}`} onClick={() => setFilter('critical')}>Critiques</button>
          <button className={`tab ${filter === 'warning' ? 'active' : ''}`} onClick={() => setFilter('warning')}>Avertissements</button>
          <button className={`tab ${filter === 'info' ? 'active' : ''}`} onClick={() => setFilter('info')}>Info</button>
        </div>
        <button
          className={`btn ${showHistory ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setShowHistory(p => !p)}
          style={{ marginLeft: 'auto' }}
        >
          {showHistory ? <ClipboardCheck size={14} /> : <History size={14} />}
          {showHistory ? 'Actives seulement' : 'Historique complet'}
        </button>
        {active.length > 0 && !showHistory && (
          <button className="btn btn-secondary btn-sm" onClick={() => {
            active.forEach(a => resolveAlerte(a.id));
            addToast('Toutes les alertes marquées comme résolues', 'success');
          }}>
            <CheckCircle2 size={14} /> Tout résoudre
          </button>
        )}
      </div>

      {/* Alerts list */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ marginBottom: 12, color: 'var(--brand-success)', display: 'inline-flex' }}><CheckCircle2 size={44} /></div>
          <h3 style={{ marginBottom: 6 }}>Aucune alerte active</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Le réseau WiFi de Dioradougou fonctionne normalement.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              formatTime={formatTime}
              recommendations={getRecommendations(alert)}
              silencedUntil={silencedUntil[alert.id]}
              onAction={(action) => runAlertAction(alert, action)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert, formatTime, recommendations, silencedUntil, onAction }) {
  const [showDetails, setShowDetails] = useState(false);
  const typeConfig = {
    critical: { icon: <AlertCircle size={18} color="var(--brand-danger)" />, label: 'CRITIQUE', color: 'var(--brand-danger)' },
    warning: { icon: <AlertTriangle size={18} color="var(--brand-warning)" />, label: 'AVERTISSEMENT', color: 'var(--brand-warning)' },
    info: { icon: <Info size={18} color="var(--text-secondary)" />, label: 'INFO', color: 'var(--text-secondary)' },
  };
  const cfg = typeConfig[alert.type] || typeConfig.info;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderLeft: `3px solid ${cfg.color}`,
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      opacity: alert.resolue ? 0.6 : 1,
      transition: 'all 0.2s',
    }}>
      <div style={{ fontSize: '1.3rem', lineHeight: 1, marginTop: 2 }}>{cfg.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{alert.titre}</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: cfg.color, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '1px 8px', borderRadius: 99, letterSpacing: '0.05em' }}>
            {cfg.label}
          </span>
          {alert.resolue && (
            <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>✓ Résolu</span>
          )}
          {alert.borneId && (
            <code style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '1px 8px', borderRadius: 4 }}>
              {alert.borneId}
            </code>
          )}
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>{alert.message}</p>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatTime(alert.date)}</span>

        {!alert.resolue && showDetails && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border-subtle)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Détails incident
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 8px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Type</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{cfg.label}</div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 8px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Cible</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{alert.borneId || 'Infrastructure globale'}</div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 8px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Statut</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{alert.resolue ? 'Résolu' : 'Actif'}</div>
              </div>
            </div>

            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Actions recommandées
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recommendations.map((rec, idx) => (
                <span key={idx} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 99, padding: '2px 8px' }}>
                  {rec}
                </span>
              ))}
            </div>
            {silencedUntil && silencedUntil > Date.now() && (
              <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Silence actif jusqu’à {new Date(silencedUntil).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => onAction('diagnose')} title="Lancer un diagnostic">
                <Stethoscope size={14} /> Diagnostiquer
              </button>
              {alert.borneId && (
                <button className="btn btn-secondary btn-sm" onClick={() => onAction('restart')} title="Redémarrer la borne à distance">
                  <RotateCw size={14} /> Redémarrer
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => onAction('assign')} title="Affecter un agent">
                <UserPlus size={14} /> Assigner
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onAction('silence')} title="Suspendre les notifications 15 min">
                <BellOff size={14} /> Silence 15m
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onAction('escalate')} title="Escalader au support N2">
                <Siren size={14} /> Escalader
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => onAction('resolve')}>
                <CheckCircle2 size={14} /> Résoudre
              </button>
            </div>
          </div>
        )}
      </div>
      {!alert.resolue && (
        <div style={{ flexShrink: 0, marginLeft: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowDetails(prev => !prev)} title="Voir détails et actions">
            <MoreHorizontal size={14} />
            {showDetails ? 'Masquer' : 'Actions'}
            <ChevronDown size={14} style={{ transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
          </button>
        </div>
      )}
    </div>
  );
}
