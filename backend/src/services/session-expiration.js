/**
 * Service de gestion des expirations de sessions
 * Déconnecte automatiquement les utilisateurs MikroTik à l'expiration
 */

const { query, queryOne } = require('../config/database');
const mikrotik = require('./mikrotik');

class SessionExpirationManager {
  constructor() {
    this.checkInterval = parseInt(process.env.SESSION_EXPIRY_CHECK_MS || '30000'); // 30s
    this.intervalId = null;
    this.running = false;
  }

  /**
   * Démarrer la vérification périodique des sessions et vouchers expirés
   */
  start() {
    console.log(
      `📋 SessionExpirationManager: Vérification toutes les ${this.checkInterval}ms`
    );

    this.intervalId = setInterval(() => {
      this.checkAndExpireSessions().catch((err) => {
        console.error('❌ Erreur vérification sessions expirées:', err);
      });
      this.checkAndExpireVouchers().catch((err) => {
        console.error('❌ Erreur vérification vouchers expirés:', err);
      });
    }, this.checkInterval);
  }

  /**
   * Arrêter la vérification
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 SessionExpirationManager: Arrêté');
    }
  }

  /**
   * Vérifier et expirer les sessions
   */
  async checkAndExpireSessions() {
    if (this.running) {
      console.warn('⚠️ SessionExpirationManager: cycle déjà en cours, passage ignoré');
      return;
    }

    this.running = true;
    try {
      // Récupérer toutes les sessions actives qui sont expirées (avec le code voucher)
      const expiredSessions = await query(
        `SELECT
          s.id,
          s.voucher_id,
          s.mac_address,
          s.expires_at,
          TIMESTAMPDIFF(SECOND, NOW(), s.expires_at) AS secondes_restantes,
          v.code AS voucher_code
        FROM sessions_actives s
        LEFT JOIN vouchers v ON v.id = s.voucher_id
        WHERE s.statut = 'active' AND s.expires_at <= NOW()`
      );

      if (expiredSessions.length === 0) return;

      console.log(
        `⏰ ${expiredSessions.length} session(s) expirée(s) à traiter`
      );

      let closedCount = 0;
      let alreadyMissingCount = 0;

      for (const session of expiredSessions) {
        try {
          // Marquer la session comme expirée en DB
          await query(
            "UPDATE sessions_actives SET statut='expiree', last_seen_at=NOW() WHERE id=?",
            [session.id]
          );

          // Déconnecter la session active MikroTik (par MAC)
          if (session.mac_address) {
            const result = await mikrotik.disconnectUserByMac(session.mac_address);
            if (result.success) {
              if (result.sessionsRemoved > 0) {
                closedCount += 1;
                console.log(
                  `✅ Session expirée fermée: ${session.voucher_id} (MAC: ${session.mac_address})`
                );
              } else {
                alreadyMissingCount += 1;
              }
            } else {
              console.warn(
                `⚠️ Impossible de déconnecter MAC ${session.mac_address}: ${result.error}`
              );
            }
          }

          // Supprimer l'utilisateur hotspot MikroTik pour bloquer toute reconnexion
          // Sans ça, le user peut se reconnecter après expiration car son entrée
          // /ip/hotspot/user persiste et MikroTik l'authentifie sans passer par notre backend.
          if (process.env.MIKROTIK_ENABLED === 'true' && session.voucher_code) {
            try {
              await mikrotik.deleteHotspotUser(session.voucher_code);
              console.log(`🗑️ User hotspot MikroTik supprimé: ${session.voucher_code}`);
            } catch (err) {
              console.warn(`⚠️ Impossible de supprimer user hotspot ${session.voucher_code}:`, err.message);
            }
          }
        } catch (err) {
          console.error(
            `❌ Erreur traitement session ${session.id}:`,
            err.message
          );
        }
      }

      if (closedCount > 0 && alreadyMissingCount > 0) {
        console.log(
          `✅ ${closedCount} session(s) MikroTik fermée(s) pendant ce cycle, ${alreadyMissingCount} déjà absente(s)`
        );
      } else if (closedCount > 0) {
        console.log(`✅ ${closedCount} session(s) MikroTik fermée(s) pendant ce cycle`);
      }
    } catch (err) {
      console.error(
        '❌ Erreur dans checkAndExpireSessions:',
        err.message
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Vérifier les vouchers expirés : marquer en DB + supprimer dans MikroTik
   */
  async checkAndExpireVouchers() {
    try {
      // Vouchers activés/utilisés dont la date d'expiration est passée
      const expiredVouchers = await query(
        `SELECT v.id, v.code, t.slug as tarif_slug
         FROM vouchers v
         LEFT JOIN tarifs t ON t.id = v.tarif_id
         WHERE v.statut IN ('actif', 'utilise')
           AND v.expires_at IS NOT NULL
           AND v.expires_at <= NOW()`
      );

      if (expiredVouchers.length === 0) return;

      console.log(`⏰ ${expiredVouchers.length} voucher(s) expiré(s) à traiter`);

      for (const v of expiredVouchers) {
        try {
          // Marquer comme expiré en DB (garde l'historique)
          await query(
            "UPDATE vouchers SET statut='expire', updated_at=NOW() WHERE id=?",
            [v.id]
          );

          // Supprimer l'utilisateur hotspot dans MikroTik
          if (process.env.MIKROTIK_ENABLED === 'true') {
            const result = await mikrotik.deleteHotspotUser(v.code);
            if (result.success && result.deleted) {
              console.log(`✅ Voucher expiré supprimé de MikroTik: ${v.code}`);
            }
          }
        } catch (err) {
          console.error(`❌ Erreur expiration voucher ${v.code}:`, err.message);
        }
      }
    } catch (err) {
      console.error('❌ Erreur dans checkAndExpireVouchers:', err.message);
    }
  }

  /**
   * Obtenir stats expiration
   */
  async getStats() {
    try {
      const stats = await queryOne(
        `SELECT
          COUNT(*) as total_sessions,
          SUM(CASE WHEN statut='active' AND expires_at > NOW() THEN 1 ELSE 0 END) as active_sessions,
          SUM(CASE WHEN expires_at <= NOW() THEN 1 ELSE 0 END) as expired_sessions,
          SUM(CASE WHEN statut='expiree' THEN 1 ELSE 0 END) as already_closed
        FROM sessions_actives`
      );
      return stats || {};
    } catch (err) {
      console.error('❌ Erreur getStats:', err.message);
      return {};
    }
  }
}

module.exports = new SessionExpirationManager();
