import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { AlertCircle, AlertTriangle, Battery, CheckCircle2, Info, Signal, Users as UsersLucide } from 'lucide-react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../context/AppContext';
import { TRAFIC_24H, TARIFS } from '../data/mockData';

const fmt = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toString();
const fmtFCFA = (n) => `${fmt(n)} FCFA`;

const COLORS = ['var(--dashboard-chart-1)', 'var(--dashboard-chart-2)', 'var(--dashboard-chart-3)'];

export default function DashboardPage() {
  const { kpis, bornes, agents, alertes, vouchers, stats, tarifs } = useApp();
  const [period, setPeriod] = useState('24h');
  const traficSource = stats?.trafic24h?.length ? stats.trafic24h : TRAFIC_24H;
  const tarifsSource = tarifs?.length ? tarifs : TARIFS;

  const voucherStats = {
    journalier: vouchers.filter(v => v.type === 'journalier').length,
    hebdomadaire: vouchers.filter(v => v.type === 'hebdomadaire').length,
    mensuel: vouchers.filter(v => v.type === 'mensuel').length,
  };

  const pieData = [
    { name: 'Journalier', value: voucherStats.journalier },
    { name: 'Hebdomadaire', value: voucherStats.hebdomadaire },
    { name: 'Mensuel', value: voucherStats.mensuel },
  ];

  const topAgents = [...agents].sort((a, b) => b.revenusCeMois - a.revenusCeMois).slice(0, 4);
  const recentAlerts = alertes.filter(a => !a.resolue).slice(0, 3);

  const bornesWithGeo = bornes.filter(b => typeof b.lat === 'number' && typeof b.lng === 'number');
  const mapCenter = bornesWithGeo.length > 0
    ? [
        bornesWithGeo.reduce((sum, b) => sum + b.lat, 0) / bornesWithGeo.length,
        bornesWithGeo.reduce((sum, b) => sum + b.lng, 0) / bornesWithGeo.length,
      ]
    : [7.283, -7.650]; // Dioradougou, région de Man, Côte d'Ivoire

  const kpiTone = {
    color: 'var(--brand-primary)',
    bg: 'var(--dashboard-kpi-bg)',
  };

  return (
    <div>
      {/* KPI Grid */}
      <div className="kpi-grid">
        <KPICard
          icon={<UsersIcon />}
          value={kpis.usersConnectes}
          label="Utilisateurs connectés"
          trend="+12%"
          trendUp
          color={kpiTone.color}
          bg={kpiTone.bg}
          subtitle="en ce moment"
        />
        <KPICard
          icon={<DollarIcon />}
          value={fmtFCFA(kpis.revenusJour)}
          label="Revenus aujourd'hui"
          trend={`+${Math.round((kpis.revenusJour - kpis.revenusHier) / kpis.revenusHier * 100)}%`}
          trendUp={kpis.revenusJour >= kpis.revenusHier}
          color={kpiTone.color}
          bg={kpiTone.bg}
          subtitle={`vs hier: ${fmtFCFA(kpis.revenusHier)}`}
        />
        <KPICard
          icon={<TicketIcon />}
          value={kpis.vouchersDuJour}
          label="Vouchers vendus"
          trend="+8%"
          trendUp
          color={kpiTone.color}
          bg={kpiTone.bg}
          subtitle="aujourd'hui"
        />
        <KPICard
          icon={<AgentsIcon />}
          value={kpis.agentsActifs}
          label="Agents actifs"
          trend={`/${agents.length} total`}
          trendUp
          color={kpiTone.color}
          bg={kpiTone.bg}
          subtitle="sur le terrain"
        />
        <KPICard
          icon={<WifiIcon />}
          value={`${kpis.bornesActives}/${kpis.bornesTotal}`}
          label="Bornes en ligne"
          trend={kpis.bornesOffline > 0 ? `${kpis.bornesOffline} hors ligne` : 'Tout opérationnel'}
          trendUp={kpis.bornesOffline === 0}
          color={kpis.bornesOffline > 0 ? 'var(--brand-danger)' : 'var(--brand-success)'}
          bg={kpis.bornesOffline > 0 ? 'var(--dashboard-danger-bg)' : 'var(--dashboard-success-bg)'}
          subtitle="réseau mesh"
        />
        <KPICard
          icon={<UptimeIcon />}
          value={`${kpis.uptimeGlobal}%`}
          label="Uptime global"
          trend="7 derniers jours"
          trendUp
          color="var(--brand-success)"
          bg="var(--dashboard-success-bg)"
          subtitle="disponibilité réseau"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-2 mb-6">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Carte des bornes WiFi</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--dashboard-online)' }}></span>Online</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--dashboard-warning)' }}></span>Warning</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--dashboard-offline)' }}></span>Offline</span>
            </div>
          </div>
          <div className="chart-container" style={{ height: 260, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', zIndex: 9, width: '100%' }} scrollWheelZoom={false}>
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {bornesWithGeo.map((b) => {
                const color = b.status === 'online' ? 'var(--dashboard-online)' : b.status === 'warning' ? 'var(--dashboard-warning)' : 'var(--dashboard-offline)';
                return (
                  <CircleMarker
                    key={b.id}
                    center={[b.lat, b.lng]}
                    radius={7}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.75, weight: 2 }}
                  >
                    <Popup>
                      <div style={{ minWidth: 140 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{b.id} - {b.zone}</div>
                        <div style={{ fontSize: 12 }}>Statut: {b.status}</div>
                        <div style={{ fontSize: 12 }}>Utilisateurs: {b.users}</div>
                        <div style={{ fontSize: 12 }}>Signal: {b.signal}%</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              Flux d'utilisateurs (24h)
            </span>
            <div className="tabs">
              {['24h', '12h', '6h'].map(p => (
                <button key={p} className={`tab ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
              ))}
            </div>
          </div>
          <div className="chart-container" style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={period === '24h' ? traficSource : period === '12h' ? traficSource.slice(-12) : traficSource.slice(-6)} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--dashboard-grid-line)" />
                <XAxis dataKey="heure" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="users" name="Utilisateurs" fill="var(--brand-primary)" radius={[3, 3, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid dashboard-row-secondary mb-6">
        {/* Voucher distribution */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Types de Vouchers</span>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top agents */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <span className="card-title">Top Agents — Ce mois</span>
            <span className="badge badge-info">{new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topAgents.map((agent, i) => (
              <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 22, fontSize: '0.75rem', fontWeight: 700, color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  #{i + 1}
                </div>
                <div className="agent-avatar" style={{ background: 'var(--bg-elevated)', color: 'var(--brand-primary)', fontSize: '0.75rem', width: 32, height: 32 }}>
                  {agent.avatar}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 500, marginBottom: 3 }}>{agent.nom}</div>
                  <div className="status-bar" style={{ height: 4 }}>
                    <div className="status-bar-fill" style={{
                      width: `${(agent.revenusCeMois / topAgents[0].revenusCeMois) * 100}%`,
                      '--bar-color': i === 0 ? 'var(--dashboard-bar-1)' : i === 1 ? 'var(--dashboard-bar-2)' : i === 2 ? 'var(--dashboard-bar-3)' : 'var(--dashboard-bar-4)'
                    }}></div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{agent.vouchersCeMois} ventes</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{(agent.revenusCeMois).toLocaleString('fr-FR')} FCFA</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-2">
        {/* Borne Status */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <span className="card-title">État des Bornes</span>
            <span className="badge badge-online">{bornes.filter(b => b.status === 'online').length} en ligne</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', paddingBottom: 4 }}>
            {bornes.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: '100%', width: 'max-content', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                {/* <span className={`pulse-dot ${b.status}`}></span> */}
                <span style={{ width: 32, fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>{b.id}</span>
                <span style={{ minWidth: 120, flex: 1, fontSize: '0.8rem' }}>{b.zone}</span>
                <div style={{ display: 'flex', gap: 8, fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  <span title="Signal" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Signal size={12} /> {b.signal}%</span>
                  <span title="Batterie" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Battery size={12} /> {b.batterie}%</span>
                  <span title="Utilisateurs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><UsersLucide size={12} /> {b.users}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Alertes Actives</span>
            {recentAlerts.length > 0 && (
              <span className="badge badge-error">{recentAlerts.length} urgentes</span>
            )}
          </div>
          {recentAlerts.length === 0 ? (
            <div className="empty-state">
              <div style={{ marginBottom: 8, color: 'var(--brand-success)', display: 'inline-flex' }}><CheckCircle2 size={36} /></div>
              <p style={{ fontSize: '0.85rem' }}>Aucune alerte active</p>
              <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Le réseau fonctionne normalement</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentAlerts.map(alert => (
                <div key={alert.id} className={`alert-item ${alert.type}`}>
                  <div style={{ marginTop: 1, flexShrink: 0 }}>
                    {alert.type === 'critical' ? <AlertCircle size={14} color="var(--brand-danger)" /> : alert.type === 'warning' ? <AlertTriangle size={14} color="var(--brand-warning)" /> : <Info size={14} color="var(--brand-info)" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 2 }}>{alert.titre}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{alert.message}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {formatTimeAgo(alert.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tarif summary */}
          <div className="divider"></div>
          <div className="card-header" style={{ marginBottom: 12 }}>
            <span className="card-title">Tarification Active</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {tarifsSource.map(t => (
              <div key={t.id} style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-primary)' }}>{t.prix}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 1 }}>FCFA</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 500, marginTop: 4 }}>{t.nom}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t.duree}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon, value, label, trend, trendUp, color, bg, subtitle }) {
  return (
    <div className="kpi-card" style={{ '--kpi-color': color, '--kpi-bg': bg }}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {subtitle && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      <div className={`kpi-trend ${trendUp ? 'trend-up' : 'trend-down'}`}>
        {trendUp ? '↑' : '↓'} {trend}
      </div>
    </div>
  );
}

function formatTimeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
  return `Il y a ${Math.floor(diff / 3600000)}h`;
}

// Icons
function UsersIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function DollarIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
function TicketIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>; }
function AgentsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function WifiIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>; }
function ChartIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function AlertIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function UptimeIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
