import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../context/AppContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export default function BornesPage() {
  const { bornes, addBorne, updateBorne, deleteBorne, addToast } = useApp();
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editBorne, setEditBorne] = useState(null);
  const [detailBorne, setDetailBorne] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = bornes.filter(b => {
    const matchSearch = b.id.toLowerCase().includes(search.toLowerCase()) || b.zone.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Calculate map center from bornes with geo data
  const bornesWithGeo = bornes.filter(b => typeof b.lat === 'number' && typeof b.lng === 'number');
  const mapCenter = bornesWithGeo.length > 0
    ? [
        bornesWithGeo.reduce((sum, b) => sum + b.lat, 0) / bornesWithGeo.length,
        bornesWithGeo.reduce((sum, b) => sum + b.lng, 0) / bornesWithGeo.length,
      ]
    : [7.283, -7.650]; // Dioradougou, région de Man, Côte d'Ivoire

  const stats = {
    online: bornes.filter(b => b.status === 'online').length,
    offline: bornes.filter(b => b.status === 'offline').length,
    warning: bornes.filter(b => b.status === 'warning').length,
  };

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'En ligne', count: stats.online, color: 'var(--brand-success)', status: 'online' },
          { label: 'Avertissement', count: stats.warning, color: 'var(--brand-warning)', status: 'warning' },
          { label: 'Hors ligne', count: stats.offline, color: 'var(--brand-danger)', status: 'offline' },
        ].map(s => (
          <div
            key={s.status}
            onClick={() => setFilterStatus(filterStatus === s.status ? 'all' : s.status)}
            style={{ flex: 1, background: 'var(--bg-card)', border: `1px solid ${filterStatus === s.status ? s.color : 'var(--border-subtle)'}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
        <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{bornes.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>Total bornes</div>
        </div>
      </div>

      {/* Map Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Carte des bornes WiFi</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }}></span>En ligne</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }}></span>Alerte</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }}></span>Hors ligne</span>
          </div>
        </div>
        <div style={{ height: 320, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', zIndex: 9, width: '100%' }} scrollWheelZoom={false}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {bornesWithGeo.map((b) => {
              const color = b.status === 'online' ? '#10B981' : b.status === 'warning' ? '#F59E0B' : '#EF4444';
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
                      <div style={{ fontSize: 12 }}>Statut: {b.status === 'online' ? 'En ligne' : b.status === 'warning' ? 'Alerte' : 'Hors ligne'}</div>
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

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
          <SearchIcon />
          <input placeholder="Rechercher une borne..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Tous les statuts</option>
          <option value="online">En ligne</option>
          <option value="warning">Avertissement</option>
          <option value="offline">Hors ligne</option>
        </select>
        <div className="tabs">
          <button className={`tab ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>Grille</button>
          <button className={`tab ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>Tableau</button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditBorne(null); setShowModal(true); }}>
          <PlusIcon /> Ajouter borne
        </button>
      </div>

      {/* Grid view */}
      {view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {filtered.map(b => (
            <BorneCard
              key={b.id}
              borne={b}
              onEdit={() => { setEditBorne(b); setShowModal(true); }}
              onDetail={() => setDetailBorne(b)}
              onDelete={() => setConfirmDelete(b)}
            />
          ))}
        </div>
      )}

      {/* Table view */}
      {view === 'table' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th><th>Zone</th><th>Type</th><th>Statut</th>
                <th>Alimentation</th><th>Rechargeable</th><th>Signal</th><th>Batterie</th><th>Utilisateurs</th><th>Uptime</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td data-label="ID"><code style={{ fontSize: '0.8rem', color: 'var(--brand-primary)' }}>{b.id}</code></td>
                  <td data-label="Zone">{b.zone}</td>
                  <td data-label="Type"><span style={{ fontSize: '0.78rem' }}>{b.type}</span></td>
                  <td data-label="Statut"><StatusBadge status={b.status} /></td>
                  <td data-label="Alimentation"><span style={{ fontSize: '0.78rem' }}>{getAlimentationLabel(b)}</span></td>
                  <td data-label="Rechargeable">
                    <span className={`badge ${isRechargeable(b) ? 'badge-online' : 'badge-muted'}`}>
                      {isRechargeable(b) ? 'Oui' : 'Non'}
                    </span>
                  </td>
                  <td data-label="Signal"><MiniBar value={b.signal} color={b.signal > 60 ? '#10B981' : b.signal > 30 ? '#F59E0B' : '#EF4444'} /></td>
                  <td data-label="Batterie"><MiniBar value={b.batterie} color={b.batterie > 50 ? '#10B981' : b.batterie > 20 ? '#F59E0B' : '#EF4444'} /></td>
                  <td data-label="Users">{b.users}</td>
                  <td data-label="Uptime">{b.uptime}%</td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDetailBorne(b)} title="Détails"><EyeIcon /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditBorne(b); setShowModal(true); }} title="Modifier"><EditIcon /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--brand-danger)' }} onClick={() => setConfirmDelete(b)} title="Supprimer"><TrashIcon /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Borne Form Modal */}
      {showModal && (
        <BorneModal
          borne={editBorne}
          onClose={() => setShowModal(false)}
          onSave={(data) => {
            if (editBorne) updateBorne(editBorne.id, data);
            else addBorne(data);
            setShowModal(false);
          }}
        />
      )}

      {/* Detail Modal */}
      {detailBorne && (
        <BorneDetailModal borne={detailBorne} onClose={() => setDetailBorne(null)} />
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Supprimer la borne"
        message={`Êtes-vous sûr de vouloir supprimer la borne ${confirmDelete?.id} (${confirmDelete?.zone}) ? Cette action est irréversible.`}
        onConfirm={() => { deleteBorne(confirmDelete.id); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function BorneCard({ borne, onEdit, onDetail, onDelete }) {
  return (
    <div
      className={`borne-card ${borne.status}`}
      style={{ cursor: 'default' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <span className={`pulse-dot ${borne.status}`}></span>
            <code style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{borne.id}</code>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{borne.zone}</div>
        </div>
        <StatusBadge status={borne.status} />
      </div>

      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10, background: 'var(--bg-elevated)', padding: '4px 8px', borderRadius: 4, display: 'inline-block' }}>
        {borne.type}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <span className="badge badge-info">{getAlimentationLabel(borne)}</span>
        <span className={`badge ${isRechargeable(borne) ? 'badge-online' : 'badge-muted'}`}>
          Rechargeable: {isRechargeable(borne) ? 'Oui' : 'Non'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <MetricRow label="Signal" value={borne.signal} unit="%" color={borne.signal > 60 ? '#10B981' : borne.signal > 30 ? '#F59E0B' : '#EF4444'} />
        <MetricRow label="Batterie" value={borne.batterie} unit="%" color={borne.batterie > 50 ? '#10B981' : borne.batterie > 20 ? '#F59E0B' : '#EF4444'} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={12} /> <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{borne.users}</span> connectés</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onDetail} title="Détails"><EyeIcon /></button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} title="Modifier"><EditIcon /></button>
          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--brand-danger)' }} onClick={onDelete} title="Supprimer"><TrashIcon /></button>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, unit, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 3 }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{value}{unit}</span>
      </div>
      <div className="status-bar" style={{ height: 4 }}>
        <div className="status-bar-fill" style={{ width: `${value}%`, '--bar-color': color }}></div>
      </div>
    </div>
  );
}

function MiniBar({ value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 48, height: 4, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 99 }}></div>
      </div>
      <span style={{ fontSize: '0.75rem', color }}>{value}%</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { online: ['badge-online', 'En ligne'], offline: ['badge-offline', 'Hors ligne'], warning: ['badge-pending', 'Alerte'] };
  const [cls, label] = map[status] || ['badge-muted', status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function getAlimentationLabel(borne) {
  return borne.alimentation || '220V (secteur)';
}

function isRechargeable(borne) {
  return (borne.rechargeable || 'non') === 'oui';
}

function BorneModal({ borne, onClose, onSave }) {
  const [form, setForm] = useState({
    zone: borne?.zone || '',
    type: borne?.type || 'Répéteur',
    alimentation: borne?.alimentation || '220V (secteur)',
    rechargeable: borne?.rechargeable || 'non',
    solaire: borne?.solaire || '20W',
    mat: borne?.mat || '4m',
    ip: borne?.ip || '',
    mac: borne?.mac || '',
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{borne ? 'Modifier la borne' : 'Ajouter une borne'}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Zone</label>
              <input className="form-input" value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} placeholder="ex: Centre-Est" />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                <option>Répéteur</option>
                <option>Nœud central</option>
                <option>Borne principale</option>
                <option>HUB principal</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Alimentation</label>
              <select className="form-select" value={form.alimentation} onChange={e => setForm(p => ({ ...p, alimentation: e.target.value }))}>
                <option>220V (secteur)</option>
                <option>Solaire</option>
                <option>Hybride (220V + solaire)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Rechargeable</label>
              <select className="form-select" value={form.rechargeable} onChange={e => setForm(p => ({ ...p, rechargeable: e.target.value }))}>
                <option value="non">Non</option>
                <option value="oui">Oui</option>
              </select>
            </div>
            {(form.alimentation === 'Solaire' || form.alimentation === 'Hybride (220V + solaire)') && (
              <div className="form-group">
                <label className="form-label">Kit solaire</label>
                <select className="form-select" value={form.solaire} onChange={e => setForm(p => ({ ...p, solaire: e.target.value }))}>
                  <option>20W</option><option>30W</option><option>50W</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Hauteur mât</label>
              <select className="form-select" value={form.mat} onChange={e => setForm(p => ({ ...p, mat: e.target.value }))}>
                <option>4m</option><option>6m</option><option>8m</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Adresse IP</label>
              <input className="form-input" value={form.ip} onChange={e => setForm(p => ({ ...p, ip: e.target.value }))} placeholder="192.168.1.xxx" />
            </div>
            <div className="form-group">
              <label className="form-label">Adresse MAC</label>
              <input className="form-input" value={form.mac} onChange={e => setForm(p => ({ ...p, mac: e.target.value }))} placeholder="AA:BB:CC:DD:EE:FF" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => onSave({ ...form, solaire: (form.alimentation === 'Solaire' || form.alimentation === 'Hybride (220V + solaire)') ? form.solaire : 'Aucun' })}>
            {borne ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BorneDetailModal({ borne, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`pulse-dot ${borne.status}`} style={{ width: 10, height: 10 }}></span>
            <span className="modal-title">Borne {borne.id} — {borne.zone}</span>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2" style={{ gap: 24 }}>
            <div>
              <h4 style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Informations</h4>
              <InfoRow label="Type" value={borne.type} />
              <InfoRow label="Zone" value={borne.zone} />
              <InfoRow label="Alimentation" value={getAlimentationLabel(borne)} />
              <InfoRow label="Rechargeable" value={isRechargeable(borne) ? 'Oui' : 'Non'} />
              {borne.solaire && borne.solaire !== 'Aucun' && <InfoRow label="Kit solaire" value={borne.solaire} />}
              <InfoRow label="Mât" value={borne.mat} />
              <InfoRow label="IP" value={<code style={{ color: 'var(--brand-primary)' }}>{borne.ip}</code>} />
              <InfoRow label="MAC" value={<code style={{ fontSize: '0.75rem' }}>{borne.mac}</code>} />
            </div>
            <div>
              <h4 style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Métriques</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <MetricCard label="Signal WiFi" value={borne.signal} unit="%" color={borne.signal > 60 ? '#10B981' : '#F59E0B'} />
                <MetricCard label="Batterie LiFePO4" value={borne.batterie} unit="%" color={borne.batterie > 50 ? '#10B981' : '#EF4444'} />
                <MetricCard label="Uptime" value={borne.uptime} unit="%" color="#6366F1" />
              </div>
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 10 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{borne.users}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Utilisateurs connectés actuellement</div>
              </div>
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

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function MetricCard({ label, value, unit, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.8rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 600, color }}>{value}{unit}</span>
      </div>
      <div className="progress"><div className="progress-bar" style={{ width: `${value}%`, background: color }}></div></div>
    </div>
  );
}

// Icons
const SearchIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const PlusIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const EyeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const CloseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
