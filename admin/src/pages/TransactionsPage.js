import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { HandCoins } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { REVENUS_30J } from '../data/mockData';

const COLORS_PIE = ['var(--text-primary)', 'var(--text-secondary)', 'var(--text-muted)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.15)'];

export default function TransactionsPage() {
  const { transactions, agents, stats: apiStats } = useApp();
  const [search, setSearch] = useState('');
  const [filterMethode, setFilterMethode] = useState('all');
  const [filterStatut, setFilterStatut] = useState('all');
  const [activeTab, setActiveTab] = useState('liste');
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const filtered = useMemo(() => transactions.filter(t => {
    const matchSearch = t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.telephone.includes(search) ||
      t.agentNom.toLowerCase().includes(search.toLowerCase());
    const matchMethode = filterMethode === 'all' || t.methode === filterMethode;
    const matchStatut = filterStatut === 'all' || t.statut === filterStatut;
    return matchSearch && matchMethode && matchStatut;
  }), [transactions, search, filterMethode, filterStatut]);

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const summary = {
    total: transactions.reduce((s, t) => t.statut === 'succès' ? s + t.montant : s, 0),
    count: transactions.filter(t => t.statut === 'succès').length,
    failed: transactions.filter(t => t.statut === 'échoué').length,
    pending: transactions.filter(t => t.statut === 'en attente').length,
  };

  const methodStats = ['Orange Money', 'MTN', 'Wave', 'Moov', 'Cash'].map(m => ({
    name: m,
    count: transactions.filter(t => t.methode === m && t.statut === 'succès').length,
    total: transactions.filter(t => t.methode === m && t.statut === 'succès').reduce((s, t) => s + t.montant, 0),
  }));

  const agentRevStats = agents.map(a => ({
    name: a.nom.split(' ')[0],
    revenus: a.revenusCeMois,
    commission: Math.round(a.revenusCeMois * 0.12),
  })).sort((a, b) => b.revenus - a.revenus);

  const borneStats = ['B01', 'B04', 'B06', 'B08', 'B09'].map(id => ({
    id,
    revenus: Math.floor(30000 + Math.random() * 80000),
  }));

  const revenus30 = apiStats?.revenus30j?.length
    ? apiStats.revenus30j.map(item => ({
        date: new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        total: item.total,
      }))
    : REVENUS_30J;

  return (
    <div>
      {/* KPI */}
      <div className="grid grid-4 mb-6">
        {[
          { label: 'Revenus totaux', value: `${(summary.total / 1000).toFixed(0)}k FCFA` },
          { label: 'Transactions réussies', value: summary.count },
          { label: 'Transactions échouées', value: summary.failed, danger: true },
          { label: 'En attente', value: summary.pending },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.danger ? 'var(--brand-danger)' : 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
        <div className="tabs">
          <button className={`tab ${activeTab === 'liste' ? 'active' : ''}`} onClick={() => setActiveTab('liste')}>Transactions</button>
          <button className={`tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics revenus</button>
          <button className={`tab ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>Par agent</button>
          <button className={`tab ${activeTab === 'bornes' ? 'active' : ''}`} onClick={() => setActiveTab('bornes')}>Par borne</button>
        </div>
      </div>

      {/* Tab: Liste */}
      {activeTab === 'liste' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
              <SearchIcon />
              <input placeholder="Ref, téléphone, agent..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="form-select" style={{ width: 'auto' }} value={filterMethode} onChange={e => setFilterMethode(e.target.value)}>
              <option value="all">Tous les moyens</option>
              {['Orange Money', 'MTN', 'Wave', 'Moov', 'Cash'].map(m => <option key={m}>{m}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto' }} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
              <option value="all">Tous statuts</option>
              <option value="succès">Succès</option>
              <option value="échoué">Échoué</option>
              <option value="en attente">En attente</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const headers = ['ID', 'Montant', 'Méthode', 'Statut', 'Téléphone', 'Agent', 'Date'];
              const rows = filtered.map(t => [t.id, t.montant, t.methode, t.statut, t.telephone, t.agentNom, t.date]);
              const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; a.click();
            }}>
              <ExportIcon /> Export
            </button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th><th>Montant</th><th>Méthode</th><th>Statut</th>
                  <th>Téléphone</th><th>Agent</th><th>Borne</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(t => (
                  <tr key={t.id}>
                    <td><code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.id}</code></td>
                    <td><span style={{ fontWeight: 700 }}>{t.montant}</span> <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>FCFA</span></td>
                    <td><MethodeBadge methode={t.methode} /></td>
                    <td><StatutTxBadge statut={t.statut} /></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.telephone}</td>
                    <td style={{ fontSize: '0.82rem' }}>{t.agentNom}</td>
                    <td><code style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{t.borneId}</code></td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state"><div style={{ marginBottom: 8, display: 'inline-flex', color: 'var(--text-secondary)' }}><HandCoins size={30} /></div><p>Aucune transaction trouvée</p></div>
            )}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filtered.length} transactions · Page {page}/{totalPages}</span>
              <div className="pagination">
                <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return <button key={n} className={`page-btn ${page === n ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>;
                })}
                <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab: Analytics */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><span className="card-title">Revenus — 30 derniers jours</span></div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <AreaChart data={revenus30} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--text-primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--text-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickLine={false} axisLine={false} interval={6} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                    <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} formatter={v => [`${v.toLocaleString('fr-FR')} FCFA`]} />
                    <Area type="monotone" dataKey="total" name="Total" stroke="var(--text-primary)" fill="url(#gradTotal)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Répartition par méthode de paiement</span></div>
              <div style={{ height: 240, display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, height: '100%' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={methodStats} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="total" paddingAngle={3}>
                        {methodStats.map((_, i) => <Cell key={i} fill={COLORS_PIE[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} formatter={v => [`${v.toLocaleString()} FCFA`]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 12 }}>
                  {methodStats.map((m, i) => (
                    <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS_PIE[i], flexShrink: 0 }}></span>
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{m.name}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Par agent */}
      {activeTab === 'agents' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Revenus & commissions par agent</span></div>
          <div style={{ height: 300, marginBottom: 20 }}>
            <ResponsiveContainer>
              <BarChart data={agentRevStats} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} formatter={v => [`${v.toLocaleString()} FCFA`]} />
                <Bar dataKey="revenus" name="Revenus" fill="var(--text-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="commission" name="Commission (12%)" fill="var(--text-secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead><tr><th>Agent</th><th>Revenus</th><th>Commission (12%)</th><th>Part opérateur (83%)</th><th>Caisse communautaire (5%)</th></tr></thead>
              <tbody>
                {agentRevStats.map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{a.revenus.toLocaleString()} FCFA</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{a.commission.toLocaleString()} FCFA</td>
                    <td style={{ color: 'var(--text-muted)' }}>{Math.round(a.revenus * 0.83).toLocaleString()} FCFA</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{Math.round(a.revenus * 0.05).toLocaleString()} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Par borne */}
      {activeTab === 'bornes' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Revenus par borne</span></div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={borneStats} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="id" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} formatter={v => [`${v.toLocaleString()} FCFA`]} />
                <Bar dataKey="revenus" name="Revenus" fill="var(--text-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function MethodeBadge({ methode }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.72rem', fontWeight: 600 }}>
      {methode}
    </span>
  );
}

function StatutTxBadge({ statut }) {
  const map = { 'succès': 'badge-success', 'échoué': 'badge-error', 'en attente': 'badge-warning' };
  return <span className={`badge ${map[statut] || 'badge-muted'}`}>{statut}</span>;
}

const SearchIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const ExportIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;

