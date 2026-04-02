// ...existing code...
const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne }   = require('../config/database');
const { requireAuth }        = require('../middleware/auth');
const { validate, schemas }  = require('../middleware/validate');
const {
  generateUniqueCodes,
  calculateExpiry,
  isVoucherValid,
  secondesRestantes,
  generateTransactionRef,
} = require('../utils/voucher');

/* ═══════════════════════════════════════════════════════
   ROUTES PORTAIL CAPTIF (sans auth requise)
   ═══════════════════════════════════════════════════════ */

/**
 * POST /api/vouchers/validate
 * Valider et activer un code voucher depuis le portail captif
 * ⚡ CRITIQUE — contient la logique de décompte persistant
 */
router.post('/validate', validate(schemas.validateVoucher), async (req, res) => {
  try {
    const { code, mac, borne_id, ip_address } = req.body;

    // 1. Chercher le voucher (insensible à la casse)
    const voucher = await queryOne(
      `SELECT v.*, t.slug AS tarif_slug, t.nom AS tarif_nom,
              t.duree_heures, t.prix_fcfa, t.vitesse_mbps
       FROM vouchers v
       JOIN tarifs t ON t.id = v.tarif_id
       WHERE UPPER(v.code) = UPPER(?)`,
      [code]
    );

    if (!voucher) {
      return res.status(404).json({
        success: false,
        error: 'Code invalide ou introuvable.',
        code_error: 'NOT_FOUND',
      });
    }

    // 2. Vérifier le statut
    if (voucher.statut === 'revoque') {
      return res.status(400).json({
        success: false,
        error: 'Ce code a été révoqué.',
        code_error: 'REVOKED',
      });
    }

    // 3. Si déjà activé — vérifier si toujours valide (décompte persistant)
    if (voucher.statut === 'utilise' && voucher.activated_at) {
      const stillValid = isVoucherValid(voucher.expires_at);

      if (stillValid) {
        // Déjà actif et toujours valide → reconnexion
        const secsLeft = secondesRestantes(voucher.expires_at);

        // Mettre à jour la session si MAC fournie
        if (mac) {
          await query(
            `UPDATE sessions_actives SET last_seen_at=NOW(), borne_id=IFNULL(?,borne_id)
             WHERE voucher_id=? AND statut='active'`,
            [borne_id || null, voucher.id]
          );

          // Si pas de session active, en créer une
          const existingSession = await queryOne(
            "SELECT id FROM sessions_actives WHERE voucher_id=? AND statut='active'",
            [voucher.id]
          );

          if (!existingSession) {
            await _createSession(voucher, mac, ip_address, borne_id);
          }
        }

        return res.json({
          success: true,
          reconnection: true,
          message: 'Code déjà activé — reconnexion en cours.',
          voucher: _formatVoucherResponse(voucher, secsLeft),
        });
      } else {
        // Expiré
        await query(
          "UPDATE vouchers SET statut='expire', updated_at=NOW() WHERE id=?",
          [voucher.id]
        );
        await query(
          "UPDATE sessions_actives SET statut='expiree' WHERE voucher_id=?",
          [voucher.id]
        );
        return res.status(400).json({
          success: false,
          error: 'Ce code est expiré.',
          code_error: 'EXPIRED',
          expired_at: voucher.expires_at,
        });
      }
    }

    // 4. Statut expire (sans activated_at)
    if (voucher.statut === 'expire') {
      return res.status(400).json({
        success: false,
        error: 'Ce code est expiré.',
        code_error: 'EXPIRED',
      });
    }

    // 5. Statut actif → PREMIÈRE ACTIVATION
    // Calculer expires_at à partir de MAINTENANT (décompte commence ici)
    const now       = new Date();
    const expiresAt = calculateExpiry(now, voucher.duree_heures);

    await query(
      `UPDATE vouchers SET
         statut='utilise',
         activated_at=?,
         expires_at=?,
         mac_utilisateur=IFNULL(?,mac_utilisateur),
         ip_utilisateur=IFNULL(?,ip_utilisateur),
         premiere_borne_id=IFNULL(?,premiere_borne_id),
         updated_at=NOW()
       WHERE id=?`,
      [now, expiresAt, mac || null, ip_address || null, borne_id || null, voucher.id]
    );

    // 6. Créer la session active
    if (mac) {
      await _createSession({ ...voucher, expires_at: expiresAt }, mac, ip_address, borne_id);
    }

    const secsLeft = secondesRestantes(expiresAt);

    return res.json({
      success: true,
      reconnection: false,
      message: 'Code activé avec succès. Connexion WiFi autorisée.',
      voucher: _formatVoucherResponse({ ...voucher, expires_at: expiresAt, activated_at: now }, secsLeft),
    });

  } catch (err) {
    console.error('Voucher validate error:', err);
    return res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

/**
 * GET /api/vouchers/status/:code
 * Vérifier le statut en temps réel d'un code (polling portail)
 */
router.get('/status/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    const voucher = await queryOne(
      `SELECT v.statut, v.activated_at, v.expires_at,
              t.slug AS tarif_slug, t.nom AS tarif_nom, t.duree_heures
       FROM vouchers v
       JOIN tarifs t ON t.id = v.tarif_id
       WHERE UPPER(v.code) = ?`,
      [code]
    );

    if (!voucher) {
      return res.status(404).json({ success: false, error: 'Code introuvable.' });
    }

    // Vérifier expiration en temps réel
    if (voucher.statut === 'utilise' && voucher.expires_at && !isVoucherValid(voucher.expires_at)) {
      // Mettre à jour le statut en base
      await query(
        "UPDATE vouchers SET statut='expire', updated_at=NOW() WHERE UPPER(code)=?",
        [code]
      );
      voucher.statut = 'expire';
    }

    const secsLeft = voucher.expires_at ? secondesRestantes(voucher.expires_at) : null;

    return res.json({
      success: true,
      code:       code,
      statut:     voucher.statut,
      tarif:      voucher.tarif_nom,
      tarif_slug: voucher.tarif_slug,
      activated_at: voucher.activated_at,
      expires_at:   voucher.expires_at,
      secondes_restantes: secsLeft,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

/* ═══════════════════════════════════════════════════════
   ROUTES ADMIN (auth requise)
   ═══════════════════════════════════════════════════════ */

/**
 * GET /api/vouchers
 * Liste paginée des vouchers (admin)
 */
router.get('/', requireAuth, validate(schemas.pagination, 'query'), async (req, res) => {
  try {
    const { page, limit, search, statut, type, agent_id } = req.query;
    const offset = (page - 1) * limit;

    let where = ['1=1'];
    let params = [];

    if (search) {
      where.push('(v.code LIKE ? OR a.nom LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (statut) { where.push('v.statut = ?'); params.push(statut); }
    if (type)   { where.push('t.slug = ?');   params.push(type); }
    if (agent_id) { where.push('v.agent_id = ?'); params.push(agent_id); }

    const whereStr = where.join(' AND ');

    const [rows, total] = await Promise.all([
      query(
        `SELECT v.id, v.code, v.statut, v.methode_paiement, v.prix_vente,
                v.commission_agence, v.mac_utilisateur, v.activated_at,
                v.expires_at, v.created_at,
                t.slug AS tarif_slug, t.nom AS tarif_nom,
                a.nom AS agent_nom, a.id AS agent_id,
                b.zone AS borne_zone
         FROM vouchers v
         JOIN tarifs t ON t.id = v.tarif_id
         LEFT JOIN agents a ON a.id = v.agent_id
         LEFT JOIN bornes b ON b.id = v.premiere_borne_id
         WHERE ${whereStr}
         ORDER BY v.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      queryOne(
        `SELECT COUNT(*) AS total
         FROM vouchers v
         JOIN tarifs t ON t.id = v.tarif_id
         LEFT JOIN agents a ON a.id = v.agent_id
         WHERE ${whereStr}`,
        params
      ),
    ]);

    return res.json({
      success: true,
      data:       rows,
      pagination: { page, limit, total: total.total, pages: Math.ceil(total.total / limit) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

/**
 * POST /api/vouchers/generate
 * Générer un lot de vouchers (admin)
 */
router.post('/generate', requireAuth, validate(schemas.generateVouchers), async (req, res) => {
  try {
    const { tarif_slug, quantite, agent_id, methode } = req.body;

    // Récupérer le tarif
    const tarif = await queryOne('SELECT * FROM tarifs WHERE slug = ? AND actif = 1', [tarif_slug]);
    if (!tarif) {
      return res.status(400).json({ success: false, error: 'Tarif introuvable.' });
    }

    // Récupérer les codes existants pour éviter les doublons
    const existingRows = await query('SELECT code FROM vouchers');
    const existingCodes = new Set(existingRows.map(r => r.code));

    // Générer les codes
    const codes   = await generateUniqueCodes(quantite, existingCodes);
    const commission = parseFloat(tarif.prix_fcfa) * 0.12;
    const now     = new Date();
    const created = [];

    // Insérer en batch
    // Règle métier: un voucher généré n'a pas de date d'expiration définie.
    // Le délai commence uniquement lors de la première activation sur le portail captif.
    const values = codes.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',');
    const params = [];
    const voucherIds = [];

    for (const code of codes) {
      const id = uuidv4();
      voucherIds.push(id);
      params.push(
        id,
        code,
        tarif.id,
        'actif',
        null,
        null,
        agent_id || null,
        methode,
        parseFloat(tarif.prix_fcfa),
        commission,
      );
      created.push({ id, code, tarif_slug, tarif_nom: tarif.nom, prix: tarif.prix_fcfa });
    }

    await query(
      `INSERT INTO vouchers (id,code,tarif_id,statut,activated_at,expires_at,agent_id,methode_paiement,prix_vente,commission_agence)
       VALUES ${values}`,
      params
    );

    return res.status(201).json({
      success: true,
      message: `${quantite} voucher(s) ${tarif_slug}(s) générés avec succès.`,
      count:   quantite,
      vouchers: created,
    });
  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erreur serveur.' });
  }
});

/**
 * DELETE /api/vouchers/:id
 * Révoquer un voucher (admin)
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      "UPDATE vouchers SET statut='revoque', updated_at=NOW() WHERE id=? AND statut='actif'",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Voucher introuvable ou non révocable.' });
    }

    return res.json({ success: true, message: 'Voucher révoqué.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

/**
 * GET /api/vouchers/stats
 * Statistiques globales des vouchers
 */
router.get('/stats/summary', requireAuth, async (req, res) => {
  try {
    const stats = await queryOne(`
      SELECT
        COUNT(*)                                      AS total,
        SUM(statut='actif')                          AS actifs,
        SUM(statut='utilise')                        AS utilises,
        SUM(statut='expire')                         AS expires,
        SUM(statut='revoque')                        AS revoques,
        SUM(CASE WHEN statut='utilise' THEN prix_vente ELSE 0 END) AS revenus_total
      FROM vouchers
    `);
    return res.json({ success: true, data: stats });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

/* ── Helpers ─────────────────────────────────────────── */

async function _createSession(voucher, mac, ip, borneId) {
  // Clore les anciennes sessions pour ce MAC
  await query(
    "UPDATE sessions_actives SET statut='terminee' WHERE mac_address=? AND statut='active'",
    [mac]
  );

  const sessId = uuidv4();
  await query(
    `INSERT INTO sessions_actives
       (id,voucher_id,borne_id,mac_address,ip_address,started_at,expires_at,last_seen_at,statut)
     VALUES (?,?,?,?,?,NOW(),?,NOW(),'active')`,
    [sessId, voucher.id, borneId || 'B08', mac, ip || '0.0.0.0', voucher.expires_at]
  );
}

function _formatVoucherResponse(voucher, secsLeft) {
  return {
    code:           voucher.code,
    tarif:          voucher.tarif_nom,
    tarif_slug:     voucher.tarif_slug,
    duree_heures:   voucher.duree_heures,
    prix:           voucher.prix_fcfa,
    vitesse_mbps:   voucher.vitesse_mbps || 5,
    activated_at:   voucher.activated_at,
    expires_at:     voucher.expires_at,
    secondes_restantes: secsLeft,
  };
}

module.exports = router;
