import React, { useState, useEffect } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function MonitoringPage() {
  const { bornes, kpis } = useApp();
  const [traficData, setTraficData] = useState(generateTrafic(20));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTraficData(prev => {
        const now = new Date();
        const label = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
        const newPoint = {
          time: label,
          download: Math.floor(10 + Math.random() * 60),
          upload: Math.floor(3 + Math.random() * 20),
          users: kpis.usersConnectes + Math.floor((Math.random() - 0.5) * 10),
        };
        return [...prev.slice(-29), newPoint];
      });
      setTick(t => t + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [kpis.usersConnectes]);

  const onlineBornes = bornes.filter(b => b.status === 'online');
  const offlineBornes = bornes.filter(b => b.status === 'offline');
  const warningBornes = bornes.filter(b => b.status === 'warning');
  const totalUsers = bornes.reduce((s, b) => s + b.users, 0);
  const avgSignal = Math.round(onlineBornes.reduce((s, b) => s + b.signal, 0) / (onlineBornes.length || 1));
  const avgBatterie = Math.round(bornes.reduce((s, b) => s + b.batterie, 0) / bornes.length);
  const recentTrafic = traficData.slice(-12).map(point => ({
    ...point,
    timeShort: point.time.slice(3), // mm:ss for better readability
  }));
  const latestPoint = recentTrafic[recentTrafic.length - 1] || { download: 0, upload: 0, users: 0 };
  const avgDownload = Math.round(recentTrafic.reduce((sum, p) => sum + p.download, 0) / (recentTrafic.length || 1));
  const avgUpload = Math.round(recentTrafic.reduce((sum, p) => sum + p.upload, 0) / (recentTrafic.length || 1));
  const avgUsers = Math.round(recentTrafic.reduce((sum, p) => sum + p.users, 0) / (recentTrafic.length || 1));

  return (
    <div>
      {/* Live header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, flexWrap: 'wrap' }}>
        <Activity size={15} color="var(--text-secondary)" strokeWidth={2.2} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Monitoring en direct</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>· Actualisation toutes les 3 secondes</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          {new Date().toLocaleTimeString('fr-FR')} ·tick {tick}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-5 mb-6">
        {[
          { label: 'Bornes en ligne', value: onlineBornes.length, color: 'var(--brand-success)' },
          { label: 'Hors ligne', value: offlineBornes.length, color: 'var(--brand-danger)' },
          { label: 'Alertes', value: warningBornes.length, color: 'var(--brand-warning)' },
          { label: 'Utilisateurs', value: totalUsers, color: 'var(--text-secondary)' },
          { label: 'Signal moy.', value: `${avgSignal}%`, color: 'var(--brand-primary)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }}></span>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Live charts */}
      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Trafic réseau en direct</span>
            <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand-primary)' }}>
                <span style={{ width: 8, height: 2, background: 'var(--brand-primary)', display: 'inline-block', borderRadius: 99 }}></span>
                Download
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                <span style={{ width: 8, height: 2, background: 'var(--text-secondary)', display: 'inline-block', borderRadius: 99 }}></span>
                Upload
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Download actuel</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{latestPoint.download} Mb</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Moyenne download</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{avgDownload} Mb</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Moyenne upload</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{avgUpload} Mb</div>
            </div>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={recentTrafic} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="timeShort" tick={{ fill: 'var(--text-muted)', fontSize: 8 }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} unit=" Mb" />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11 }}
                  formatter={(value, name) => [`${value} Mb`, name === 'download' ? 'Download' : 'Upload']}
                  labelFormatter={(label) => `Temps: ${label}`}
                />
                <Area type="monotone" dataKey="download" name="download" stroke="var(--brand-primary)" fill="var(--brand-primary)" fillOpacity={0.14} strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="upload" name="upload" stroke="var(--text-secondary)" fill="var(--text-secondary)" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Utilisateurs connectés (live)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Moyenne (12 derniers points)</span>
            <strong style={{ fontSize: '0.9rem' }}>{avgUsers} utilisateurs</strong>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={recentTrafic} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="timeShort" tick={{ fill: 'var(--text-muted)', fontSize: 8 }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11 }}
                  formatter={(value) => [`${value} utilisateurs`, 'Connectés']}
                  labelFormatter={(label) => `Temps: ${label}`}
                />
                <ReferenceLine y={avgUsers} stroke="var(--text-muted)" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="users" name="Utilisateurs" stroke="var(--brand-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Borne status grid */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">État en temps réel — 13 bornes</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mise à jour: il y a {tick % 10 * 3}s</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {bornes.map(b => (
            <BorneLiveCard key={b.id} borne={b} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BorneLiveCard({ borne }) {
  const statusColor = borne.status === 'online' ? 'var(--brand-success)' : borne.status === 'offline' ? 'var(--brand-danger)' : 'var(--brand-warning)';
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: 10,
      padding: '12px',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <code style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{borne.id}</code>
        <span className={`pulse-dot ${borne.status}`}></span>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>{borne.zone}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <MiniMetric label="Signal" value={borne.signal} color={borne.signal > 60 ? 'var(--brand-success)' : 'var(--brand-warning)'} />
        <MiniMetric label="Batterie" value={borne.batterie} color={borne.batterie > 50 ? 'var(--brand-success)' : borne.batterie > 20 ? 'var(--brand-warning)' : 'var(--brand-danger)'} />
      </div>

      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {borne.users} users</span>
        <span>{borne.uptime}% uptime</span>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: 2 }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 3, background: 'var(--bg-active)', borderRadius: 99 }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s' }}></div>
      </div>
    </div>
  );
}

function generateTrafic(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - i) * 3000);
    return {
      time: `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`,
      download: Math.floor(10 + Math.random() * 60),
      upload: Math.floor(3 + Math.random() * 20),
      users: Math.floor(80 + Math.random() * 60),
    };
  });
}
