'use strict';

const { RouterOSAPI } = require('node-routeros');

function normalizeMac(value) {
  const cleaned = String(value || '').trim().replace(/-/g, ':').toUpperCase();
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(cleaned)) return null;
  return cleaned;
}

class MikroTikManager {
  constructor() {
    // Pas de cache de connexion — connexion fraîche par opération
    this.lastFailedConnectAt = 0;
    // 15 secondes de cooldown après échec (était 60s)
    this.connectCooldownMs = parseInt(process.env.MIKROTIK_CONNECT_COOLDOWN_MS || '15000', 10);
    this.config = {
      host:     process.env.MIKROTIK_HOST     || '192.168.88.1',
      user:     process.env.MIKROTIK_USER     || 'api-user',
      password: process.env.MIKROTIK_PASSWORD || '',
      port:     parseInt(process.env.MIKROTIK_PORT || '8728'),
      // 8 secondes max par opération (était 30s)
      timeout:  parseInt(process.env.MIKROTIK_TIMEOUT_SECONDS || '8', 10),
    };
    this.enabled = process.env.MIKROTIK_ENABLED === 'true';
  }

  /**
   * Connexion fraîche par opération.
   * Crée une nouvelle connexion, exécute fn(conn), ferme la connexion.
   * Évite les connexions périmées (RouterOS ferme les connexions inactives après ~30s).
   */
  async withConnection(fn) {
    if (this.lastFailedConnectAt) {
      const elapsed = Date.now() - this.lastFailedConnectAt;
      if (elapsed < this.connectCooldownMs) {
        const wait = Math.ceil((this.connectCooldownMs - elapsed) / 1000);
        console.warn(`⚠️ MikroTik indisponible - nouvelle tentative dans ${wait}s`);
        return null;
      }
    }
    const conn = new RouterOSAPI(this.config);
    let connected = false;
    try {
      await conn.connect();
      connected = true;
      this.lastFailedConnectAt = 0;
      return await fn(conn);
    } catch (err) {
      this.lastFailedConnectAt = Date.now();
      throw err;
    } finally {
      if (connected) { try { conn.close(); } catch (_e) {} }
    }
  }

  // ── Autorisation ──────────────────────────────────────────────────────────

  async authorizeUser(mac, ip, username = null) {
    if (!this.enabled) return { success: true, mikrotik: false, message: 'MikroTik désactivé' };
    try {
      return await this.withConnection(async (conn) => {
        const formattedMac = normalizeMac(mac);
        if (!formattedMac) throw new Error('Adresse MAC invalide');
        const params = [`=mac-address=${formattedMac}`, `=ip-address=${ip}`];
        if (username) params.push(`=user=${username}`);
        await conn.write('/ip/hotspot/active/login', params);
        console.log(`✅ MikroTik: Utilisateur autorisé ${mac} (${ip})`);
        return { success: true, mikrotik: true, mac, ip };
      });
    } catch (err) {
      console.error(`❌ MikroTik: Erreur autorisation ${mac}:`, err.message);
      return { success: false, mikrotik: true, error: err.message };
    }
  }

  // ── Lecture sessions actives ──────────────────────────────────────────────

  async getActiveUsers() {
    if (!this.enabled) return [];
    try {
      return await this.withConnection(async (conn) => conn.write('/ip/hotspot/active/print')) || [];
    } catch (err) {
      console.error('❌ MikroTik: Erreur lecture utilisateurs actifs:', err.message);
      return [];
    }
  }

  async getUserByMac(mac) {
    if (!this.enabled) return null;
    try {
      return await this.withConnection(async (conn) => {
        const formattedMac = normalizeMac(mac);
        if (!formattedMac) return null;
        const sessions = await conn.write('/ip/hotspot/active/print', [`?mac-address=${formattedMac}`]);
        return sessions && sessions.length > 0 ? sessions[0] : null;
      });
    } catch (err) {
      console.error(`❌ MikroTik: Erreur recherche MAC ${mac}:`, err.message);
      return null;
    }
  }

  async getActiveSessionByUser(code) {
    if (!this.enabled) return null;
    try {
      return await this.withConnection(async (conn) => {
        const sessions = await conn.write('/ip/hotspot/active/print', [
          `?user=${String(code).toUpperCase()}`,
        ]);
        return sessions && sessions.length > 0 ? sessions[0] : null;
      });
    } catch (err) {
      console.error(`❌ MikroTik: getActiveSessionByUser(${code}):`, err.message);
      return null;
    }
  }

  // ── Déconnexion ───────────────────────────────────────────────────────────

  async disconnectUser(id) {
    if (!this.enabled) return { success: true, mikrotik: false, message: 'MikroTik désactivé' };
    try {
      return await this.withConnection(async (conn) => {
        await conn.write('/ip/hotspot/active/remove', [`=.id=${id}`]);
        console.log(`✅ MikroTik: Session déconnectée (ID: ${id})`);
        return { success: true, mikrotik: true };
      });
    } catch (err) {
      console.error(`❌ MikroTik: Erreur déconnexion ${id}:`, err.message);
      return { success: false, mikrotik: true, error: err.message };
    }
  }

