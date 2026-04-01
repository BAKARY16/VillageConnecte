import React, { useState } from 'react';
import { Radio } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';

function formatDuration(seconds) {
  if (seconds > 86400) return `${Math.floor(seconds / 86400)}j ${Math.floor((seconds % 86400) / 3600)}h`;
  if (seconds > 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
  return `${Math.floor(seconds / 60)} min`;
}

export default function SessionsPage() {
  const { sessions, disconnectSession } = useApp();
  const [confirmDisconnect, setConfirmDisconnect] = useState(null);

  return (
    <div>
      <div className="grid grid-3 mb-6">
        {[
          { label: 'Sessions actives', value: sessions.length, color: 'var(--text-secondary)' },
          { label: 'Débit total estimé', value: `${sessions.reduce((s, sess) => s + sess.debitDown, 0).toFixed(1)} Mbps`, color: 'var(--text-secondary)' },
          { label: 'Data transférée', value: `${sessions.reduce((s, sess) => s + sess.dataTotal, 0)} MB`, color: 'var(--brand-secondary)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Adresse MAC</th><th>IP</th><th>Borne</th><th>Pass</th>
              <th>Connecté depuis</th><th>Durée restante</th><th>↓ Download</th><th>Data</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id}>
                <td><code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.mac}</code></td>
                <td><code style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.ip}</code></td>
                <td>
                  <div>
                    <code style={{ fontSize: '0.8rem', fontWeight: 700 }}>{s.borneId}</code>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.borneZone}</div>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.78rem', color: s.typePass === 'mensuel' ? 'var(--brand-secondary)' : s.typePass === 'hebdomadaire' ? 'var(--brand-info)' : 'var(--brand-success)', fontWeight: 600 }}>
                    {s.typePass}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {new Date(s.heureConnexion).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: s.dureeRestante < 3600 ? 'var(--brand-warning)' : 'var(--text-primary)' }}>
                    {formatDuration(s.dureeRestante)}
                  </span>
                </td>
                <td>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{s.debitDown} Mbps</span>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.dataTotal} MB</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmDisconnect(s)}>
                    <DisconnectIcon /> Déconnecter
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && (
          <div className="empty-state">
            <div style={{ marginBottom: 8, display: 'inline-flex', color: 'var(--brand-primary)' }}><Radio size={30} /></div>
            <p>Aucune session active</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDisconnect}
        title="Déconnecter l'utilisateur"
        message={`Voulez-vous forcer la déconnexion de l'appareil ${confirmDisconnect?.mac} (${confirmDisconnect?.borneZone}) ?`}
        onConfirm={() => { disconnectSession(confirmDisconnect.id); setConfirmDisconnect(null); }}
        onCancel={() => setConfirmDisconnect(null)}
        variant="warning"
      />
    </div>
  );
}

const DisconnectIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
