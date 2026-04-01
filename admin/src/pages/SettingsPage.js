import React, { useState } from 'react';
import { CircleHelp, Landmark, Monitor, Moon, Palette, Sun, UserCog, Wifi } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TARIFS } from '../data/mockData';

export default function SettingsPage() {
  const { user, addToast, theme, setTheme, updateProfile } = useApp();
  const [tarifs, setTarifs] = useState(TARIFS);
  const [profile, setProfile] = useState({
    prenom: user?.prenom || '',
    nom: user?.nom || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [network, setNetwork] = useState({
    ssid: 'VillageConnecté_Dioradougou',
    channel: '6',
    bandwidth: '20MHz',
    maxUsers: 50,
    captivePortalUrl: 'http://192.168.1.108/portal',
    apiUrl: 'https://api.village-connecte.ci',
    cinetpayKey: 'cpk-sandbox-xxxxx',
    cinetpaySiteId: 'vc_dioradougou_01',
  });
  const [branding, setBranding] = useState({
    nomProjet: 'Village Connecté Dioradougou',
    nomOrganisation: 'FabLab UVCI',
    couleurPrimaire: '#55104D',
    couleurSecondaire: '#F29A07',
    logoUrl: '',
  });
  const [activeSection, setActiveSection] = useState('tarifs');

  const saveSection = (section) => {
    addToast(`Configuration ${section} sauvegardée`, 'success');
  };

  return (
    <div className="settings-layout">
      {/* Sidebar nav */}
      <div className="settings-nav" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12, alignSelf: 'start' }}>
        {[
          { id: 'profile', label: 'Profil Admin', icon: <UserCog size={14} /> },
          { id: 'tarifs', label: 'Tarification', icon: <Landmark size={14} /> },
          { id: 'network', label: 'Réseau & API', icon: <Wifi size={14} /> },
          { id: 'branding', label: 'Branding', icon: <Palette size={14} /> },
          { id: 'theme', label: 'Apparence', icon: <Monitor size={14} /> },
          { id: 'about', label: 'À propos', icon: <CircleHelp size={14} /> },
        ].map(s => (
          <button
            key={s.id}
            className={`nav-item ${activeSection === s.id ? 'active' : ''}`}
            style={{ width: '100%', marginBottom: 2 }}
            onClick={() => setActiveSection(s.id)}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div>
        {/* Profil Admin */}
        {activeSection === 'profile' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Profil administrateur</span>
              <span className="badge badge-info">Compte connecté</span>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Prénom</label>
                <input className="form-input" value={profile.prenom} onChange={e => setProfile(p => ({ ...p, prenom: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Nom</label>
                <input className="form-input" value={profile.nom} onChange={e => setProfile(p => ({ ...p, nom: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
            </div>

            <div className="divider"></div>
            <div className="grid grid-3">
              <div className="form-group">
                <label className="form-label">Mot de passe actuel</label>
                <input className="form-input" type="password" value={profile.currentPassword} onChange={e => setProfile(p => ({ ...p, currentPassword: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Nouveau mot de passe</label>
                <input className="form-input" type="password" value={profile.newPassword} onChange={e => setProfile(p => ({ ...p, newPassword: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmation</label>
                <input className="form-input" type="password" value={profile.confirmPassword} onChange={e => setProfile(p => ({ ...p, confirmPassword: e.target.value }))} />
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (profile.newPassword && profile.newPassword !== profile.confirmPassword) {
                    addToast('La confirmation du nouveau mot de passe est incorrecte', 'error');
                    return;
                  }
                  updateProfile({
                    prenom: profile.prenom,
                    nom: profile.nom,
                    email: profile.email,
                  });
                  if (profile.newPassword) {
                    addToast('Mot de passe mis à jour (simulation)', 'success');
                  }
                  setProfile(p => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }));
                }}
              >
                Mettre à jour le profil
              </button>
            </div>
          </div>
        )}

        {/* Tarification */}
        {activeSection === 'tarifs' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Tarification des passes WiFi</span>
              <span className="badge badge-info">3 formules</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {tarifs.map((t, i) => (
                <div key={t.id} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, border: `1px solid ${t.couleur}33` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.couleur }}></div>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.nom}</span>
                    </div>
                    <span className="badge badge-info">{t.duree}</span>
                  </div>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Prix (FCFA)</label>
                      <input
                        className="form-input"
                        type="number"
                        value={t.prix}
                        onChange={e => setTarifs(prev => prev.map((x, j) => j === i ? { ...x, prix: Number(e.target.value) } : x))}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Débit garanti</label>
                      <input className="form-input" value={t.debit} readOnly style={{ opacity: 0.7 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(85,16,77,0.08)', borderRadius: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <CircleHelp size={16} color="var(--brand-primary)" style={{ marginTop: 1, flexShrink: 0 }} />
              <span>Les tarifs sont définis selon la politique tarifaire FabLab/UVCI pour l'accessibilité des villageois de Dioradougou (population estimée: 2 000 hab.)</span>
            </div>
            <div className="modal-footer" style={{ padding: '16px 0 0', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => saveSection('tarification')}>Enregistrer les tarifs</button>
            </div>
          </div>
        )}

        {/* Network */}
        {activeSection === 'network' && (
          <div className="card">
            <div className="card-header"><span className="card-title">Configuration réseau & API</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>WiFi Mesh</h4>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">SSID réseau</label>
                  <input className="form-input" value={network.ssid} onChange={e => setNetwork(p => ({ ...p, ssid: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Canal WiFi</label>
                  <select className="form-select" value={network.channel} onChange={e => setNetwork(p => ({ ...p, channel: e.target.value }))}>
                    {['1', '6', '11', '36', '40', '44'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Bande passante</label>
                  <select className="form-select" value={network.bandwidth} onChange={e => setNetwork(p => ({ ...p, bandwidth: e.target.value }))}>
                    {['20MHz', '40MHz', '80MHz'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Utilisateurs max / borne</label>
                  <input className="form-input" type="number" value={network.maxUsers} onChange={e => setNetwork(p => ({ ...p, maxUsers: Number(e.target.value) }))} />
                </div>
              </div>

              <div className="divider"></div>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Portail Captif & API</h4>
              <div className="form-group">
                <label className="form-label">URL Portail Captif</label>
                <input className="form-input" value={network.captivePortalUrl} onChange={e => setNetwork(p => ({ ...p, captivePortalUrl: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">URL API Backend</label>
                <input className="form-input" value={network.apiUrl} onChange={e => setNetwork(p => ({ ...p, apiUrl: e.target.value }))} />
              </div>

              <div className="divider"></div>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>CinetPay (Mobile Money)</h4>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Clé API CinetPay</label>
                  <input className="form-input" type="password" value={network.cinetpayKey} onChange={e => setNetwork(p => ({ ...p, cinetpayKey: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Site ID</label>
                  <input className="form-input" value={network.cinetpaySiteId} onChange={e => setNetwork(p => ({ ...p, cinetpaySiteId: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px 0 0' }}>
              <button className="btn btn-primary" onClick={() => saveSection('réseau')}>Sauvegarder</button>
            </div>
          </div>
        )}

        {/* Branding */}
        {activeSection === 'branding' && (
          <div className="card">
            <div className="card-header"><span className="card-title">Personnalisation & Branding</span></div>
            <div className="form-group">
              <label className="form-label">Nom du projet</label>
              <input className="form-input" value={branding.nomProjet} onChange={e => setBranding(p => ({ ...p, nomProjet: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Organisation</label>
              <input className="form-input" value={branding.nomOrganisation} onChange={e => setBranding(p => ({ ...p, nomOrganisation: e.target.value }))} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Couleur primaire</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={branding.couleurPrimaire} onChange={e => setBranding(p => ({ ...p, couleurPrimaire: e.target.value }))} style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                  <input className="form-input" value={branding.couleurPrimaire} onChange={e => setBranding(p => ({ ...p, couleurPrimaire: e.target.value }))} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Couleur secondaire</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={branding.couleurSecondaire} onChange={e => setBranding(p => ({ ...p, couleurSecondaire: e.target.value }))} style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                  <input className="form-input" value={branding.couleurSecondaire} onChange={e => setBranding(p => ({ ...p, couleurSecondaire: e.target.value }))} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }} />
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px 0 0' }}>
              <button className="btn btn-primary" onClick={() => saveSection('branding')}>Appliquer</button>
            </div>
          </div>
        )}

        {/* Theme */}
        {activeSection === 'theme' && (
          <div className="card">
            <div className="card-header"><span className="card-title">Apparence du Dashboard</span></div>
            <div className="grid grid-2" style={{ gap: 16 }}>
              {[
                { id: 'dark', label: 'Mode Sombre', desc: 'Interface sombre, idéale pour les longues sessions', icon: <Moon size={28} /> },
                { id: 'light', label: 'Mode Clair', desc: 'Interface claire, meilleure lisibilité en pleine lumière', icon: <Sun size={28} /> },
              ].map(t => (
                <div
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  style={{
                    padding: 20,
                    borderRadius: 12,
                    border: `2px solid ${theme === t.id ? 'var(--brand-primary)' : 'var(--border-default)'}`,
                    background: theme === t.id ? 'rgba(85,16,77,0.08)' : 'var(--bg-elevated)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ marginBottom: 10, color: 'var(--brand-primary)' }}>{t.icon}</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.desc}</div>
                  {theme === t.id && <div style={{ marginTop: 10, color: 'var(--brand-primary)', fontSize: '0.8rem', fontWeight: 600 }}>✓ Actif</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* About */}
        {activeSection === 'about' && (
          <div className="card">
            <div className="card-header"><span className="card-title">À propos du projet</span></div>
            <div className="grid grid-2" style={{ gap: 24 }}>
              {[
                ['Projet', 'Village Connecté Dioradougou'],
                ['Organisation', 'FabLab / UVCI (Université Virtuelle de Côte d\'Ivoire)'],
                ['Version dashboard', '1.0.0'],
                ['Bornes déployées', '13 (mesh WiFi 802.11s)'],
                ['Protocole mesh', 'batman-adv sous OpenWrt 21.02+'],
                ['Backhaul internet', '4G/Fibre — HUB Borne-08 (Zone Ouest)'],
                ['Énergie', 'Panneaux solaires monocristallins + Batteries LiFePO4'],
                ['Paiement', 'CinetPay (Orange Money, MTN, Wave, Moov)'],
                ['Backend', 'Node.js / Express.js / MySQL 8.0'],
                ['Hébergement', 'Hostinger Business'],
                ['Coordonnées GPS', '7.7842113°N / -7.8816685°E'],
                ['Zone couverture', '8.07 km — 13 points de déploiement'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24, padding: '14px 16px', background: 'rgba(85,16,77,0.06)', border: '1px solid rgba(85,16,77,0.15)', borderRadius: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              © 2026 FabLab UVCI — Projet pilote Village Connecté. Ce dashboard est développé pour la gestion administrative du réseau WiFi communautaire de Dioradougou, région de Man, Côte d'Ivoire.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
