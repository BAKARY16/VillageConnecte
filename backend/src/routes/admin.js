const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { query, queryOne } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const {
  generateUniqueCodes,
  generateTransactionRef,
} = require('../utils/voucher');

const router = express.Router();

const AGENT_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EC4899', '#0EA5E9', '#8B5CF6'];

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDateYmd(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function paymentDbToUi(value) {
  const map = {
    orange_money: 'Orange Money',
    mtn: 'MTN',
    wave: 'Wave',
    moov: 'Moov',
    cash: 'Cash',
    admin: 'Cash',
  };
  return map[value] || 'Cash';
}

function paymentUiToDb(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('orange')) return 'orange_money';
  if (normalized.includes('mtn')) return 'mtn';
  if (normalized.includes('wave')) return 'wave';
  if (normalized.includes('moov')) return 'moov';
  return 'cash';
}

function voucherStatusDbToUi(value) {
  const map = {
    actif: 'actif',
    utilise: 'utilisé',
    expire: 'expiré',
    revoque: 'expiré',
  };
  return map[value] || 'actif';
}

function txStatusDbToUi(value) {
  const map = {
    succes: 'succès',
    echec: 'échoué',
    en_attente: 'en attente',
    rembourse: 'remboursé',
  };
  return map[value] || 'en attente';
}

function durationLabel(hours) {
  if (hours >= 720) return '30 jours';
  if (hours >= 168) return '7 jours';
  return '24 heures';
}

function avatarFromName(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('');
}

function emailFromName(name, fallbackId) {
  const base = String(name || fallbackId || 'agent')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '');
  return `${base || 'agent'}@villageconnecte.ci`;
}

function mapBorneRow(row) {
  return {
    id: row.id,
    zone: row.zone,
    type: row.type_borne,
    alimentation: row.puissance_solaire ? 'Solaire' : '220V (secteur)',
    rechargeable: row.puissance_solaire ? 'oui' : 'non',
    solaire: row.puissance_solaire,
    mat: row.hauteur_mat,
    status: row.statut,
    signal: toNum(row.signal_pct),
    batterie: toNum(row.batterie_pct),
    users: toNum(row.users_connectes),
    uptime: toNum(row.uptime_pct),
    ip: row.adresse_ip,
    mac: row.adresse_mac,
    lastSeen: row.derniere_vue || row.updated_at || row.created_at,
    lat: row.latitude == null ? null : Number(row.latitude),
    lng: row.longitude == null ? null : Number(row.longitude),
  };
}

function normalizeBornePayload(body = {}) {
  const rawType = body.type_borne || body.type || 'Repeteur';
  const normalizedType = String(rawType)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  let typeBorne = 'Repeteur';
  if (normalizedType.includes('hub')) typeBorne = 'HUB principal';
  else if (normalizedType.includes('noeud') || normalizedType.includes('nœud')) typeBorne = 'Noeud central';
  else if (normalizedType.includes('principale')) typeBorne = 'Borne principale';

  // Values expected by MySQL ENUM in init.sql
  if (typeBorne === 'Repeteur') typeBorne = 'Répéteur';
  if (typeBorne === 'Noeud central') typeBorne = 'Nœud central';

  return {
    zone: body.zone,
    type_borne: typeBorne,
    puissance_solaire: body.puissance_solaire || body.solaire || '20W',
    hauteur_mat: body.hauteur_mat || body.mat || '4m',
    adresse_ip: body.adresse_ip || body.ip || null,
    adresse_mac: body.adresse_mac || body.mac || null,
    latitude: body.latitude ?? body.lat ?? null,
    longitude: body.longitude ?? body.lng ?? null,
    statut: body.statut || body.status || null,
  };
}

function normalizeAgentPayload(body = {}) {
  return {
    nom: body.nom,
    telephone: body.telephone || '',
    zone: body.zone || '',
    statut: body.statut || body.status || 'actif',
    commission_pct: toNum(body.commission_pct ?? body.commission, 12),
    bornes: Array.isArray(body.bornes) ? body.bornes.filter(Boolean) : null,
    email: body.email || null,
  };
}

