// ===== MOCK DATA — Village Connecté Dioradougou =====

export const BORNES = [
  { id: 'B01', zone: 'Est', type: 'Borne principale', solaire: '20W', mat: '4m', status: 'online', signal: 87, batterie: 78, users: 12, uptime: 99.2, ip: '192.168.1.101', mac: 'AA:BB:CC:01:02:03', lastSeen: new Date(), lat: 7.285, lng: -7.645 },
  { id: 'B02', zone: 'Centre-Est', type: 'Répéteur', solaire: '20W', mat: '4m', status: 'online', signal: 74, batterie: 65, users: 8, uptime: 98.7, ip: '192.168.1.102', mac: 'AA:BB:CC:01:02:04', lastSeen: new Date(), lat: 7.283, lng: -7.648 },
  { id: 'B03', zone: 'Sud', type: 'Répéteur', solaire: '20W', mat: '4m', status: 'online', signal: 81, batterie: 90, users: 6, uptime: 99.8, ip: '192.168.1.103', mac: 'AA:BB:CC:01:02:05', lastSeen: new Date(), lat: 7.280, lng: -7.652 },
  { id: 'B04', zone: 'Centre-Sud', type: 'Nœud central', solaire: '30W', mat: '6m', status: 'online', signal: 92, batterie: 88, users: 18, uptime: 99.9, ip: '192.168.1.104', mac: 'AA:BB:CC:01:02:06', lastSeen: new Date(), lat: 7.281, lng: -7.650 },
  { id: 'B05', zone: 'Centre', type: 'Répéteur', solaire: '20W', mat: '4m', status: 'warning', signal: 45, batterie: 22, users: 3, uptime: 95.1, ip: '192.168.1.105', mac: 'AA:BB:CC:01:02:07', lastSeen: new Date(Date.now() - 300000), lat: 7.283, lng: -7.650 },
  { id: 'B06', zone: 'Centre-Ouest', type: 'Nœud central', solaire: '30W', mat: '6m', status: 'online', signal: 89, batterie: 76, users: 15, uptime: 99.5, ip: '192.168.1.106', mac: 'AA:BB:CC:01:02:08', lastSeen: new Date(), lat: 7.283, lng: -7.652 },
  { id: 'B07', zone: 'Nord-Ouest', type: 'Répéteur', solaire: '20W', mat: '4m', status: 'offline', signal: 0, batterie: 0, users: 0, uptime: 87.3, ip: '192.168.1.107', mac: 'AA:BB:CC:01:02:09', lastSeen: new Date(Date.now() - 3600000), lat: 7.285, lng: -7.654 },
  { id: 'B08', zone: 'Ouest (HUB)', type: 'HUB principal', solaire: '50W', mat: '8m', status: 'online', signal: 98, batterie: 95, users: 24, uptime: 100, ip: '192.168.1.108', mac: 'AA:BB:CC:01:02:10', lastSeen: new Date(), lat: 7.282, lng: -7.655 },
  { id: 'B09', zone: 'Sud-Ouest', type: 'Répéteur', solaire: '20W', mat: '4m', status: 'online', signal: 71, batterie: 68, users: 9, uptime: 98.2, ip: '192.168.1.109', mac: 'AA:BB:CC:01:02:11', lastSeen: new Date(), lat: 7.280, lng: -7.654 },
  { id: 'B10', zone: 'Sud-Est', type: 'Répéteur', solaire: '20W', mat: '4m', status: 'online', signal: 76, batterie: 72, users: 7, uptime: 98.9, ip: '192.168.1.110', mac: 'AA:BB:CC:01:02:12', lastSeen: new Date(), lat: 7.279, lng: -7.648 },
  { id: 'B11', zone: 'Nord-Centre', type: 'Répéteur', solaire: '20W', mat: '4m', status: 'online', signal: 83, batterie: 80, users: 11, uptime: 99.3, ip: '192.168.1.111', mac: 'AA:BB:CC:01:02:13', lastSeen: new Date(), lat: 7.285, lng: -7.650 },
  { id: 'B12', zone: 'Nord', type: 'Répéteur', solaire: '20W', mat: '4m', status: 'online', signal: 69, batterie: 58, users: 5, uptime: 97.8, ip: '192.168.1.112', mac: 'AA:BB:CC:01:02:14', lastSeen: new Date(), lat: 7.286, lng: -7.650 },
  { id: 'B13', zone: 'Extrême-Nord', type: 'Répéteur', solaire: '20W', mat: '4m', status: 'warning', signal: 38, batterie: 18, users: 2, uptime: 93.5, ip: '192.168.1.113', mac: 'AA:BB:CC:01:02:15', lastSeen: new Date(Date.now() - 600000), lat: 7.287, lng: -7.650 },
];

