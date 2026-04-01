/* =====================================================
   ROUTES AGRÉGÉES — agents, bornes, sessions,
   transactions, dashboard, alertes, tarifs
   ===================================================== */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');
const { requireAuth }      = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { generateTransactionRef } = require('../utils/voucher');

/* ══════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════ */
const dashboardRouter = express.Router();

dashboardRouter.get('/kpis', requireAuth, async (req, res) => {
  try {
    const kpis = await queryOne('SELECT * FROM v_kpis');

    // Revenus hier pour comparaison
    const hier = await queryOne(`
      SELECT COALESCE(SUM(montant),0) AS montant
      FROM transactions
      WHERE statut='succes' AND DATE(created_at)=DATE_SUB(CURDATE(),INTERVAL 1 DAY)
    `);

    // Bornes totales
    const bornesTotal = await queryOne('SELECT COUNT(*) AS total FROM bornes');

    return res.json({
      success: true,
      data: {
        ...kpis,
        revenus_hier:   parseFloat(hier.montant),
        bornes_total:   bornesTotal.total,
        uptime_global:  97.8,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

dashboardRouter.get('/revenus', requireAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const rows = await query(`
      SELECT
        DATE(created_at) AS date,
        SUM(CASE WHEN statut='succes' THEN montant ELSE 0 END) AS total,
        COUNT(CASE WHEN statut='succes' THEN 1 END) AS transactions
      FROM transactions
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [parseInt(days)]);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

dashboardRouter.get('/connexions', requireAuth, async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        HOUR(started_at) AS heure,
        COUNT(*) AS connexions
      FROM sessions_actives
      WHERE started_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY HOUR(started_at)
      ORDER BY heure ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   BORNES
   ══════════════════════════════════════════════════════ */
const bornesRouter = express.Router();

bornesRouter.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM bornes ORDER BY id ASC'
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

bornesRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const borne = await queryOne('SELECT * FROM bornes WHERE id=?', [req.params.id]);
    if (!borne) return res.status(404).json({ success: false, error: 'Borne introuvable.' });

    // Sessions actives sur cette borne
    const sessions = await query(
      `SELECT s.id, s.mac_address, s.ip_address, s.started_at,
              s.expires_at, s.data_mb_down, s.data_mb_up,
              v.code AS voucher_code, t.nom AS tarif_nom
       FROM sessions_actives s
       JOIN vouchers v ON v.id=s.voucher_id
       JOIN tarifs   t ON t.id=v.tarif_id
       WHERE s.borne_id=? AND s.statut='active' AND s.expires_at>NOW()`,
      [req.params.id]
    );

    return res.json({ success: true, data: { ...borne, sessions } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

bornesRouter.post('/', requireAuth, validate(schemas.upsertBorne), async (req, res) => {
  try {
    const { zone, type_borne, puissance_solaire, hauteur_mat, adresse_ip, adresse_mac, latitude, longitude } = req.body;

    // Générer prochain ID borne
    const last = await queryOne("SELECT id FROM bornes ORDER BY id DESC LIMIT 1");
    let nextNum = 1;
    if (last) {
      const num = parseInt(last.id.replace('B', ''));
      nextNum = num + 1;
    }
    const newId = `B${String(nextNum).padStart(2,'0')}`;

    await query(
      `INSERT INTO bornes (id,zone,type_borne,puissance_solaire,hauteur_mat,adresse_ip,adresse_mac,latitude,longitude)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [newId, zone, type_borne, puissance_solaire, hauteur_mat, adresse_ip||null, adresse_mac||null, latitude||null, longitude||null]
    );

    const borne = await queryOne('SELECT * FROM bornes WHERE id=?', [newId]);
    return res.status(201).json({ success: true, data: borne });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

bornesRouter.put('/:id', requireAuth, validate(schemas.upsertBorne), async (req, res) => {
  try {
    const { zone, type_borne, puissance_solaire, hauteur_mat, adresse_ip, adresse_mac, latitude, longitude } = req.body;
    await query(
      `UPDATE bornes SET zone=?,type_borne=?,puissance_solaire=?,hauteur_mat=?,
              adresse_ip=?,adresse_mac=?,latitude=?,longitude=?,updated_at=NOW()
       WHERE id=?`,
      [zone, type_borne, puissance_solaire, hauteur_mat, adresse_ip||null, adresse_mac||null, latitude||null, longitude||null, req.params.id]
    );
    const borne = await queryOne('SELECT * FROM bornes WHERE id=?', [req.params.id]);
    return res.json({ success: true, data: borne });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Mise à jour statut borne (appelée par la borne elle-même ou l'admin)
bornesRouter.patch('/:id/status', requireAuth, validate(schemas.borneStatus), async (req, res) => {
  try {
    const { statut, signal_pct, batterie_pct, users_connectes } = req.body;
    await query(
      `UPDATE bornes SET
         statut=?,
         signal_pct=IFNULL(?,signal_pct),
         batterie_pct=IFNULL(?,batterie_pct),
         users_connectes=IFNULL(?,users_connectes),
         derniere_vue=NOW(),
         updated_at=NOW()
       WHERE id=?`,
      [statut, signal_pct??null, batterie_pct??null, users_connectes??null, req.params.id]
    );
    return res.json({ success: true, message: 'Statut borne mis à jour.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

bornesRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    await query('DELETE FROM bornes WHERE id=?', [req.params.id]);
    return res.json({ success: true, message: 'Borne supprimée.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   AGENTS
   ══════════════════════════════════════════════════════ */
const agentsRouter = express.Router();

agentsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const agents = await query('SELECT * FROM v_agent_stats ORDER BY revenus_mois DESC');
    // Bornes par agent
    const agentBornes = await query(
      'SELECT agent_id, borne_id FROM agent_bornes'
    );
    const bornesMap = {};
    agentBornes.forEach(ab => {
      if (!bornesMap[ab.agent_id]) bornesMap[ab.agent_id] = [];
      bornesMap[ab.agent_id].push(ab.borne_id);
    });
    const result = agents.map(a => ({ ...a, bornes: bornesMap[a.id] || [] }));
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

agentsRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const agent = await queryOne('SELECT * FROM v_agent_stats WHERE id=?', [req.params.id]);
    if (!agent) return res.status(404).json({ success: false, error: 'Agent introuvable.' });

    const bornes = await query('SELECT borne_id FROM agent_bornes WHERE agent_id=?', [req.params.id]);
    const ventes = await query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS ventes, SUM(prix_vente) AS revenus
       FROM vouchers WHERE agent_id=? AND created_at >= DATE_SUB(CURDATE(),INTERVAL 30 DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`,
      [req.params.id]
    );

    return res.json({
      success: true,
      data: {
        ...agent,
        bornes: bornes.map(b => b.borne_id),
        historique_ventes: ventes,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

agentsRouter.post('/', requireAuth, validate(schemas.upsertAgent), async (req, res) => {
  try {
    const { nom, telephone, zone, statut, commission_pct, bornes } = req.body;

    const last = await queryOne("SELECT id FROM agents ORDER BY id DESC LIMIT 1");
    let nextNum = 1;
    if (last) nextNum = parseInt(last.id.replace('AGT','')) + 1;
    const newId = `AGT${String(nextNum).padStart(3,'0')}`;

    await query(
      'INSERT INTO agents (id,nom,telephone,zone,statut,commission_pct) VALUES (?,?,?,?,?,?)',
      [newId, nom, telephone, zone||'', statut, commission_pct]
    );

    // Affectation bornes
    if (bornes?.length) {
      for (const bid of bornes) {
        await query('INSERT IGNORE INTO agent_bornes (agent_id,borne_id) VALUES (?,?)', [newId, bid]);
      }
    }

    const agent = await queryOne('SELECT * FROM agents WHERE id=?', [newId]);
    return res.status(201).json({ success: true, data: agent });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

agentsRouter.put('/:id', requireAuth, validate(schemas.upsertAgent), async (req, res) => {
  try {
    const { nom, telephone, zone, statut, commission_pct, bornes } = req.body;
    await query(
      'UPDATE agents SET nom=?,telephone=?,zone=?,statut=?,commission_pct=?,updated_at=NOW() WHERE id=?',
      [nom, telephone, zone||'', statut, commission_pct, req.params.id]
    );

    // Réaffecter les bornes
    await query('DELETE FROM agent_bornes WHERE agent_id=?', [req.params.id]);
    if (bornes?.length) {
      for (const bid of bornes) {
        await query('INSERT IGNORE INTO agent_bornes (agent_id,borne_id) VALUES (?,?)', [req.params.id, bid]);
      }
    }

    const agent = await queryOne('SELECT * FROM agents WHERE id=?', [req.params.id]);
    return res.json({ success: true, data: agent });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

agentsRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    await query('UPDATE agents SET statut=? WHERE id=?', ['inactif', req.params.id]);
    return res.json({ success: true, message: 'Agent désactivé.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   SESSIONS ACTIVES
   ══════════════════════════════════════════════════════ */
const sessionsRouter = express.Router();

sessionsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const sessions = await query('SELECT * FROM v_sessions_actives ORDER BY started_at DESC');
    return res.json({ success: true, data: sessions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

sessionsRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    await query(
      "UPDATE sessions_actives SET statut='forcee', updated_at=NOW() WHERE id=?",
      [req.params.id]
    );
    return res.json({ success: true, message: 'Session déconnectée de force.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Heartbeat session (portail captif)
sessionsRouter.post('/heartbeat', async (req, res) => {
  try {
    const { mac, borne_id } = req.body;
    if (!mac) return res.status(400).json({ success: false, error: 'MAC requis.' });

    const session = await queryOne(
      "SELECT s.*, TIMESTAMPDIFF(SECOND,NOW(),s.expires_at) AS secs_left FROM sessions_actives s WHERE s.mac_address=? AND s.statut='active' AND s.expires_at>NOW()",
      [mac]
    );

    if (!session) {
      return res.json({ success: false, authorized: false, message: 'Session expirée ou inexistante.' });
    }

    await query(
      'UPDATE sessions_actives SET last_seen_at=NOW(), borne_id=IFNULL(?,borne_id) WHERE id=?',
      [borne_id||null, session.id]
    );

    return res.json({
      success: true,
      authorized: true,
      secondes_restantes: session.secs_left,
      expires_at: session.expires_at,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   TRANSACTIONS
   ══════════════════════════════════════════════════════ */
const transactionsRouter = express.Router();

transactionsRouter.get('/', requireAuth, validate(schemas.pagination, 'query'), async (req, res) => {
  try {
    const { page, limit, search, statut, agent_id } = req.query;
    const offset = (page - 1) * limit;

    let where = ['1=1'];
    let params = [];
    if (search) {
      where.push('(t.reference LIKE ? OR t.telephone LIKE ? OR a.nom LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (statut)   { where.push('t.statut=?');    params.push(statut); }
    if (agent_id) { where.push('t.agent_id=?');  params.push(agent_id); }

    const whereStr = where.join(' AND ');

    const [rows, total] = await Promise.all([
      query(
        `SELECT t.id, t.reference, t.montant, t.methode, t.statut,
                t.telephone, t.created_at,
                a.nom AS agent_nom, a.id AS agent_id,
                v.code AS voucher_code, tar.nom AS tarif_nom
         FROM transactions t
         LEFT JOIN agents  a   ON a.id = t.agent_id
         LEFT JOIN vouchers v  ON v.id = t.voucher_id
         LEFT JOIN tarifs  tar ON tar.id = v.tarif_id
         WHERE ${whereStr}
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM transactions t LEFT JOIN agents a ON a.id=t.agent_id WHERE ${whereStr}`,
        params
      ),
    ]);

    return res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total: total.total, pages: Math.ceil(total.total / limit) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

transactionsRouter.get('/analytics', requireAuth, async (req, res) => {
  try {
    const byMethod = await query(`
      SELECT methode, COUNT(*) AS nb, SUM(CASE WHEN statut='succes' THEN montant ELSE 0 END) AS total
      FROM transactions GROUP BY methode ORDER BY total DESC
    `);
    const byAgent = await query(`
      SELECT a.nom AS agent, a.id AS agent_id,
             COUNT(t.id) AS nb,
             SUM(CASE WHEN t.statut='succes' THEN t.montant ELSE 0 END) AS total
      FROM transactions t JOIN agents a ON a.id=t.agent_id
      GROUP BY a.id ORDER BY total DESC
    `);
    return res.json({ success: true, data: { by_method: byMethod, by_agent: byAgent } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   ALERTES
   ══════════════════════════════════════════════════════ */
const alertesRouter = express.Router();

alertesRouter.get('/', requireAuth, async (req, res) => {
  try {
    const { resolue } = req.query;
    let where = '1=1';
    const params = [];
    if (resolue !== undefined) { where += ' AND a.resolue=?'; params.push(resolue === 'true' ? 1 : 0); }
    const rows = await query(
      `SELECT a.*, b.zone AS borne_zone FROM alertes a LEFT JOIN bornes b ON b.id=a.borne_id WHERE ${where} ORDER BY a.created_at DESC`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

alertesRouter.patch('/:id/resolve', requireAuth, async (req, res) => {
  try {
    await query(
      'UPDATE alertes SET resolue=1, resolue_at=NOW(), resolue_par=?, updated_at=NOW() WHERE id=?',
      [req.admin.id, req.params.id]
    );
    return res.json({ success: true, message: 'Alerte résolue.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

alertesRouter.post('/', requireAuth, async (req, res) => {
  try {
    const { type_alerte, titre, message, borne_id } = req.body;
    await query(
      'INSERT INTO alertes (type_alerte,titre,message,borne_id) VALUES (?,?,?,?)',
      [type_alerte, titre, message, borne_id||null]
    );
    return res.status(201).json({ success: true, message: 'Alerte créée.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   TARIFS
   ══════════════════════════════════════════════════════ */
const tarifsRouter = express.Router();

tarifsRouter.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM tarifs WHERE actif=1 ORDER BY prix_fcfa ASC');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

tarifsRouter.put('/:id', requireAuth, async (req, res) => {
  try {
    const { prix_fcfa, vitesse_mbps } = req.body;
    await query(
      'UPDATE tarifs SET prix_fcfa=?,vitesse_mbps=?,updated_at=NOW() WHERE id=?',
      [prix_fcfa, vitesse_mbps||5, req.params.id]
    );
    const tarif = await queryOne('SELECT * FROM tarifs WHERE id=?', [req.params.id]);
    return res.json({ success: true, data: tarif });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = {
  dashboardRouter,
  bornesRouter,
  agentsRouter,
  sessionsRouter,
  transactionsRouter,
  alertesRouter,
  tarifsRouter,
};