router.get('/bootstrap', requireAuth, async (req, res) => {
  try {
    const [
      bornesRows,
      agentsRows,
      agentBornesRows,
      agentSalesRows,
      vouchersRows,
      transactionsRows,
      sessionsRows,
      alertesRows,
      tarifsRows,
      sessionsCount,
      revenusJour,
      revenusHier,
      revenusSemaine,
      revenusSemainePassee,
      revenusMois,
      vouchersJour,
      vouchersSemaine,
      agentsActifs,
      bornesOnline,
      bornesOffline,
      bornesTotal,
      alertesActives,
      revenus30jRows,
      trafic24hRows,
      voucherCommandsRows,
    ] = await Promise.all([
      query('SELECT * FROM bornes ORDER BY id ASC'),
      query('SELECT * FROM v_agent_stats ORDER BY revenus_mois DESC'),
      query('SELECT agent_id, borne_id FROM agent_bornes'),
      query(`
        SELECT
          agent_id,
          DATE(created_at) AS day,
          COUNT(*) AS ventes,
          COALESCE(SUM(prix_vente), 0) AS revenus
        FROM vouchers
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY agent_id, DATE(created_at)
      `),
      query(`
        SELECT
          v.id,
          v.code,
          v.statut,
          v.prix_vente,
          v.created_at,
          v.expires_at,
          v.mac_utilisateur,
          v.premiere_borne_id,
          v.agent_id,
          v.methode_paiement,
          t.slug AS tarif_slug,
          a.nom AS agent_nom
        FROM vouchers v
        JOIN tarifs t ON t.id = v.tarif_id
        LEFT JOIN agents a ON a.id = v.agent_id
        ORDER BY v.created_at DESC
      `),
      query(`
        SELECT
          t.id,
          t.reference,
          t.montant,
          t.methode,
          t.statut,
          t.telephone,
          t.created_at,
          a.id AS agent_id,
          a.nom AS agent_nom,
          v.premiere_borne_id AS borne_id
        FROM transactions t
        LEFT JOIN agents a ON a.id = t.agent_id
        LEFT JOIN vouchers v ON v.id = t.voucher_id
        ORDER BY t.created_at DESC
      `),
      query(`
        SELECT
          s.id,
          s.mac_address,
          s.ip_address,
          s.borne_id,
          b.zone AS borne_zone,
          s.started_at,
          s.expires_at,
          s.data_mb_down,
          s.data_mb_up,
          TIMESTAMPDIFF(SECOND, NOW(), s.expires_at) AS secondes_restantes,
          v.code AS voucher_code,
          t.slug AS tarif_slug
        FROM sessions_actives s
        JOIN vouchers v ON v.id = s.voucher_id
        JOIN tarifs t ON t.id = v.tarif_id
        LEFT JOIN bornes b ON b.id = s.borne_id
        WHERE s.statut = 'active' AND s.expires_at > NOW()
        ORDER BY s.started_at DESC
      `),
      query('SELECT * FROM alertes ORDER BY created_at DESC'),
      query('SELECT id, nom, slug, prix_fcfa, duree_heures, vitesse_mbps FROM tarifs WHERE actif=1 ORDER BY prix_fcfa ASC'),
      queryOne("SELECT COUNT(*) AS value FROM sessions_actives WHERE statut='active' AND expires_at > NOW()"),
      queryOne("SELECT COALESCE(SUM(montant),0) AS value FROM transactions WHERE statut='succes' AND DATE(created_at)=CURDATE()"),
      queryOne("SELECT COALESCE(SUM(montant),0) AS value FROM transactions WHERE statut='succes' AND DATE(created_at)=DATE_SUB(CURDATE(), INTERVAL 1 DAY)"),
      queryOne("SELECT COALESCE(SUM(montant),0) AS value FROM transactions WHERE statut='succes' AND YEARWEEK(created_at,1)=YEARWEEK(CURDATE(),1)"),
      queryOne("SELECT COALESCE(SUM(montant),0) AS value FROM transactions WHERE statut='succes' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND created_at < DATE_SUB(CURDATE(), INTERVAL 7 DAY)"),
      queryOne("SELECT COALESCE(SUM(montant),0) AS value FROM transactions WHERE statut='succes' AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())"),
      queryOne('SELECT COUNT(*) AS value FROM vouchers WHERE DATE(created_at)=CURDATE()'),
      queryOne('SELECT COUNT(*) AS value FROM vouchers WHERE YEARWEEK(created_at,1)=YEARWEEK(CURDATE(),1)'),
      queryOne("SELECT COUNT(*) AS value FROM agents WHERE statut='actif'"),
      queryOne("SELECT COUNT(*) AS value FROM bornes WHERE statut='online'"),
      queryOne("SELECT COUNT(*) AS value FROM bornes WHERE statut='offline'"),
      queryOne('SELECT COUNT(*) AS value FROM bornes'),
      queryOne('SELECT COUNT(*) AS value FROM alertes WHERE resolue=0'),
      query(`
        SELECT
          DATE(created_at) AS day,
          COALESCE(SUM(CASE WHEN statut='succes' THEN montant ELSE 0 END),0) AS total
        FROM transactions
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `),
      query(`
        SELECT
          HOUR(started_at) AS heure,
          COUNT(*) AS users
        FROM sessions_actives
        WHERE started_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY HOUR(started_at)
        ORDER BY heure ASC
      `),
      query(`
        SELECT
          v.agent_id,
          a.nom AS agent_nom,
          v.methode_paiement,
          t.slug AS tarif_slug,
          COUNT(*) AS count,
          COALESCE(SUM(v.prix_vente),0) AS total_value,
          MAX(v.created_at) AS created_at
        FROM vouchers v
        LEFT JOIN agents a ON a.id = v.agent_id
        JOIN tarifs t ON t.id = v.tarif_id
        WHERE v.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY v.agent_id, a.nom, v.methode_paiement, t.slug, DATE(v.created_at)
        ORDER BY MAX(v.created_at) DESC
        LIMIT 12
      `),
    ]);

    const bornes = bornesRows.map(mapBorneRow);

    const bornesByAgent = {};
    for (const row of agentBornesRows) {
      if (!bornesByAgent[row.agent_id]) bornesByAgent[row.agent_id] = [];
      bornesByAgent[row.agent_id].push(row.borne_id);
    }

    const salesByAgentDay = {};
    for (const row of agentSalesRows) {
      const key = `${row.agent_id}|${formatDateYmd(row.day)}`;
      salesByAgentDay[key] = {
        ventes: toNum(row.ventes),
        revenus: toNum(row.revenus),
      };
    }

    const dayRange = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return {
        key: formatDateYmd(date),
        label: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
      };
    });

    const agents = agentsRows.map((agent, index) => ({
      id: agent.id,
      nom: agent.nom,
      email: emailFromName(agent.nom, agent.id),
      telephone: agent.telephone,
      zone: agent.zone || '',
      bornes: bornesByAgent[agent.id] || [],
      status: agent.statut,
      dateRecrutement: formatDateYmd(agent.date_recrutement),
      commission: toNum(agent.commission_pct, 12),
      vouchersCeMois: toNum(agent.vouchers_mois),
      revenusCeMois: toNum(agent.revenus_mois),
      revenusTotal: toNum(agent.revenus_total),
      historiqueVentes: dayRange.map(day => {
        const key = `${agent.id}|${day.key}`;
        return {
          jour: day.label,
          ventes: salesByAgentDay[key]?.ventes || 0,
          revenus: salesByAgentDay[key]?.revenus || 0,
        };
      }),
      avatar: avatarFromName(agent.nom),
      color: AGENT_COLORS[index % AGENT_COLORS.length],
    }));

    const vouchers = vouchersRows.map(voucher => ({
      id: voucher.id,
      code: voucher.code,
      type: voucher.tarif_slug,
      prix: toNum(voucher.prix_vente),
      statut: voucherStatusDbToUi(voucher.statut),
      agentId: voucher.agent_id || null,
      agentNom: voucher.agent_nom || '-',
      bornePremierUsage: voucher.premiere_borne_id || '-',
      dateCreation: formatDateYmd(voucher.created_at),
      dateExpiration: formatDateYmd(voucher.expires_at),
      macUtilisateur: voucher.mac_utilisateur || null,
      paymentMethod: paymentDbToUi(voucher.methode_paiement),
    }));

    const transactions = transactionsRows.map(tx => ({
      id: tx.reference || tx.id,
      montant: toNum(tx.montant),
      methode: paymentDbToUi(tx.methode),
      statut: txStatusDbToUi(tx.statut),
      telephone: tx.telephone || '',
      agentId: tx.agent_id || null,
      agentNom: tx.agent_nom || '-',
      borneId: tx.borne_id || '-',
      date: formatDateYmd(tx.created_at),
    }));

    const sessions = sessionsRows.map(session => ({
      id: session.id,
      mac: session.mac_address,
      ip: session.ip_address,
      borneId: session.borne_id,
      borneZone: session.borne_zone || '-',
      voucherCode: session.voucher_code,
      typePass: session.tarif_slug,
      heureConnexion: session.started_at,
      dureeRestante: Math.max(0, toNum(session.secondes_restantes)),
      debitDown: Math.max(1, Math.round(toNum(session.data_mb_down) / 10) || 5),
      debitUp: Math.max(1, Math.round(toNum(session.data_mb_up) / 10) || 1),
      dataTotal: Math.round(toNum(session.data_mb_down)),
    }));

    const alertes = alertesRows.map(alert => ({
      id: alert.id,
      type: alert.type_alerte,
      titre: alert.titre,
      message: alert.message,
      borneId: alert.borne_id,
      date: alert.created_at,
      resolue: Boolean(alert.resolue),
    }));

    const tarifs = tarifsRows.map(tarif => ({
      id: tarif.id,
      slug: tarif.slug,
      nom: tarif.nom,
      duree: durationLabel(toNum(tarif.duree_heures)),
      prix: toNum(tarif.prix_fcfa),
      debit: `${toNum(tarif.vitesse_mbps, 5)} Mbps`,
    }));

    const stats = {
      revenus30j: revenus30jRows.map(row => ({
        date: formatDateYmd(row.day),
        total: toNum(row.total),
      })),
      trafic24h: trafic24hRows.map(row => ({
        heure: `${String(row.heure).padStart(2, '0')}h`,
        users: toNum(row.users),
      })),
    };

    const voucherCommands = voucherCommandsRows.map((row, index) => ({
      id: `CMD${String(index + 1).padStart(3, '0')}`,
      agentId: row.agent_id,
      agentNom: row.agent_nom || 'Systeme',
      type: row.tarif_slug,
      count: toNum(row.count),
      paymentMethod: paymentDbToUi(row.methode_paiement),
      totalValue: toNum(row.total_value),
      createdAt: row.created_at,
    }));

    const kpis = {
      usersConnectes: toNum(sessionsCount?.value),
      revenusJour: toNum(revenusJour?.value),
      revenusHier: toNum(revenusHier?.value),
      revenusSemaine: toNum(revenusSemaine?.value),
      revenusSemainePassee: toNum(revenusSemainePassee?.value),
      revenusMois: toNum(revenusMois?.value),
      vouchersDuJour: toNum(vouchersJour?.value),
      vouchersSemaine: toNum(vouchersSemaine?.value),
      agentsActifs: toNum(agentsActifs?.value),
      bornesActives: toNum(bornesOnline?.value),
      bornesTotal: toNum(bornesTotal?.value),
      bornesOffline: toNum(bornesOffline?.value),
      alertesActives: toNum(alertesActives?.value),
      uptimeGlobal: 97.8,
    };

    return res.json({
      bornes,
      agents,
      vouchers,
      transactions,
      sessions,
      alertes,
      kpis,
      voucherCommands,
      tarifs,
      stats,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Bootstrap impossible',
    });
  }
});