export const AGENTS = [
  { id: 'AGT001', nom: 'Koné Mamadou', email: 'kone.mamadou@villageconnecte.ci', telephone: '+225 07 12 34 56', zone: 'Centre / Est', bornes: ['B01', 'B02', 'B03'], status: 'actif', dateRecrutement: '2024-01-15', commission: 12, vouchersCeMois: 147, revenusCeMois: 29400, revenusTotal: 187500, historiqueVentes: genHistorique(147), avatar: 'KM', color: '#10B981' },
  { id: 'AGT002', nom: 'Traoré Fatoumata', email: 'traore.fatoumata@villageconnecte.ci', telephone: '+225 05 23 45 67', zone: 'Sud / Centre-Sud', bornes: ['B03', 'B04', 'B10'], status: 'actif', dateRecrutement: '2024-02-03', commission: 12, vouchersCeMois: 203, revenusCeMois: 40600, revenusTotal: 243000, historiqueVentes: genHistorique(203), avatar: 'TF', color: '#6366F1' },
  { id: 'AGT003', nom: 'Coulibaly Ibrahim', email: 'coulibaly.ibrahim@villageconnecte.ci', telephone: '+225 01 34 56 78', zone: 'Ouest / Nord-Ouest', bornes: ['B06', 'B07', 'B08'], status: 'actif', dateRecrutement: '2024-01-20', commission: 12, vouchersCeMois: 178, revenusCeMois: 35600, revenusTotal: 215000, historiqueVentes: genHistorique(178), avatar: 'CI', color: '#F59E0B' },
  { id: 'AGT004', nom: 'Diallo Aminata', email: 'diallo.aminata@villageconnecte.ci', telephone: '+225 07 45 67 89', zone: 'Nord / Nord-Centre', bornes: ['B11', 'B12', 'B13'], status: 'actif', dateRecrutement: '2024-03-10', commission: 12, vouchersCeMois: 89, revenusCeMois: 17800, revenusTotal: 98500, historiqueVentes: genHistorique(89), avatar: 'DA', color: '#EC4899' },
  { id: 'AGT005', nom: 'Bamba Seydou', email: 'bamba.seydou@villageconnecte.ci', telephone: '+225 05 56 78 90', zone: 'Centre / Centre-Ouest', bornes: ['B04', 'B05', 'B06'], status: 'inactif', dateRecrutement: '2024-04-05', commission: 12, vouchersCeMois: 0, revenusCeMois: 0, revenusTotal: 45000, historiqueVentes: genHistorique(0), avatar: 'BS', color: '#8B5CF6' },
  { id: 'AGT006', nom: 'Ouattara Mariam', email: 'ouattara.mariam@villageconnecte.ci', telephone: '+225 01 67 89 01', zone: 'Sud-Ouest / Sud', bornes: ['B09', 'B03'], status: 'actif', dateRecrutement: '2024-02-28', commission: 12, vouchersCeMois: 112, revenusCeMois: 22400, revenusTotal: 134000, historiqueVentes: genHistorique(112), avatar: 'OM', color: '#0EA5E9' },
];

function genHistorique(base) {
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  return days.map((jour, i) => ({
    jour,
    ventes: Math.max(0, Math.floor(base / 7 + (Math.random() - 0.5) * 10)),
    revenus: Math.max(0, Math.floor((base / 7) * 200 + (Math.random() - 0.5) * 2000)),
  }));
}

export const VOUCHERS = generateVouchers(200);

