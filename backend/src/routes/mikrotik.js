const express = require('express');
const router = express.Router();
const mikrotik = require('../services/mikrotik');
const sessionExpirationManager = require('../services/session-expiration');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { query } = require('../config/database');

/**
 * GET /api/mikrotik/test
 * Tester la connexion au MikroTik [ADMIN]
 */
router.get('/test', requireAuth, async (req, res) => {
  try {
    const connected = await mikrotik.testConnection();
    return res.json({
      success: true,
      connected,
      enabled: process.env.MIKROTIK_ENABLED === 'true',
      host: process.env.MIKROTIK_HOST || '192.168.88.1',
      message: connected ? 'Connecté au MikroTik ✅' : 'MikroTik indisponible',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/mikrotik/users
 * Lister utilisateurs actifs sur le hotspot [ADMIN]
 */
router.get('/users', requireAuth, async (req, res) => {
  try {
    const users = await mikrotik.getActiveUsers();
    return res.json({
      success: true,
      count: users.length,
      users: users.map(u => ({
        id: u['.id'],
        name: u.name || '-',
        mac: u['mac-address'] || '-',
        ip: u['address'] || '-',
        uptime: u.uptime || '-',
        bytesIn: u['bytes-in'] || 0,
        bytesOut: u['bytes-out'] || 0,
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/mikrotik/authorize
 * Autoriser un utilisateur manuellement [ADMIN]
 * Body: { mac, ip, username? }
 */
router.post('/authorize', requireAuth, async (req, res) => {
  const { mac, ip, username } = req.body;

  if (!mac || !ip) {
    return res.status(400).json({
      success: false,
      error: 'MAC et IP requises',
    });
  }

  try {
    const result = await mikrotik.authorizeUser(mac, ip, username);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/mikrotik/user/:mac
 * Récupérer info utilisateur par MAC [ADMIN]
 */
router.get('/user/:mac', requireAuth, async (req, res) => {
  const { mac } = req.params;

  try {
    const user = await mikrotik.getUserByMac(mac);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé',
      });
    }

    return res.json({
      success: true,
      user: {
        id: user['.id'],
        name: user.name || '-',
        mac: user['mac-address'],
        ip: user['address'],
        uptime: user.uptime || '-',
        bytesIn: user['bytes-in'] || 0,
        bytesOut: user['bytes-out'] || 0,
        loginTime: user['login-time'] || '-',
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/mikrotik/disconnect/:id
 * Déconnecter utilisateur par ID MikroTik [ADMIN]
 */
router.delete('/disconnect/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await mikrotik.disconnectUser(id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/mikrotik/disconnect-mac/:mac
 * Déconnecter utilisateur par MAC [ADMIN]
 */
router.delete('/disconnect-mac/:mac', requireAuth, async (req, res) => {
  const { mac } = req.params;

  try {
    const result = await mikrotik.disconnectUserByMac(mac);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/mikrotik/expiration/stats
 * Obtenir les stats du gestionnaire d'expiration [ADMIN]
 */
router.get('/expiration/stats', requireAuth, async (req, res) => {
  try {
    const stats = await sessionExpirationManager.getStats();
    return res.json({
      success: true,
      stats,
      checkInterval: sessionExpirationManager.checkInterval,
      isRunning: sessionExpirationManager.intervalId !== null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/mikrotik/profiles/sync
 * Synchroniser les profils hotspot (tarifs → MikroTik user profiles) [ADMIN]
 * Crée/met à jour un profil vc-<slug> pour chaque tarif actif.
 */
router.post('/profiles/sync', requireAuth, async (req, res) => {
  try {
    const tarifs = await query('SELECT slug, vitesse_mbps FROM tarifs WHERE actif=1');
    const results = [];
    for (const tarif of tarifs) {
      const result = await mikrotik.ensureHotspotProfile(tarif.slug, Number(tarif.vitesse_mbps) || 5);
      results.push({ slug: tarif.slug, ...result });
    }
    return res.json({ success: true, profiles: results });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/mikrotik/vouchers/sync
 * Pousser tous les vouchers actifs vers la liste hotspot/user de MikroTik [ADMIN]
 * Utile pour la première mise en service ou après un reset du MikroTik.
 */
router.post('/vouchers/sync', requireAuth, async (req, res) => {
  try {
    const vouchers = await query(
      `SELECT v.code, t.slug AS tarif_slug, t.duree_heures, t.vitesse_mbps
       FROM vouchers v
       JOIN tarifs t ON t.id = v.tarif_id
       WHERE v.statut = 'actif'
       ORDER BY v.created_at DESC`,
    );

    // S'assurer que les profils existent d'abord
    const slugsSeen = new Set();
    for (const v of vouchers) {
      if (!slugsSeen.has(v.tarif_slug)) {
        await mikrotik.ensureHotspotProfile(v.tarif_slug, Number(v.vitesse_mbps) || 5);
        slugsSeen.add(v.tarif_slug);
      }
    }

    const result = await mikrotik.syncVouchers(vouchers);
    return res.json({ success: true, total: vouchers.length, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/mikrotik/vouchers/:code
 * Supprimer manuellement un utilisateur hotspot par code [ADMIN]
 */
router.delete('/vouchers/:code', requireAuth, async (req, res) => {
  try {
    const result = await mikrotik.deleteHotspotUser(req.params.code);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