router.post('/bornes', requireAuth, async (req, res) => {
  try {
    const payload = normalizeBornePayload(req.body);
    if (!payload.zone) {
      return res.status(400).json({ error: 'Zone requise' });
    }

    const last = await queryOne("SELECT MAX(CAST(SUBSTRING(id,2) AS UNSIGNED)) AS max_id FROM bornes");
    const nextId = `B${String((toNum(last?.max_id, 0) + 1)).padStart(2, '0')}`;

    await query(
      `INSERT INTO bornes (
        id, zone, type_borne, puissance_solaire, hauteur_mat,
        adresse_ip, adresse_mac, latitude, longitude, statut
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nextId,
        payload.zone,
        payload.type_borne,
        payload.puissance_solaire,
        payload.hauteur_mat,
        payload.adresse_ip,
        payload.adresse_mac,
        payload.latitude,
        payload.longitude,
        payload.statut || 'offline',
      ],
    );

    return res.status(201).json({ success: true, id: nextId });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Creation borne impossible' });
  }
});

router.put('/bornes/:id', requireAuth, async (req, res) => {
  try {
    const existing = await queryOne('SELECT * FROM bornes WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Borne introuvable' });

    const payload = normalizeBornePayload(req.body);
    await query(
      `UPDATE bornes
       SET zone=?, type_borne=?, puissance_solaire=?, hauteur_mat=?,
           adresse_ip=?, adresse_mac=?, latitude=?, longitude=?,
           statut=COALESCE(?, statut), updated_at=NOW()
       WHERE id=?`,
      [
        payload.zone || existing.zone,
        payload.type_borne || existing.type_borne,
        payload.puissance_solaire || existing.puissance_solaire,
        payload.hauteur_mat || existing.hauteur_mat,
        payload.adresse_ip ?? existing.adresse_ip,
        payload.adresse_mac ?? existing.adresse_mac,
        payload.latitude ?? existing.latitude,
        payload.longitude ?? existing.longitude,
        payload.statut,
        req.params.id,
      ],
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Mise a jour borne impossible' });
  }
});

router.delete('/bornes/:id', requireAuth, async (req, res) => {
  try {
    await query('DELETE FROM bornes WHERE id=?', [req.params.id]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Suppression borne impossible' });
  }
});

router.post('/agents', requireAuth, async (req, res) => {
  try {
    const payload = normalizeAgentPayload(req.body);
    if (!payload.nom) return res.status(400).json({ error: 'Nom requis' });

    const last = await queryOne("SELECT MAX(CAST(SUBSTRING(id,4) AS UNSIGNED)) AS max_id FROM agents");
    const nextId = `AGT${String((toNum(last?.max_id, 0) + 1)).padStart(3, '0')}`;

    await query(
      `INSERT INTO agents (id, nom, telephone, zone, statut, commission_pct)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nextId, payload.nom, payload.telephone, payload.zone, payload.statut, payload.commission_pct],
    );

    if (payload.bornes?.length) {
      for (const borneId of payload.bornes) {
        await query('INSERT IGNORE INTO agent_bornes (agent_id, borne_id) VALUES (?, ?)', [nextId, borneId]);
      }
    }

    return res.status(201).json({ success: true, id: nextId });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Creation agent impossible' });
  }
});

