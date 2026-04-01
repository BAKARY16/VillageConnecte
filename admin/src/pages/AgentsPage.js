import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { MapPin, PauseCircle, PlayCircle, Ticket, Trophy, UserRound, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export default function AgentsPage() {
  const { agents, bornes, addAgent, updateAgent, deleteAgent } = useApp();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [detailAgent, setDetailAgent] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [activeTab, setActiveTab] = useState('liste');

  const filtered = agents.filter(a => {
    const matchSearch = a.nom.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalRevenusMois = agents.reduce((s, a) => s + a.revenusCeMois, 0);
  const totalVouchersMois = agents.reduce((s, a) => s + a.vouchersCeMois, 0);
  const agentsActifs = agents.filter(a => a.status === 'actif').length;
  const topAgent = [...agents].sort((a, b) => b.revenusCeMois - a.revenusCeMois)[0];

  return (
    <div>
      {/* KPI Row */}
      <div className="grid grid-4 mb-6">
        <AgentKPI label="Agents actifs" value={`${agentsActifs}/${agents.length}`} color="var(--text-secondary)" icon={<UserRound size={18} />} />
        <AgentKPI label="Vouchers ce mois" value={totalVouchersMois.toLocaleString('fr-FR')} color="var(--text-secondary)" icon={<Ticket size={18} />} />
        <AgentKPI label="Revenus générés" value={`${(totalRevenusMois / 1000).toFixed(0)}k FCFA`} color="var(--text-secondary)" icon={<Wallet size={18} />} />
        <AgentKPI label="Top agent" value={topAgent?.nom.split(' ')[0] || '—'} color="var(--text-secondary)" icon={<Trophy size={18} />} sub={topAgent ? `${topAgent.vouchersCeMois} ventes` : ''} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
        <div className="tabs">
          <button className={`tab ${activeTab === 'liste' ? 'active' : ''}`} onClick={() => setActiveTab('liste')}>Liste des agents</button>
          <button className={`tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</button>
          <button className={`tab ${activeTab === 'classement' ? 'active' : ''}`} onClick={() => setActiveTab('classement')}>Classement</button>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="search-bar">
            <SearchIcon />
            <input placeholder="Rechercher un agent..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">Tous</option>
            <option value="actif">Actifs</option>
            <option value="inactif">Inactifs</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditAgent(null); setShowModal(true); }}>
            <PlusIcon /> Nouvel agent
          </button>
        </div>
      </div>

      {/* Tab: Liste */}
      {activeTab === 'liste' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, alignItems: 'stretch' }}>
          {filtered.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => { setEditAgent(agent); setShowModal(true); }}
              onDetail={() => setDetailAgent(agent)}
              onDelete={() => setConfirmDelete(agent)}
              onToggleStatus={() => updateAgent(agent.id, { status: agent.status === 'actif' ? 'inactif' : 'actif' })}
            />
          ))}
        </div>
      )}

      {/* Tab: Analytics */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Ventes par agent — Ce mois</span>
              </div>
              <div style={{ height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={agents.map(a => ({ nom: a.nom.split(' ')[0], ventes: a.vouchersCeMois, color: a.color }))} margin={{ top: 5, right: 5, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="nom" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="ventes" name="Vouchers vendus" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Revenus par agent — Ce mois</span>
              </div>
              <div style={{ height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={agents.map(a => ({ nom: a.nom.split(' ')[0], revenus: a.revenusCeMois }))} margin={{ top: 5, right: 5, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="nom" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                    <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} formatter={v => [`${v.toLocaleString()} FCFA`]} />
                    <Bar dataKey="revenus" name="Revenus" fill="var(--brand-secondary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Weekly trend for each agent */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Tendance hebdomadaire — Tous agents</span>
            </div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="jour" type="category" allowDuplicatedCategory={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} />
                  {agents.filter(a => a.status === 'actif').map(agent => (
                    <Line
                      key={agent.id}
                      data={agent.historiqueVentes}
                      type="monotone"
                      dataKey="ventes"
                      name={agent.nom.split(' ')[0]}
                      stroke={agent.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Classement */}
      {activeTab === 'classement' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Classement des agents</span>
            <span className="badge badge-info">Mois en cours</span>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Agent</th><th>Zone</th><th>Bornes assignées</th>
                  <th>Vouchers vendus</th><th>Revenus générés</th><th>Commission (12%)</th>
                  <th>Statut</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...agents].sort((a, b) => b.revenusCeMois - a.revenusCeMois).map((agent, i) => (
                  <tr key={agent.id}>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                        #{i + 1}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="agent-avatar" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                          {agent.avatar}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{agent.nom}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{agent.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{agent.zone}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {agent.bornes.map(b => (
                          <span key={b} style={{ fontSize: '0.7rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: '1px 7px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace' }}>{b}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{agent.vouchersCeMois.toLocaleString('fr-FR')}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {agent.revenusCeMois.toLocaleString('fr-FR')} FCFA
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {Math.round(agent.revenusCeMois * 0.12).toLocaleString('fr-FR')} FCFA
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${agent.status === 'actif' ? 'badge-active' : 'badge-inactive'}`}>
                        {agent.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDetailAgent(agent)} title="Détails"><EyeIcon /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditAgent(agent); setShowModal(true); }}><EditIcon /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Agent Form Modal */}
      {showModal && (
        <AgentModal
          agent={editAgent}
          bornes={bornes}
          onClose={() => setShowModal(false)}
          onSave={(data) => {
            if (editAgent) updateAgent(editAgent.id, data);
            else addAgent(data);
            setShowModal(false);
          }}
        />
      )}

      {/* Agent Detail Modal */}
      {detailAgent && (
        <AgentDetailModal agent={detailAgent} onClose={() => setDetailAgent(null)} />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Supprimer l'agent"
        message={`Êtes-vous sûr de vouloir supprimer l'agent ${confirmDelete?.nom} ? Ses données de ventes seront conservées.`}
        onConfirm={() => { deleteAgent(confirmDelete.id); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function CredentialsSummaryModal({ credentials, onClose }) {
  const [copied, setCopied] = useState({});

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(p => ({ ...p, [field]: true }));
    setTimeout(() => setCopied(p => ({ ...p, [field]: false })), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Identifiants créés ✓</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <div style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 4 }}>Agent créé avec succès</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{credentials.nom}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Email</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, fontSize: '0.85rem', color: 'var(--brand-primary)', fontWeight: 500, overflow: 'auto', border: '1px solid var(--border-subtle)' }}>
                  {credentials.email}
                </code>
                <button 
                  type="button"
                  onClick={() => copyToClipboard(credentials.email, 'email')}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.15s' }}
                >
                  {copied.email ? '✓ Copié' : 'Copier'}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Mot de passe</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 6, fontSize: '0.85rem', color: 'var(--brand-primary)', fontWeight: 500, overflow: 'auto', border: '1px solid var(--border-subtle)' }}>
                  {credentials.password}
                </code>
                <button 
                  type="button"
                  onClick={() => copyToClipboard(credentials.password, 'password')}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.15s' }}
                >
                  {copied.password ? '✓ Copié' : 'Copier'}
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: 12, marginTop: 8 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>💡 À transmettre à l'agent</div>
                <p style={{ margin: '4px 0', lineHeight: 1.4 }}>• Identifiants valides immédiatement après création</p>
                <p style={{ margin: '4px 0', lineHeight: 1.4 }}>• Accès à la plateforme agent : https://agent.villageconnecte.ci</p>
                <p style={{ margin: '4px 0', lineHeight: 1.4 }}>• Recommandé : changer le mot de passe au premier login</p>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Terminé</button>
        </div>
      </div>
    </div>
  );
}