function generateVouchers(n) {
  const types = ['journalier', 'hebdomadaire', 'mensuel'];
  const prix = { journalier: 200, hebdomadaire: 1000, mensuel: 3000 };
  const statuts = ['actif', 'utilisé', 'expiré', 'actif', 'actif', 'utilisé'];
  const agentIds = AGENTS.map(a => a.id);
  const results = [];
  for (let i = 0; i < n; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const statut = statuts[Math.floor(Math.random() * statuts.length)];
    const agentId = agentIds[Math.floor(Math.random() * agentIds.length)];
    const agent = AGENTS.find(a => a.id === agentId);
    const d = new Date(Date.now() - Math.random() * 30 * 86400000);
    results.push({
      id: `VC${String(i + 1).padStart(5, '0')}`,
      code: genCode(),
      type,
      prix: prix[type],
      statut,
      agentId,
      agentNom: agent?.nom || '—',
      bornePremierUsage: `B${String(Math.floor(Math.random() * 13) + 1).padStart(2, '0')}`,
      dateCreation: d.toISOString().split('T')[0],
      dateExpiration: new Date(d.getTime() + (type === 'journalier' ? 86400000 : type === 'hebdomadaire' ? 7 * 86400000 : 30 * 86400000)).toISOString().split('T')[0],
      macUtilisateur: statut !== 'actif' ? genMAC() : null,
      paymentMethod: Math.random() > 0.3 ? ['Orange Money', 'MTN', 'Wave', 'Moov'][Math.floor(Math.random() * 4)] : 'Cash',
    });
  }
  return results;
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function genMAC() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join(':');
}

export const TRANSACTIONS = generateTransactions(150);

function generateTransactions(n) {
  const methods = ['Orange Money', 'MTN', 'Wave', 'Moov', 'Cash'];
  const statuts = ['succès', 'succès', 'succès', 'succès', 'échoué', 'en attente'];
  const vouchers = VOUCHERS.filter(v => v.statut === 'utilisé').slice(0, n);
  return vouchers.map((v, i) => ({
    id: `TRX${String(i + 1).padStart(6, '0')}`,
    voucherId: v.id,
    montant: v.prix,
    methode: methods[Math.floor(Math.random() * methods.length)],
    statut: statuts[Math.floor(Math.random() * statuts.length)],
    telephone: `+225 0${Math.floor(Math.random() * 9) + 1} ${String(Math.floor(Math.random() * 9999999)).padStart(7, '0').replace(/(\d{2})(\d{2})(\d{3})/, '$1 $2 $3')}`,
    agentId: v.agentId,
    agentNom: v.agentNom,
    borneId: v.bornePremierUsage,
    date: v.dateCreation,
    cinetpayRef: `CPY${String(Math.floor(Math.random() * 999999)).padStart(8, '0')}`,
  }));
}

export const SESSIONS_ACTIVES = [
  { id: 'S001', mac: '3C:22:FB:A1:B2:C3', ip: '10.0.0.45', borneId: 'B08', borneZone: 'Ouest (HUB)', voucherCode: 'A7K2M9PQ', typePass: 'journalier', heureConnexion: new Date(Date.now() - 45 * 60000), dureeRestante: 19 * 3600 + 15 * 60, debitDown: 2.3, debitUp: 0.8, dataTotal: 124 },
  { id: 'S002', mac: '7A:11:CC:D4:E5:F6', ip: '10.0.0.67', borneId: 'B04', borneZone: 'Centre-Sud', voucherCode: 'B3N7Q2RV', typePass: 'hebdomadaire', heureConnexion: new Date(Date.now() - 120 * 60000), dureeRestante: 6 * 24 * 3600, debitDown: 1.1, debitUp: 0.3, dataTotal: 45 },
  { id: 'S003', mac: '9B:33:DD:55:66:77', ip: '10.0.0.89', borneId: 'B01', borneZone: 'Est', voucherCode: 'C5P8W4TK', typePass: 'journalier', heureConnexion: new Date(Date.now() - 30 * 60000), dureeRestante: 23 * 3600, debitDown: 4.7, debitUp: 1.2, dataTotal: 230 },
  { id: 'S004', mac: 'D4:44:EE:88:99:AA', ip: '10.0.0.23', borneId: 'B06', borneZone: 'Centre-Ouest', voucherCode: 'D9X2L6MN', typePass: 'mensuel', heureConnexion: new Date(Date.now() - 60 * 60000), dureeRestante: 29 * 24 * 3600, debitDown: 0.9, debitUp: 0.2, dataTotal: 567 },
  { id: 'S005', mac: 'E5:55:FF:11:BB:CC', ip: '10.0.0.102', borneId: 'B08', borneZone: 'Ouest (HUB)', voucherCode: 'E1Y7K3PX', typePass: 'journalier', heureConnexion: new Date(Date.now() - 15 * 60000), dureeRestante: 23 * 3600 + 45 * 60, debitDown: 3.2, debitUp: 0.7, dataTotal: 78 },
];