router.put('/agents/:id', requireAuth, async (req, res) => {
  try {
    const existing = await queryOne('SELECT * FROM agents WHERE id=?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Agent introuvable' });

    const payload = normalizeAgentPayload(req.body);
    await query(
      `UPDATE agents
       SET nom=?, telephone=?, zone=?, statut=?, commission_pct=?, updated_at=NOW()
       WHERE id=?`,
      [
        payload.nom || existing.nom,
        payload.telephone || existing.telephone,
        payload.zone ?? existing.zone,
        payload.statut || existing.statut,
        payload.commission_pct ?? existing.commission_pct,
        req.params.id,
      ],
    );

    if (payload.bornes) {
      await query('DELETE FROM agent_bornes WHERE agent_id=?', [req.params.id]);
      for (const borneId of payload.bornes) {
        await query('INSERT IGNORE INTO agent_bornes (agent_id, borne_id) VALUES (?, ?)', [req.params.id, borneId]);
      }
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Mise a jour agent impossible' });
  }
});

router.delete('/agents/:id', requireAuth, async (req, res) => {
  try {
    await query("UPDATE agents SET statut='inactif', updated_at=NOW() WHERE id=?", [req.params.id]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Suppression agent impossible' });
  }
});

router.post('/alertes/:id/resolve', requireAuth, async (req, res) => {
  try {
    await query(
      'UPDATE alertes SET resolue=1, resolue_at=NOW(), resolue_par=?, updated_at=NOW() WHERE id=?',
      [req.admin.id, req.params.id],
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Resolution impossible' });
  }
});

router.post('/sessions/:id/disconnect', requireAuth, async (req, res) => {
  try {
    await query(
      "UPDATE sessions_actives SET statut='forcee', last_seen_at=NOW() WHERE id=?",
      [req.params.id],
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Deconnexion impossible' });
  }
});

router.post('/vouchers/generate', requireAuth, async (req, res) => {
  try {
    const type = String(req.body.type || '').toLowerCase();
    const count = Math.max(1, Math.min(500, toNum(req.body.count, 1)));
    const agentId = req.body.agentId || null;
    const paymentMethod = paymentUiToDb(req.body.paymentMethod);

    if (!['journalier', 'hebdomadaire', 'mensuel'].includes(type)) {
      return res.status(400).json({ error: 'Type de voucher invalide' });
    }

    const tarif = await queryOne('SELECT * FROM tarifs WHERE slug=? AND actif=1', [type]);
    if (!tarif) return res.status(400).json({ error: 'Tarif introuvable' });

    const existingRows = await query('SELECT code FROM vouchers');
    const existingCodes = new Set(existingRows.map(row => row.code));
    const codes = await generateUniqueCodes(count, existingCodes);

    const commission = toNum(tarif.prix_fcfa) * 0.12;
    const created = [];

    for (const code of codes) {
      const voucherId = uuidv4();
      await query(
        `INSERT INTO vouchers
          (id, code, tarif_id, statut, agent_id, methode_paiement, prix_vente, commission_agence)
         VALUES (?, ?, ?, 'actif', ?, ?, ?, ?)`,
        [voucherId, code, tarif.id, agentId, paymentMethod, toNum(tarif.prix_fcfa), commission],
      );

      const reference = generateTransactionRef();
      await query(
        `INSERT INTO transactions
          (id, reference, voucher_id, agent_id, montant, methode, statut, telephone)
         VALUES (?, ?, ?, ?, ?, ?, 'succes', NULL)`,
        [uuidv4(), reference, voucherId, agentId, toNum(tarif.prix_fcfa), paymentMethod],
      );

      created.push({
        id: voucherId,
        code,
        type,
        prix: toNum(tarif.prix_fcfa),
      });
    }

    return res.status(201).json({ success: true, vouchers: created });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Generation impossible' });
  }
});

router.post('/vouchers/:id/reactivate', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `UPDATE vouchers
       SET statut='actif',
           activated_at=NULL,
           expires_at=NULL,
           mac_utilisateur=NULL,
           ip_utilisateur=NULL,
           premiere_borne_id=NULL,
           updated_at=NOW()
       WHERE id=?`,
      [req.params.id],
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Voucher introuvable' });

    await query("UPDATE sessions_actives SET statut='terminee' WHERE voucher_id=? AND statut='active'", [req.params.id]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Reactivation impossible' });
  }
});

router.delete('/vouchers/:id', requireAuth, async (req, res) => {
  try {
    const result = await query('DELETE FROM vouchers WHERE id=?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Voucher introuvable' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Suppression voucher impossible' });
  }
});

module.exports = router;