  async disconnectUserByMac(mac) {
    if (!this.enabled) return { success: true, mikrotik: false, message: 'MikroTik désactivé' };
    try {
      return await this.withConnection(async (conn) => {
        const formattedMac = normalizeMac(mac);
        if (!formattedMac) return { success: false, error: 'MAC invalide' };
        const sessions = await conn.write('/ip/hotspot/active/print', [`?mac-address=${formattedMac}`]);
        if (!sessions || sessions.length === 0) {
          return { success: true, mikrotik: true, sessionsRemoved: 0 };
        }
        for (const s of sessions) await conn.write('/ip/hotspot/active/remove', [`=.id=${s['.id']}`]);
        console.log(`✅ MikroTik: ${sessions.length} session(s) fermée(s) pour MAC ${mac}`);
        return { success: true, mikrotik: true, sessionsRemoved: sessions.length };
      });
    } catch (err) {
      console.error(`❌ MikroTik: Erreur déconnexion MAC ${mac}:`, err.message);
      return { success: false, mikrotik: true, error: err.message };
    }
  }

  async disconnectUserByUsername(username) {
    if (!this.enabled) return { success: true, mikrotik: false, message: 'MikroTik désactivé' };
    try {
      return await this.withConnection(async (conn) => {
        const upperCode = String(username).toUpperCase();
        const sessions = await conn.write('/ip/hotspot/active/print', [`?user=${upperCode}`]);
        if (!sessions || sessions.length === 0) {
          console.log(`ℹ️ MikroTik: Aucune session active pour user ${upperCode}`);
          return { success: true, mikrotik: true, sessionsRemoved: 0 };
        }
        for (const s of sessions) await conn.write('/ip/hotspot/active/remove', [`=.id=${s['.id']}`]);
        console.log(`✅ MikroTik: ${sessions.length} session(s) fermée(s) pour user ${upperCode}`);
        return { success: true, mikrotik: true, sessionsRemoved: sessions.length };
      });
    } catch (err) {
      console.error(`❌ MikroTik: Erreur déconnexion user ${username}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  // ── Test ──────────────────────────────────────────────────────────────────

  async testConnection() {
    if (!this.enabled) return false;
    try {
      const result = await this.withConnection(async (conn) => {
        const identity = await conn.write('/system/identity/print');
        console.log('✅ Test MikroTik réussi:', identity[0]?.name || 'MikroTik');
        return true;
      });
      return result === true;
    } catch (err) {
      console.error('❌ Test MikroTik échoué:', err.message);
      return false;
    }
  }

  // ── Profils ───────────────────────────────────────────────────────────────

  async ensureHotspotProfile(slug, vitesseMbps) {
    if (!this.enabled) return { success: true, mikrotik: false, message: 'MikroTik désactivé' };
    try {
      return await this.withConnection(async (conn) => {
        const profileName = `vc-${slug}`;
        const rateLimit = vitesseMbps > 0 ? `${vitesseMbps}M/${vitesseMbps}M` : null;
        const existing = await conn.write('/ip/hotspot/user/profile/print', [`?name=${profileName}`]);
        if (existing && existing.length > 0) {
          if (rateLimit) {
            await conn.write('/ip/hotspot/user/profile/set', [
              `=.id=${existing[0]['.id']}`,
              `=rate-limit=${rateLimit}`,
            ]);
          }
          console.log(`ℹ️ MikroTik: Profil mis à jour: ${profileName}`);
          return { success: true, mikrotik: true, profileName, created: false };
        }
        const params = [`=name=${profileName}`];
        if (rateLimit) params.push(`=rate-limit=${rateLimit}`);
        await conn.write('/ip/hotspot/user/profile/add', params);
        console.log(`✅ MikroTik: Profil créé: ${profileName}`);
        return { success: true, mikrotik: true, profileName, created: true };
      });
    } catch (err) {
      console.error(`❌ MikroTik: Erreur profil ${slug}:`, err.message);
      return { success: false, mikrotik: true, error: err.message };
    }
  }

  // ── Gestion utilisateurs hotspot ──────────────────────────────────────────

  async createHotspotUser(code, slug = 'default', dureeHeures = 0) {
    if (!this.enabled) return { success: true, mikrotik: false, message: 'MikroTik désactivé' };
    try {
      return await this.withConnection(async (conn) => {
        const upperCode = String(code).toUpperCase();
        const profileName = slug && slug !== 'default' ? `vc-${slug}` : 'default';

        const existing = await conn.write('/ip/hotspot/user/print', [`?name=${upperCode}`]);
        if (existing && existing.length > 0) {
          console.log(`ℹ️ MikroTik: Utilisateur déjà existant: ${upperCode}`);
          return { success: true, mikrotik: true, created: false };
        }

        const buildParams = (profile) => {
          const p = [`=name=${upperCode}`, `=password=${upperCode}`, `=profile=${profile}`];
          if (dureeHeures > 0) {
            const h = Math.floor(dureeHeures);
            const m = Math.round((dureeHeures - h) * 60);
            p.push(`=limit-uptime=${h}h${m}m0s`);
          }
          return p;
        };

        try {
          await conn.write('/ip/hotspot/user/add', buildParams(profileName));
          console.log(`✅ MikroTik: Utilisateur créé: ${upperCode} (profil: ${profileName})`);
        } catch (profileErr) {
          if (String(profileErr.message).includes('does not match any value of profile')) {
            console.warn(`⚠️ Profil '${profileName}' introuvable, fallback 'default' pour ${upperCode}`);
            await conn.write('/ip/hotspot/user/add', buildParams('default'));
            console.log(`✅ MikroTik: Utilisateur créé: ${upperCode} (profil: default)`);
          } else {
            throw profileErr;
          }
        }
        return { success: true, mikrotik: true, created: true };
      });
    } catch (err) {
      console.error(`❌ MikroTik: Erreur création utilisateur ${code}:`, err.message);
      return { success: false, mikrotik: true, error: err.message };
    }
  }

  async deleteHotspotUser(code) {
    if (!this.enabled) return { success: true, mikrotik: false, message: 'MikroTik désactivé' };
    try {
      return await this.withConnection(async (conn) => {
        const upperCode = String(code).toUpperCase();
        const users = await conn.write('/ip/hotspot/user/print', [`?name=${upperCode}`]);
        if (!users || users.length === 0) {
          return { success: true, mikrotik: true, deleted: false, message: 'Utilisateur introuvable' };
        }
        for (const u of users) await conn.write('/ip/hotspot/user/remove', [`=.id=${u['.id']}`]);
        console.log(`✅ MikroTik: Utilisateur supprimé: ${upperCode}`);
        return { success: true, mikrotik: true, deleted: true };
      });
    } catch (err) {
      console.error(`❌ MikroTik: Erreur suppression utilisateur ${code}:`, err.message);
      return { success: false, mikrotik: true, error: err.message };
    }
  }

  /**
   * Supprimer TOUS les utilisateurs hotspot (reset complet avant resync).
   */
  async clearAllHotspotUsers() {
    if (!this.enabled) return { success: true, mikrotik: false, deleted: 0 };
    try {
      return await this.withConnection(async (conn) => {
        const users = await conn.write('/ip/hotspot/user/print');
        if (!users || users.length === 0) {
          console.log('ℹ️ MikroTik: Aucun utilisateur hotspot à supprimer');
          return { success: true, mikrotik: true, deleted: 0 };
        }
        for (const u of users) await conn.write('/ip/hotspot/user/remove', [`=.id=${u['.id']}`]);
        console.log(`✅ MikroTik: ${users.length} utilisateur(s) supprimé(s)`);
        return { success: true, mikrotik: true, deleted: users.length };
      });
    } catch (err) {
      console.error('❌ MikroTik: Erreur clearAllHotspotUsers:', err.message);
      return { success: false, mikrotik: true, error: err.message };
    }
  }

  /**
   * Déconnecter TOUTES les sessions actives MikroTik.
   */
  async clearAllActiveSessions() {
    if (!this.enabled) return { success: true, mikrotik: false, removed: 0 };
    try {
      return await this.withConnection(async (conn) => {
        const sessions = await conn.write('/ip/hotspot/active/print');
        if (!sessions || sessions.length === 0) {
          return { success: true, mikrotik: true, removed: 0 };
        }
        for (const s of sessions) await conn.write('/ip/hotspot/active/remove', [`=.id=${s['.id']}`]);
        console.log(`✅ MikroTik: ${sessions.length} session(s) active(s) fermée(s)`);
        return { success: true, mikrotik: true, removed: sessions.length };
      });
    } catch (err) {
      console.error('❌ MikroTik: Erreur clearAllActiveSessions:', err.message);
      return { success: false, mikrotik: true, error: err.message };
    }
  }

  // ── Sync en lot ───────────────────────────────────────────────────────────

  async syncVouchers(vouchers) {
    if (!this.enabled) return { success: true, mikrotik: false, synced: 0, errors: 0 };
    let synced = 0;
    let errors = 0;
    for (const v of vouchers) {
      try {
        const result = await this.createHotspotUser(
          v.code,
          v.tarif_slug || 'default',
          Number(v.duree_heures) || 0,
        );
        if (result && result.success) synced++;
        else errors++;
      } catch (_err) {
        errors++;
      }
    }
    console.log(`✅ MikroTik sync: ${synced} traités, ${errors} erreurs`);
    return { success: true, mikrotik: true, synced, errors };
  }
}

// Export singleton
module.exports = new MikroTikManager();