function AgentKPI({ label, value, color, icon, sub }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', color, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function AgentCard({ agent, onEdit, onDetail, onDelete, onToggleStatus }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 18, transition: 'all 0.2s', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div className="agent-avatar" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', width: 44, height: 44, fontSize: '0.9rem' }}>
          {agent.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{agent.nom}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{agent.telephone}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {agent.zone}</div>
        </div>
        <span className={`badge ${agent.status === 'actif' ? 'badge-active' : 'badge-inactive'}`}>{agent.status}</span>
      </div>

      {/* Bornes assignées */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 5 }}>BORNES ASSIGNÉES</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {agent.bornes.map(b => (
            <span key={b} style={{ fontSize: '0.72rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: '2px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{b}</span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-3" style={{ gap: 8, marginBottom: 14 }}>
        <div style={{ textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 4px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{agent.vouchersCeMois}</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Vouchers/mois</div>
        </div>
        <div style={{ textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 4px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{(agent.revenusCeMois / 1000).toFixed(0)}k</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>FCFA/mois</div>
        </div>
        <div style={{ textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 4px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(agent.revenusCeMois * 0.12 / 1000)}k</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Commission</div>
        </div>
      </div>

      {/* Mini chart */}
      <div style={{ height: 40, marginBottom: 12 }}>
        {agent.historiqueVentes.length > 0 ? (
          <ResponsiveContainer>
            <BarChart data={agent.historiqueVentes} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Bar dataKey="ventes" fill="var(--brand-primary)" radius={[2, 2, 0, 0]} opacity={0.55} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '100%', border: '1px dashed var(--border-subtle)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Pas encore de ventes
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 'auto' }}>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem' }} onClick={onDetail}>
          <EyeIcon /> Détails
        </button>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem' }} onClick={onEdit}>
          <EditIcon /> Modifier
        </button>
        <button
          className={`btn btn-sm ${agent.status === 'actif' ? 'btn-warning' : 'btn-secondary'}`}
          style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem' }}
          onClick={onToggleStatus}
        >
          {agent.status === 'actif' ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
          {agent.status === 'actif' ? 'Suspendre' : 'Activer'}
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--brand-danger)' }} onClick={onDelete}>
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function AgentModal({ agent, bornes, onClose, onSave, onSaveCredentials }) {
  const [form, setForm] = useState({
    nom: agent?.nom || '',
    email: agent?.email || '',
    telephone: agent?.telephone || '',
    zone: agent?.zone || '',
    status: agent?.status || 'actif',
    password: agent?.password || '',
    bornes: agent?.bornes || [],
    commission: agent?.commission || 12,
  });
  const [showCredentialsSummary, setShowCredentialsSummary] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState(null);

  const toggleBorne = (borneId) => {
    setForm(p => ({
      ...p,
      bornes: p.bornes.includes(borneId) ? p.bornes.filter(b => b !== borneId) : [...p.bornes, borneId],
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{agent ? 'Modifier l\'agent' : 'Nouvel agent'}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Nom complet *</label>
              <input className="form-input" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="Prénom Nom" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="agent@villageconnecte.ci" required />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone *</label>
              <input className="form-input" type="tel" value={form.telephone} onChange={e => setForm(p => ({ ...p, telephone: e.target.value }))} placeholder="+225 07 XX XX XX" />
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe *</label>
              <input className="form-input" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Définir le mot de passe" required />
            </div>
            <div className="form-group">
              <label className="form-label">Zone de couverture</label>
              <input className="form-input" value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} placeholder="ex: Centre / Est" />
            </div>
            <div className="form-group">
              <label className="form-label">Statut</label>
              <select className="form-select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Commission (%)</label>
              <input className="form-input" type="number" value={form.commission} onChange={e => setForm(p => ({ ...p, commission: Number(e.target.value) }))} min="0" max="50" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Bornes assignées</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
              {bornes.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBorne(b.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${form.bornes.includes(b.id) ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                    background: form.bornes.includes(b.id) ? 'rgba(85,16,77,0.12)' : 'var(--bg-elevated)',
                    color: form.bornes.includes(b.id) ? 'var(--brand-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                    textAlign: 'center',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{b.id}</div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: 1 }}>{b.zone.split(' ')[0]}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => {
            if (form.nom && form.email && form.password) {
              setSavedCredentials({ email: form.email, password: form.password, nom: form.nom });
              setShowCredentialsSummary(true);
              onSave(form);
            }
          }} disabled={!form.nom || !form.email || !form.password}>
            {agent ? 'Enregistrer' : 'Créer l\'agent'}
          </button>
        </div>
      </div>
      {showCredentialsSummary && savedCredentials && (
        <CredentialsSummaryModal 
          credentials={savedCredentials} 
          onClose={() => {
            setShowCredentialsSummary(false);
            onClose();
          }} 
        />
      )}
    </div>
  );
}

function AgentDetailModal({ agent, onClose }) {
  const totalVentes = agent.historiqueVentes.reduce((s, h) => s + h.ventes, 0);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="agent-avatar" style={{ background: `${agent.color}22`, color: agent.color, width: 48, height: 48, fontSize: '1rem' }}>
              {agent.avatar}
            </div>
            <div>
              <div className="modal-title">{agent.nom}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{agent.id} · {agent.telephone}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          {/* Summary stats */}
          <div className="grid grid-4 mb-6" style={{ gap: 12 }}>
            {[
              { label: 'Vouchers ce mois', value: agent.vouchersCeMois, color: 'var(--text-primary)' },
              { label: 'Revenus ce mois', value: `${agent.revenusCeMois.toLocaleString('fr-FR')} FCFA`, color: 'var(--text-primary)' },
              { label: 'Commission due', value: `${Math.round(agent.revenusCeMois * 0.12).toLocaleString('fr-FR')} FCFA`, color: 'var(--text-primary)' },
              { label: 'Total tous temps', value: `${agent.revenusTotal.toLocaleString('fr-FR')} FCFA`, color: 'var(--text-primary)' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Weekly chart */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <span className="card-title">Historique ventes — 7 derniers jours</span>
            </div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={agent.historiqueVentes} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="jour" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="ventes" name="Vouchers vendus" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-2" style={{ marginTop: 16, gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Informations</div>
              {[
                ['Zone', agent.zone],
                ['Statut', agent.status],
                ['Date recrutement', agent.dateRecrutement],
                ['Commission', `${agent.commission}%`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Bornes assignées</div>
              {agent.bornes.map(b => (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}>
                  <span className="pulse-dot online" style={{ width: 7, height: 7 }}></span>
                  <code style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{b}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

const SearchIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const PlusIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const EyeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const CloseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