export const ALERTES = [
  { id: 'ALT001', type: 'critical', titre: 'Borne B07 hors ligne', message: 'La borne Nord-Ouest (B07) est déconnectée depuis 1h. Vérifier alimentation solaire.', borneId: 'B07', date: new Date(Date.now() - 3600000), resolue: false },
  { id: 'ALT002', type: 'warning', titre: 'Batterie faible — B13', message: 'Niveau batterie : 18%. Autonomie estimée < 2h. Envoyer agent zone Extrême-Nord.', borneId: 'B13', date: new Date(Date.now() - 600000), resolue: false },
  { id: 'ALT003', type: 'warning', titre: 'Signal faible — B05', message: 'Signal borne Centre (B05) dégradé : -67 dBm. Vérifier orientation antenne.', borneId: 'B05', date: new Date(Date.now() - 300000), resolue: false },
  { id: 'ALT004', type: 'warning', titre: 'Batterie faible — B05', message: 'Niveau batterie : 22%. Ensoleillement insuffisant prévu demain.', borneId: 'B05', date: new Date(Date.now() - 1800000), resolue: false },
  { id: 'ALT005', type: 'info', titre: 'Pic de connexions — B08', message: 'HUB principal : 24 utilisateurs simultanés. Bande passante à 87%.', borneId: 'B08', date: new Date(Date.now() - 900000), resolue: true },
  { id: 'ALT006', type: 'critical', titre: 'Échec paiement CinetPay', message: '3 transactions Orange Money échouées. Vérifier intégration API CinetPay.', borneId: null, date: new Date(Date.now() - 7200000), resolue: true },
];

// Revenue chart data (last 30 days)
export const REVENUS_30J = generateRevenuData(30);
function generateRevenuData(days) {
  const data = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    const base = 15000 + Math.random() * 10000;
    data.push({
      date: label,
      journalier: Math.floor(base * 0.5),
      hebdomadaire: Math.floor(base * 0.3),
      mensuel: Math.floor(base * 0.2),
      total: Math.floor(base),
      connexions: Math.floor(50 + Math.random() * 100),
    });
  }
  return data;
}

// Trafic réseau simulé (dernières 24h)
export const TRAFIC_24H = Array.from({ length: 24 }, (_, i) => ({
  heure: `${String(i).padStart(2, '0')}h`,
  download: Math.floor(5 + Math.random() * 45 * (i >= 7 && i <= 22 ? 1 : 0.2)),
  upload: Math.floor(2 + Math.random() * 15 * (i >= 7 && i <= 22 ? 1 : 0.2)),
  users: Math.floor(5 + Math.random() * 80 * (i >= 7 && i <= 22 ? 1 : 0.1)),
}));

// KPI Summary
export const KPI_SUMMARY = {
  usersConnectes: 127,
  revenusJour: 48600,
  revenusSemaine: 287400,
  revenusMois: 1243000,
  vouchersDuJour: 243,
  vouchersSemaine: 1623,
  agentsActifs: AGENTS.filter(a => a.status === 'actif').length,
  bornesActives: BORNES.filter(b => b.status === 'online').length,
  bornesTotal: BORNES.length,
  bornesOffline: BORNES.filter(b => b.status === 'offline').length,
  alertesActives: ALERTES.filter(a => !a.resolue).length,
  uptimeGlobal: 97.8,
  revenusHier: 45200,
  revenusSemainePassee: 268000,
};

export const TARIFS = [
  { id: 1, nom: 'Journalier', duree: '24h', prix: 200, debit: '5 Mbps', couleur: '#10B981' },
  { id: 2, nom: 'Hebdomadaire', duree: '7 jours', prix: 1000, debit: '5 Mbps', couleur: '#6366F1' },
  { id: 3, nom: 'Mensuel', duree: '30 jours', prix: 3000, debit: '5 Mbps', couleur: '#F59E0B' },
];
