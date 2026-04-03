import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MoreHorizontal, Ticket } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const TYPES = ['journalier', 'hebdomadaire', 'mensuel'];
const PRIX = { journalier: 200, hebdomadaire: 1000, mensuel: 3000 };
const STATUTS = ['actif', 'utilisé', 'expiré'];

export default function VouchersPage() {
  const { vouchers, agents, voucherCommands, generateVouchersForAgent, reactivateVoucher, deleteVoucher } = useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatut, setFilterStatut] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [showGenModal, setShowGenModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const filtered = useMemo(() => vouchers.filter(v => {
    const matchSearch = v.code.toLowerCase().includes(search.toLowerCase()) || v.agentNom.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || v.type === filterType;
    const matchStatut = filterStatut === 'all' || v.statut === filterStatut;
    return matchSearch && matchType && matchStatut;
  }), [vouchers, search, filterType, filterStatut]);

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const stats = {
    total: vouchers.length,
    actif: vouchers.filter(v => v.statut === 'actif').length,
    utilise: vouchers.filter(v => v.statut === 'utilisé').length,
    expire: vouchers.filter(v => v.statut === 'expiré').length,
    revenusTotal: vouchers.filter(v => v.statut === 'utilisé').reduce((s, v) => s + v.prix, 0),
  };

  const getExpirationDisplay = (voucher) => {
    if (voucher.dateExpiration) return voucher.dateExpiration;
    return 'Non definie (a l activation)';
  };

  const exportCSV = () => {
    const headers = ['Code', 'Type', 'Prix (FCFA)', 'Statut', 'Agent', 'Date creation', 'Date expiration', 'Paiement'];
    const rows = filtered.map(v => [v.code, v.type, v.prix, v.statut, v.agentNom, v.dateCreation, getExpirationDisplay(v), v.paymentMethod]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'vouchers.csv'; a.click();
  };

  const handleDeleteVoucher = (voucher) => {
    setConfirmDelete(voucher);
  };

  return (
    <div>
      {/* Section Commandes */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>Commandes récentes</h3>
        {voucherCommands.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {voucherCommands.slice(0, 6).map(cmd => (
              <div key={cmd.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{cmd.id}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{cmd.agentNom}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Type: {cmd.type}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Codes: {cmd.count}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Paiement: {cmd.paymentMethod}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{cmd.totalValue.toLocaleString('fr-FR')} FCFA</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12, color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
            Aucune commande pour le moment
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-5 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'var(--text-primary)' },
          { label: 'Actifs', value: stats.actif, color: 'var(--text-primary)' },
          { label: 'Utilisés', value: stats.utilise, color: 'var(--text-primary)' },
          { label: 'Expirés', value: stats.expire, color: 'var(--text-primary)' },
          { label: 'Revenus utilisés', value: `${(stats.revenusTotal / 1000).toFixed(0)}k FCFA`, color: 'var(--text-primary)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
          <SearchIcon />
          <input placeholder="Rechercher par code, agent..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
          <option value="all">Tous les types</option>
          {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPage(1); }}>
          <option value="all">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
          <ExportIcon /> Export CSV
        </button>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setViewMode('table')}
            style={{
              borderRadius: 0,
              border: 'none',
              background: viewMode === 'table' ? 'var(--bg-elevated)' : 'transparent',
              color: viewMode === 'table' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            Tableau
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setViewMode('grid')}
            style={{
              borderRadius: 0,
              border: 'none',
              background: viewMode === 'grid' ? 'var(--bg-elevated)' : 'transparent',
              color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            Grille
          </button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowGenModal(true)}>
          <PlusIcon /> Générer vouchers
        </button>
      </div>

      {/* Contenu */}
      {viewMode === 'table' ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th><th>Type</th><th>Prix</th><th>Statut</th>
                <th>Agent</th><th>Paiement</th><th>Création</th><th>Expiration</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(v => (
                <tr key={v.id}>
                  <td data-label="Code">
                    <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                      {v.code}
                    </code>
                  </td>
                  <td data-label="Type"><TypeBadge type={v.type} /></td>
                  <td data-label="Prix"><span style={{ fontWeight: 600 }}>{v.prix}</span> <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>FCFA</span></td>
                  <td data-label="Statut"><StatutBadge statut={v.statut} /></td>
                  <td data-label="Agent">
                    <span style={{ fontSize: '0.82rem' }}>{v.agentNom !== '—' ? v.agentNom : <span style={{ color: 'var(--text-muted)' }}>—</span>}</span>
                  </td>
                  <td data-label="Paiement">
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{v.paymentMethod}</span>
                  </td>
                  <td data-label="Création" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{v.dateCreation}</td>
                  <td data-label="Expiration" style={{ fontSize: '0.78rem', color: v.statut === 'expiré' ? 'var(--brand-danger)' : 'var(--text-secondary)' }}>
                    {getExpirationDisplay(v)}
                  </td>
                  <td data-label="Actions">
                    <VoucherActions
                      voucher={v}
                      onReactivate={reactivateVoucher}
                      onDelete={handleDeleteVoucher}
                      compact
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {paginated.map(v => (
            <VoucherCard
              key={v.id}
              voucher={v}
              onReactivate={reactivateVoucher}
              onDelete={handleDeleteVoucher}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="empty-state">
          <div style={{ marginBottom: 8, display: 'inline-flex', color: 'var(--brand-primary)' }}><Ticket size={30} /></div>
          <p>Aucun voucher trouvé</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {filtered.length} résultats · Page {page}/{totalPages}
          </span>
          <div className="pagination">
            <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <button key={n} className={`page-btn ${page === n ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
              );
            })}
            <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenModal && (
        <GenerateModal onClose={() => setShowGenModal(false)} onGenerate={(type, count, agentId, paymentMethod) => { generateVouchersForAgent(type, count, agentId, paymentMethod); setShowGenModal(false); }} agents={agents} />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Supprimer le code"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le code ${confirmDelete?.code} ? Cette action est irréversible.`}
        onConfirm={() => {
          deleteVoucher(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function VoucherCard({ voucher, onReactivate, onDelete }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
          {voucher.code}
        </code>
        <StatutBadge statut={voucher.statut} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <TypeBadge type={voucher.type} />
        <div style={{ fontSize: '0.82rem' }}>
          <span style={{ fontWeight: 700 }}>{voucher.prix}</span>{' '}
          <span style={{ color: 'var(--text-muted)' }}>FCFA</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MetaLine label="Agent" value={voucher.agentNom} />
        <MetaLine label="Paiement" value={voucher.paymentMethod} />
        <MetaLine label="Création" value={voucher.dateCreation} />
        <MetaLine
          label="Expiration"
          value={voucher.dateExpiration || 'Non definie'}
          valueColor={voucher.statut === 'expiré' ? 'var(--brand-danger)' : 'var(--text-secondary)'}
        />
      </div>

      <div style={{ marginTop: 'auto' }}>
        <VoucherActions
          voucher={voucher}
          onReactivate={onReactivate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

function MetaLine({ label, value, valueColor }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '0.8rem', color: valueColor || 'var(--text-secondary)' }}>{value || '—'}</div>
    </div>
  );
}

function VoucherActions({ voucher, onReactivate, onDelete, compact = false }) {
  const isExpired = voucher.statut === 'expiré';

  if (compact) {
    return (
      <RowActionsMenu
        voucher={voucher}
        isExpired={isExpired}
        onReactivate={onReactivate}
        onDelete={onDelete}
      />
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: compact ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
      {isExpired && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onReactivate(voucher.id)}
        >
          Réactiver
        </button>
      )}
      <button
        type="button"
        className="btn btn-danger btn-sm"
        onClick={() => onDelete(voucher)}
      >
        Supprimer
      </button>
    </div>
  );
}

function RowActionsMenu({ voucher, isExpired, onReactivate, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onDocClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-sm"
        onClick={() => setOpen(v => !v)}
        aria-label={`Actions pour ${voucher.code}`}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 150,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
            zIndex: 20,
            padding: 6,
          }}
        >
          {isExpired ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onReactivate(voucher.id);
                  setOpen(false);
                }}
                style={menuItemStyle}
              >
                Réactiver
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(voucher);
                  setOpen(false);
                }}
                style={{ ...menuItemStyle, color: 'var(--brand-danger)' }}
              >
                Supprimer
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                onDelete(voucher);
                setOpen(false);
              }}
              style={{ ...menuItemStyle, color: 'var(--brand-danger)' }}
            >
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const menuItemStyle = {
  width: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: '0.8rem',
  borderRadius: 6,
  padding: '7px 8px',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

function TypeBadge({ type }) {
  const map = {
    journalier: ['var(--text-primary)', 'var(--bg-elevated)', '24h'],
    hebdomadaire: ['var(--text-primary)', 'var(--bg-elevated)', '7j'],
    mensuel: ['var(--text-primary)', 'var(--bg-elevated)', '30j'],
  };
  const [color, bg, dur] = map[type] || ['var(--text-muted)', 'var(--bg-elevated)', type];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: bg, color, fontSize: '0.72rem', fontWeight: 600, border: '1px solid var(--border-subtle)' }}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
      <span style={{ opacity: 0.7, fontSize: '0.65rem' }}>({dur})</span>
    </span>
  );
}

function StatutBadge({ statut }) {
  const tone = statut === 'expiré' ? 'var(--brand-danger)' : 'var(--text-secondary)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 99,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        color: tone,
        fontSize: '0.72rem',
        fontWeight: 600,
      }}
    >
      {statut}
    </span>
  );
}

function GenerateModal({ onClose, onGenerate, agents }) {
  const [type, setType] = useState('journalier');
  const [count, setCount] = useState(10);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const prix = PRIX[type];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Générer des vouchers</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Type de pass</label>
            <div className="grid grid-3" style={{ gap: 8 }}>
              {TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: `1px solid ${type === t ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                    background: type === t ? 'rgba(85,16,77,0.12)' : 'var(--bg-elevated)',
                    color: type === t ? 'var(--brand-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</div>
                  <div style={{ fontSize: '0.7rem', marginTop: 2, color: 'var(--text-muted)' }}>{PRIX[t]} FCFA</div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre de vouchers à générer</label>
            <input
              className="form-input"
              type="number"
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(500, Number(e.target.value))))}
              min="1"
              max="500"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Assigner à un agent (optionnel)</label>
            <select
              className="form-input"
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
            >
              <option value="">-- Non assigné (codes libres) --</option>
              {agents.filter(a => a.status === 'actif').map(a => (
                <option key={a.id} value={a.id}>{a.nom}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Moyen de paiement</label>
            <select
              className="form-input"
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
            >
              <option value="Cash">Cash</option>
              <option value="Orange Money">Orange Money</option>
              <option value="MTN">MTN</option>
              <option value="Wave">Wave</option>
              <option value="Moov">Moov</option>
            </select>
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Résumé</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 5 }}>
              <span style={{ color: 'var(--text-muted)' }}>Type</span>
              <span style={{ fontWeight: 500 }}>{type} ({type === 'journalier' ? '24h' : type === 'hebdomadaire' ? '7 jours' : '30 jours'})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 5 }}>
              <span style={{ color: 'var(--text-muted)' }}>Quantité</span>
              <span style={{ fontWeight: 500 }}>{count} codes</span>
            </div>
            {selectedAgent && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 5 }}>
                <span style={{ color: 'var(--text-muted)' }}>Agent</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{agents.find(a => a.id === selectedAgent)?.nom}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 5 }}>
              <span style={{ color: 'var(--text-muted)' }}>Paiement</span>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{paymentMethod}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Valeur totale</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{(count * prix).toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => onGenerate(type, count, selectedAgent, paymentMethod)}>
            <PlusIcon /> Générer {count} vouchers{selectedAgent ? ' pour agent' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

const SearchIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const PlusIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const ExportIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const CloseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
