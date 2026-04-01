/**
 * =====================================================
 * SERVICE API — Portail Captif
 * Remplace PortalContext mockData par l'API réelle
 * =====================================================
 *
 * USAGE dans village-connecte-portal:
 *   Copier dans src/services/api.js
 *   Définir REACT_APP_API_URL=http://localhost:3001
 *   (ou l'IP de votre serveur)
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  return data;
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  return res.json();
}

/**
 * Valider un code voucher
 * POST /api/vouchers/validate
 *
 * @param {string} code     - Code saisi par l'utilisateur (ex: ABC12345)
 * @param {string} mac      - Adresse MAC de l'appareil
 * @param {string} borneId  - ID de la borne WiFi actuelle
 * @param {string} ip       - IP de l'appareil
 *
 * @returns {
 *   success: boolean,
 *   reconnection: boolean,     // true si déjà activé (reprend le décompte)
 *   voucher: {
 *     code, tarif, tarif_slug, duree_heures,
 *     prix, vitesse_mbps, activated_at,
 *     expires_at, secondes_restantes
 *   },
 *   error?: string,
 *   code_error?: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED'
 * }
 */
export async function validateVoucher({ code, mac, borneId, ip }) {
  return post('/api/vouchers/validate', {
    code:       code.trim().toUpperCase(),
    mac:        mac        || undefined,
    borne_id:   borneId    || undefined,
    ip_address: ip         || undefined,
  });
}

/**
 * Vérifier le statut temps réel d'un voucher (polling)
 * GET /api/vouchers/status/:code
 *
 * @returns {
 *   success, code, statut, tarif, tarif_slug,
 *   activated_at, expires_at, secondes_restantes
 * }
 */
export async function getVoucherStatus(code) {
  return get(`/api/vouchers/status/${code.toUpperCase()}`);
}

/**
 * Heartbeat session (envoyer régulièrement pour garder la session active)
 * POST /api/sessions/heartbeat
 *
 * @returns { success, authorized, secondes_restantes, expires_at }
 */
export async function sessionHeartbeat({ mac, borneId }) {
  return post('/api/sessions/heartbeat', {
    mac,
    borne_id: borneId || undefined,
  });
}

/**
 * Récupérer les tarifs disponibles
 * GET /api/tarifs
 */
export async function getTarifs() {
  return get('/api/tarifs');
}

/**
 * Initier un paiement Mobile Money (via CinetPay)
 * POST /api/payments/init
 * (À implémenter côté backend quand CinetPay est configuré)
 *
 * Pour l'instant retourne une réponse simulée
 */
export async function initPayment({ tarif_slug, methode, telephone, borneId }) {
  // En production: appel CinetPay via le backend
  // return post('/api/payments/init', { tarif_slug, methode, telephone, borne_id: borneId });

  // Simulation temporaire (à remplacer par le vrai appel)
  await new Promise(r => setTimeout(r, 1500));
  const code = Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*34)]).join('');
  return {
    success: true,
    ref: `CPY${Date.now().toString().slice(-8)}`,
    code,
    message: 'Paiement confirmé. Code généré.',
  };
}

/**
 * Vérifier le health de l'API
 */
export async function healthCheck() {
  return get('/health');
}
