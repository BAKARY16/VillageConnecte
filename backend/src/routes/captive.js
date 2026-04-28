const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { query, queryOne } = require('../config/database');
const {
  generateUniqueCodes,
  calculateExpiry,
  isVoucherValid,
  secondesRestantes,
  generateTransactionRef,
} = require('../utils/voucher');
const mikrotik = require('../services/mikrotik');

const router = express.Router();
const realtimeBySession = new Map();
const countersBySession = new Map();

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCode(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function normalizeMac(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/-/g, ':')
    .toUpperCase();
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(cleaned)) return null;
  return cleaned;
}

function normalizeIp(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  return raw;
}

function extractIpFromRequest(req) {
  const headerForwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)[0];

  return (
    normalizeIp(req.body?.ipAddress) ||
    normalizeIp(req.body?.ip_address) ||
    normalizeIp(headerForwarded) ||
    normalizeIp(req.ip) ||
    normalizeIp(req.connection?.remoteAddress) ||
    '0.0.0.0'
  );
}

function extractMacFromRequest(req) {
  return (
    normalizeMac(req.body?.macAddress) ||
    normalizeMac(req.body?.mac) ||
    normalizeMac(req.headers['x-client-mac']) ||
    null
  );
}

function derivePseudoMacFromIp(ipAddress) {
  const ip = normalizeIp(ipAddress);
  if (!ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  const parts = ip.split('.').map(Number);
  if (parts.some(part => part < 0 || part > 255 || !Number.isInteger(part))) return null;
  const hex = parts.map(part => part.toString(16).padStart(2, '0').toUpperCase());
  return `02:00:${hex[0]}:${hex[1]}:${hex[2]}:${hex[3]}`;
}

function getBearerToken(req) {
  const auth = String(req.headers.authorization || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
}

function isMetricsIngestAuthorized(req) {
  const expected = String(process.env.METRICS_INGEST_TOKEN || '').trim();
  if (!expected) return true;
  const provided = String(req.headers['x-ingest-token'] || '').trim() || getBearerToken(req);
  return Boolean(provided) && provided === expected;
}

function toMbFromBytes(bytes) {
  return +(toNum(bytes, 0) / (1024 * 1024)).toFixed(3);
}

function setRealtimeRates(sessionId, downMbps, upMbps, source = 'collector') {
  const entry = {
    downMbps: Math.max(0, toNum(downMbps, 0)),
    upMbps: Math.max(0, toNum(upMbps, 0)),
    source,
    ts: Date.now(),
  };
  realtimeBySession.set(sessionId, entry);
  return entry;
}

/**
 * Parse une chaîne uptime MikroTik (ex: "1d2h30m20s", "00:01:30") en secondes
 */
function parseUptimeToSeconds(uptime) {
  if (!uptime) return 0;
  const str = String(uptime).trim();
  // Format HH:MM:SS
  if (/^\d{2}:\d{2}:\d{2}$/.test(str)) {
    const parts = str.split(':').map(Number);
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  // Format Nd Nh Nm Ns
  let total = 0;
  const d = str.match(/(\d+)d/); if (d) total += parseInt(d[1], 10) * 86400;
  const h = str.match(/(\d+)h/); if (h) total += parseInt(h[1], 10) * 3600;
  const m = str.match(/(\d+)m/); if (m) total += parseInt(m[1], 10) * 60;
  const s = str.match(/(\d+)s/); if (s) total += parseInt(s[1], 10);
  return total;
}

function getRealtimeRates(sessionId) {
  const realtime = realtimeBySession.get(sessionId);
  if (!realtime) return { downMbps: 0, upMbps: 0, source: 'none' };
  if (Date.now() - realtime.ts > 30000) return { downMbps: 0, upMbps: 0, source: 'stale' };
  return realtime;
}

function computeRatesFromCounters(sessionId, rxBytes, txBytes) {
  const now = Date.now();
  const prev = countersBySession.get(sessionId);
  countersBySession.set(sessionId, { rxBytes, txBytes, ts: now });

  if (!prev) return { downMbps: null, upMbps: null };
  const deltaSec = (now - prev.ts) / 1000;
  if (!Number.isFinite(deltaSec) || deltaSec <= 0) return { downMbps: null, upMbps: null };

  const downMbps = ((rxBytes - prev.rxBytes) * 8) / (deltaSec * 1000000);
  const upMbps = ((txBytes - prev.txBytes) * 8) / (deltaSec * 1000000);

  return {
    downMbps: Number.isFinite(downMbps) ? Math.max(0, +downMbps.toFixed(3)) : null,
    upMbps: Number.isFinite(upMbps) ? Math.max(0, +upMbps.toFixed(3)) : null,
  };
}

function paymentUiToDb(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('orange')) return 'orange_money';
  if (normalized.includes('mtn')) return 'mtn';
  if (normalized.includes('wave')) return 'wave';
  if (normalized.includes('moov')) return 'moov';
  return 'cash';
}

function mapDbMethodToFedapayChannel(value) {
  const map = {
    orange_money: 'orange_money',
    mtn: 'mtn_momo',
    wave: 'wave',
    moov: 'moov_money',
    cash: 'cash',
  };
  return map[value] || 'cash';
}

function getFedapayApiBase() {
  const explicit = String(process.env.FEDAPAY_API_BASE || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const env = String(process.env.FEDAPAY_ENVIRONMENT || '').trim().toLowerCase();
  if (env === 'live' || env === 'production') return 'https://api.fedapay.com';
  return 'https://sandbox-api.fedapay.com';
}

function getFedapayPublicKey() {
  return String(process.env.FEDAPAY_PUBLIC_KEY || process.env.FEDAPAY_API_KEY || '').trim();
}

function getFedapayCheckoutMode(value) {
  const mode = String(value || process.env.FEDAPAY_CHECKOUT_MODE || 'redirect').trim().toLowerCase();
  return mode === 'embedded' ? 'embedded' : 'redirect';
}

async function fedapayRequest(path, method, body) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch indisponible côté backend. Utilisez Node.js 18+');
  }

  const secretKey = String(process.env.FEDAPAY_SECRET_KEY || process.env.FEDAPAY_API_KEY || '').trim();
  if (!secretKey) {
    throw new Error('FEDAPAY_SECRET_KEY (ou FEDAPAY_API_KEY) manquante dans .env');
  }
  if (secretKey.startsWith('pk_')) {
    throw new Error('Cle FedaPay invalide: utilisez une cle secrete sk_... dans FEDAPAY_SECRET_KEY (pk_... va dans FEDAPAY_PUBLIC_KEY)');
  }

  const url = getFedapayApiBase() + path;
  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const remoteMessage = payload.message || payload.error || payload.description || '';
    throw new Error(remoteMessage || `FedaPay HTTP ${resp.status}`);
  }

  return payload;
}

async function createFedapayCheckout(params) {
  const transactionPayload = {
    description: params.description,
    amount: params.amount,
    callback_url: params.callbackUrl,
    merchant_reference: params.reference,
    custom_metadata: {
      payment_ref: params.reference,
    },
    currency: { iso: params.currencyIso || 'XOF' },
  };

  const created = await fedapayRequest('/v1/transactions', 'POST', transactionPayload);
  const tx = created['v1/transaction'] || created.transaction || created.data || created;
  const txId = tx && tx.id;
  if (!txId) throw new Error('FedaPay transaction créée sans identifiant');

  const tokenData = await fedapayRequest(`/v1/transactions/${encodeURIComponent(txId)}/token`, 'POST', {});
  const paymentUrl = tokenData.url || (tokenData.data && tokenData.data.url) || '';
  const token = tokenData.token || (tokenData.data && tokenData.data.token) || '';
  if (!paymentUrl) throw new Error('FedaPay n\'a pas retourné d\'URL de paiement');

  return {
    transactionId: txId,
    transactionRef: tx.reference || null,
    paymentUrl,
    token,
  };
}

function getBackendPublicBase(req) {
  const explicit = String(process.env.BACKEND_PUBLIC_BASE_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  if (!host) return 'http://127.0.0.1:3001';

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').trim().toLowerCase();
  const proto = forwardedProto === 'https' ? 'https' : 'http';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function normalizeReturnUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) return '';
  return raw;
}

function parseJsonSafe(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (error) {
    return fallback;
  }
}

function getTarifPriceFcfa(tarif) {
  const amount = toNum(tarif?.prix_fcfa, NaN);
  if (Number.isFinite(amount) && amount > 0) return Math.round(amount);
  const fallback = toNum(tarif?.prix_vente, NaN);
  if (Number.isFinite(fallback) && fallback > 0) return Math.round(fallback);
  return 0;
}

function extractFedapayStatus(remoteTx = {}) {
  const direct = remoteTx?.status || remoteTx?.state;
  if (typeof direct === 'string') return direct;

  const nested = remoteTx?.status?.name
    || remoteTx?.status?.value
    || remoteTx?.status?.status
    || remoteTx?.status?.code
    || remoteTx?.status?.slug
    || remoteTx?.state?.name
    || remoteTx?.state?.value
    || remoteTx?.state?.status
    || remoteTx?.state?.code
    || remoteTx?.state?.slug;
  if (typeof nested === 'string') return nested;

  return '';
}

function mapFedapayStatusToLocal(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'en_attente';

  const successStatuses = new Set([
    'approved',
    'completed',
    'successful',
    'success',
    'paid',
    'settled',
    'authorized',
    'authorised',
    'transferred',
    'accepted',
    'validated',
  ]);
  const failedStatuses = new Set(['declined', 'canceled', 'cancelled', 'failed', 'refused', 'expired', 'rejected']);

  if (successStatuses.has(normalized)) return 'succes';
  if (failedStatuses.has(normalized)) return 'echec';
  return 'en_attente';
}

async function fetchFedapayTransactionById(transactionId) {
  const payload = await fedapayRequest(`/v1/transactions/${encodeURIComponent(transactionId)}`, 'GET');
  const tx = payload['v1/transaction'] || payload.transaction || payload.data || payload;
  return tx || null;
}

async function createVoucherAfterPayment({ tarif, methode }) {
  const tarifPrice = getTarifPriceFcfa(tarif);

  const existingRows = await query('SELECT code FROM vouchers');
  const existingCodes = new Set(existingRows.map(row => row.code));
  const [code] = await generateUniqueCodes(1, existingCodes);
  const voucherId = uuidv4();

  await query(
    `INSERT INTO vouchers
      (id, code, tarif_id, statut, methode_paiement, prix_vente, commission_agence)
     VALUES (?, ?, ?, 'actif', ?, ?, ?)`,
    [voucherId, code, tarif.id, methode, tarifPrice, tarifPrice * 0.12],
  );

  if (process.env.MIKROTIK_ENABLED === 'true') {
    mikrotik.ensureHotspotProfile(tarif.slug, toNum(tarif.vitesse_mbps, 5))
      .then(() => mikrotik.createHotspotUser(code, tarif.slug, toNum(tarif.duree_heures, 24), { upsert: true }))
      .catch(err => console.error('MikroTik push voucher error:', err.message));
  }

  return {
    id: voucherId,
    code,
    type: tarif.slug,
    prix: tarifPrice,
    duree: toNum(tarif.duree_heures, 24),
    dureeLabel: durationLabel(toNum(tarif.duree_heures, 24)),
    vitesse: `${toNum(tarif.vitesse_mbps, 5)} Mbps`,
  };
}

async function finalizePaymentReference(reference, trustedRemoteStatus = null) {
  const tx = await queryOne(
    `SELECT id, reference, voucher_id, montant, methode, statut, telephone, cinetpay_transaction_id, cinetpay_data
     FROM transactions
     WHERE reference=?
     LIMIT 1`,
    [reference],
  );

  if (!tx) return { found: false, statut: 'echoue', error: 'Transaction introuvable', remoteStatus: null };

  if (tx.voucher_id) {
    const voucher = await queryOne(
      `SELECT v.id, v.code, t.slug AS tarif_slug, t.prix_fcfa, t.duree_heures, t.vitesse_mbps
       FROM vouchers v
       JOIN tarifs t ON t.id = v.tarif_id
       WHERE v.id=?
       LIMIT 1`,
      [tx.voucher_id],
    );
    return {
      found: true,
      statut: tx.statut,
      ref: tx.reference,
      remoteStatus: null,
      code: voucher?.code || null,
      voucher: voucher ? {
        id: voucher.id,
        code: voucher.code,
        type: voucher.tarif_slug,
        prix: toNum(voucher.prix_fcfa),
        duree: toNum(voucher.duree_heures, 24),
        dureeLabel: durationLabel(toNum(voucher.duree_heures, 24)),
        vitesse: `${toNum(voucher.vitesse_mbps, 5)} Mbps`,
      } : null,
    };
  }

  if (!tx.cinetpay_transaction_id) {
    return { found: true, statut: tx.statut, ref: tx.reference, remoteStatus: null, code: null, voucher: null };
  }

  // Si le frontend a fourni un statut FedaPay de confiance (ex: depuis onComplete),
  // l'utiliser directement plutôt que de re-interroger l'API FedaPay (qui peut encore retourner pending).
  let remoteStatus;
  if (trustedRemoteStatus && mapFedapayStatusToLocal(trustedRemoteStatus) === 'succes') {
    remoteStatus = trustedRemoteStatus;
    console.log(`[payment] Trusted status from callback: ${remoteStatus} for ref=${reference}`);
  } else {
    const remoteTx = await fetchFedapayTransactionById(String(tx.cinetpay_transaction_id));
    remoteStatus = String(extractFedapayStatus(remoteTx) || '').trim();
    console.log(`[payment] FedaPay API status: ${remoteStatus} for ref=${reference} txid=${tx.cinetpay_transaction_id}`);
  }
  const localStatus = mapFedapayStatusToLocal(remoteStatus);

  if (localStatus !== 'succes') {
    await query(
      `UPDATE transactions
       SET statut=?, updated_at=NOW(), cinetpay_data=JSON_SET(COALESCE(cinetpay_data, JSON_OBJECT()), '$.fedapay_status', ?)
       WHERE id=?`,
      [localStatus, remoteStatus || null, tx.id],
    );
    return { found: true, statut: localStatus, ref: tx.reference, remoteStatus, code: null, voucher: null };
  }

  const providerData = parseJsonSafe(tx.cinetpay_data, {});
  const tarifId = providerData.tarifId || providerData.tarif_id || providerData.tarifSlug || providerData.tarif_slug;
  const tarif = await queryOne(
    'SELECT * FROM tarifs WHERE (id=? OR slug=?) AND actif=1 LIMIT 1',
    [toNum(tarifId, -1), String(tarifId || '')],
  );

  if (!tarif) {
    return { found: true, statut: 'echec', ref: tx.reference, remoteStatus, error: 'Tarif introuvable pour finaliser le paiement' };
  }

  const voucher = await createVoucherAfterPayment({ tarif, methode: tx.methode });
  await query(
    `UPDATE transactions
     SET statut='succes', voucher_id=?, updated_at=NOW(),
         cinetpay_data=JSON_SET(COALESCE(cinetpay_data, JSON_OBJECT()), '$.fedapay_status', ?, '$.voucher_code', ?)
     WHERE id=?`,
    [voucher.id, remoteStatus || null, voucher.code, tx.id],
  );

  return { found: true, statut: 'succes', ref: tx.reference, remoteStatus, code: voucher.code, voucher };
}

function colorBySlug(slug) {
  const map = {
    journalier: '#10B981',
    hebdomadaire: '#6366F1',
    mensuel: '#F5A623',
  };
  return map[slug] || '#10B981';
}

function isPopular(slug) {
  return slug === 'hebdomadaire';
}

function durationLabel(hours) {
  if (hours >= 720) return '30 jours';
  if (hours >= 168) return '7 jours';
  return '24 heures';
}

function mapVoucherForPortal(row) {
  return {
    id: row.id,
    code: row.code,
    type: row.tarif_slug,
    prix: toNum(row.prix_fcfa || row.prix_vente),
    duree: toNum(row.duree_heures, 24),
    dureeLabel: durationLabel(toNum(row.duree_heures, 24)),
    vitesse: `${toNum(row.vitesse_mbps, 5)} Mbps`,
  };
}

function mapSessionForPortal(row, realtime = {}) {
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const dataDownMb = toNum(row.data_mb_down);
  const dataUpMb = toNum(row.data_mb_up);
  const debitDownMbps = Math.max(0, toNum(realtime.downMbps));
  const debitUpMbps = Math.max(0, toNum(realtime.upMbps));

  return {
    id: row.id,
    code: row.code,
    type: row.tarif_slug,
    duree: toNum(row.duree_heures, 24),
    heureDebut: row.started_at
      ? new Date(row.started_at).toISOString()
      : new Date(row.activated_at || Date.now()).toISOString(),
    expireAt: expiresAt ? expiresAt.toISOString() : null,
    mac: row.mac_address || row.mac_utilisateur || null,
    borne: row.borne_id || row.premiere_borne_id || null,
    secondesRestantes: expiresAt ? secondesRestantes(expiresAt) : 0,
    dataDownMb,
    dataUpMb,
    dataTotalMb: +(dataDownMb + dataUpMb).toFixed(3),
    debitDownMbps,
    debitUpMbps,
    debitSource: realtime.source || 'none',
    vitesseMbps: toNum(row.vitesse_mbps, 5),
  };
}

function applyNoStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
}

async function enrichWithMikrotikLive(row, statut) {
  let mikrotikLive = null;
  if (statut !== 'active' || process.env.MIKROTIK_ENABLED !== 'true' || !row.code) {
    return mikrotikLive;
  }

  try {
    const mt = await mikrotik.getActiveSessionByUser(row.code);
    if (!mt) return mikrotikLive;

    const bytesIn = parseInt(mt['bytes-in'] || '0', 10) || 0;
    const bytesOut = parseInt(mt['bytes-out'] || '0', 10) || 0;
    const uptimeSec = parseUptimeToSeconds(mt['uptime']);
    const timeLeftSec = parseUptimeToSeconds(mt['session-time-left']);

    mikrotikLive = {
      uptimeSeconds: uptimeSec,
      sessionTimeLeftSeconds: timeLeftSec > 0 ? timeLeftSec : null,
      bytesIn,
      bytesOut,
      dataDownMb: toMbFromBytes(bytesIn),
      dataUpMb: toMbFromBytes(bytesOut),
      address: mt['address'] || row.ip_address,
      mac: mt['mac-address'] || row.mac_address,
    };

    const computedRates = computeRatesFromCounters(row.id, bytesIn, bytesOut);
    if (Number.isFinite(computedRates.downMbps) || Number.isFinite(computedRates.upMbps)) {
      setRealtimeRates(row.id, computedRates.downMbps, computedRates.upMbps, 'mikrotik-live');
    }

    // Mettre à jour les compteurs en base à chaque lecture live.
    await query(
      `UPDATE sessions_actives
       SET data_mb_down=?, data_mb_up=?, last_seen_at=NOW()
       WHERE id=?`,
      [mikrotikLive.dataDownMb, mikrotikLive.dataUpMb, row.id],
    );

    // Si MikroTik donne un temps restant précis, corriger l'expiration stockée.
    if (timeLeftSec > 0 && row.expires_at) {
      const correctedExpiry = new Date(Date.now() + timeLeftSec * 1000);
      await query(
        `UPDATE sessions_actives
         SET expires_at=?
         WHERE id=? AND ABS(TIMESTAMPDIFF(SECOND, expires_at, ?)) > 120`,
        [correctedExpiry, row.id, correctedExpiry],
      );
    }
  } catch (err) {
    console.error('MikroTik live stats error:', err.message);
  }

  return mikrotikLive;
}

async function getVoucherByCode(code) {
  return queryOne(
    `SELECT
       v.*,
       t.slug AS tarif_slug,
       t.nom AS tarif_nom,
       t.duree_heures,
       t.prix_fcfa,
       t.vitesse_mbps
     FROM vouchers v
     JOIN tarifs t ON t.id = v.tarif_id
     WHERE UPPER(v.code) = ?`,
    [normalizeCode(code)],
  );
}

router.get('/public/portal-meta', async (req, res) => {
  try {
    const askedBorneId = String(req.query?.borneId || 'B08')
      .trim()
      .toUpperCase();

    const [askedBorne, firstBorne, bornesStats, tarifRef] = await Promise.all([
      queryOne(
        `SELECT id, zone, adresse_ip, type_borne, statut
         FROM bornes
         WHERE id=?
         LIMIT 1`,
        [askedBorneId],
      ),
      queryOne(
        `SELECT id, zone, adresse_ip, type_borne, statut
         FROM bornes
         ORDER BY id ASC
         LIMIT 1`,
      ),
      queryOne(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN statut='online' THEN 1 ELSE 0 END) AS online
         FROM bornes`,
      ),
      queryOne(
        `SELECT vitesse_mbps
         FROM tarifs
         WHERE actif=1
         ORDER BY prix_fcfa ASC
         LIMIT 1`,
      ),
    ]);

    const borne = askedBorne || firstBorne || null;

    return res.json({
      ok: true,
      meta: {
        borne,
        totalBornes: toNum(bornesStats?.total),
        bornesEnLigne: toNum(bornesStats?.online),
        debitReferenceMbps: toNum(tarifRef?.vitesse_mbps, 5),
      },
    });
  } catch (error) {
    return res.status(2000).json({ ok: false, error: error.message || 'Impossible de charger les meta-donnees du portail' });
  }
});

router.get('/public/tarifs', async (req, res) => {
  try {
    const rows = await query('SELECT slug, nom, prix_fcfa, duree_heures, vitesse_mbps FROM tarifs WHERE actif=1 ORDER BY prix_fcfa ASC');
    const tarifs = rows.map(row => ({
      id: row.slug,
      nom: row.nom,
      prix: toNum(row.prix_fcfa),
      duree: durationLabel(toNum(row.duree_heures, 24)),
      dureeH: toNum(row.duree_heures, 24),
      vitesse: `${toNum(row.vitesse_mbps, 5)} Mbps`,
      populaire: isPopular(row.slug),
      color: colorBySlug(row.slug),
      glow: `${colorBySlug(row.slug)}22`,
    }));
    return res.json({ tarifs });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Impossible de charger les tarifs' });
  }
});

router.post(['/captive/vouchers/validate', '/vouchers/validate'], async (req, res) => {
  try {
    const code = normalizeCode(req.body?.code);
    if (!code) return res.status(400).json({ ok: false, error: 'Code requis' });

    const voucher = await getVoucherByCode(code);
    if (!voucher) return res.status(404).json({ ok: false, error: 'Code invalide ou introuvable' });

    if (voucher.statut === 'revoque') {
      return res.status(400).json({ ok: false, error: 'Ce code a ete revoque' });
    }

    if (voucher.statut === 'expire') {
      return res.status(400).json({ ok: false, error: 'Ce code est expire' });
    }

    if (voucher.statut === 'utilise') {
      if (!voucher.expires_at || !isVoucherValid(voucher.expires_at)) {
        await query("UPDATE vouchers SET statut='expire', updated_at=NOW() WHERE id=?", [voucher.id]);
        return res.status(400).json({ ok: false, error: 'Ce code est expire' });
      }
    }

    return res.json({ ok: true, voucher: mapVoucherForPortal(voucher) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Validation impossible' });
  }
});

router.post(['/captive/sessions/activate', '/sessions/activate'], async (req, res) => {
  try {
    const code = normalizeCode(req.body?.code);
    const ipAddress = extractIpFromRequest(req);
    const detectedMac = extractMacFromRequest(req);
    const macAddress = detectedMac || derivePseudoMacFromIp(ipAddress) || '02:00:00:00:00:00';

    if (!code) return res.status(400).json({ ok: false, error: 'Code requis' });

    const voucher = await getVoucherByCode(code);
    if (!voucher) return res.status(404).json({ ok: false, error: 'Code introuvable' });

    if (voucher.statut === 'revoque') return res.status(400).json({ ok: false, error: 'Code revoque' });
    if (voucher.statut === 'expire') return res.status(400).json({ ok: false, error: 'Code expire' });

    let activatedAt = voucher.activated_at ? new Date(voucher.activated_at) : new Date();
    let expiresAt = voucher.expires_at ? new Date(voucher.expires_at) : calculateExpiry(activatedAt, toNum(voucher.duree_heures, 24));
    const borneIdRaw = String(req.body?.borneId || req.body?.borne_id || voucher.premiere_borne_id || '')
      .trim()
      .toUpperCase();

    // Valider que le borneId existe bien en base ($(server-name) MikroTik n'est pas forcement un ID de borne)
    const borneRow = borneIdRaw
      ? await queryOne('SELECT id FROM bornes WHERE id=? LIMIT 1', [borneIdRaw])
      : null;
    const borneId = borneRow ? borneIdRaw : null;

    if (voucher.statut === 'actif') {
      activatedAt = new Date();
      expiresAt = calculateExpiry(activatedAt, toNum(voucher.duree_heures, 24));
      await query(
        `UPDATE vouchers
         SET statut='utilise',
             activated_at=?,
             expires_at=?,
             mac_utilisateur=?,
             ip_utilisateur=?,
             premiere_borne_id=IFNULL(premiere_borne_id, ?),
             updated_at=NOW()
         WHERE id=?`,
        [activatedAt, expiresAt, macAddress, ipAddress, borneId, voucher.id],
      );
    } else if (!isVoucherValid(expiresAt)) {
      await query("UPDATE vouchers SET statut='expire', updated_at=NOW() WHERE id=?", [voucher.id]);
      return res.status(400).json({ ok: false, error: 'Code expire' });
    }

    // Creer (ou confirmer) l'utilisateur dans /ip/hotspot/user avant le login CHAP
    if (process.env.MIKROTIK_ENABLED === 'true') {
      try {
        await mikrotik.ensureHotspotProfile(voucher.tarif_slug, toNum(voucher.vitesse_mbps, 5));
        await mikrotik.createHotspotUser(
          voucher.code,
          voucher.tarif_slug,
          toNum(voucher.duree_heures, 24),
          { upsert: true },
        );
      } catch (err) {
        console.error('MikroTik ensureUser (activate):', err.message);
      }
    }

    // Note : l'authentification MikroTik est gérée par le formulaire http-pap (login.html).
    // L'appel authorizeUser via API est inutile et génère "unknown parameter" sur ce RouterOS.
    const mikrotikResult = { success: true, mikrotik: false, message: 'auth handled by http-pap form' };

    let session = await queryOne(
      "SELECT id FROM sessions_actives WHERE voucher_id=? AND statut='active' AND expires_at > NOW()",
      [voucher.id],
    );

    if (session) {
      await query(
        `UPDATE sessions_actives
         SET mac_address=?, ip_address=?, last_seen_at=NOW(), borne_id=?
         WHERE id=?`,
        [macAddress, ipAddress, borneId, session.id],
      );
    } else {
      await query("UPDATE sessions_actives SET statut='terminee' WHERE mac_address=? AND statut='active'", [macAddress]);
      const sessionId = uuidv4();
      await query(
        `INSERT INTO sessions_actives
          (id, voucher_id, borne_id, mac_address, ip_address, started_at, expires_at, last_seen_at, statut)
         VALUES (?, ?, ?, ?, ?, NOW(), ?, NOW(), 'active')`,
        [sessionId, voucher.id, borneId, macAddress, ipAddress, expiresAt],
      );
      session = { id: sessionId };
    }

    return res.json({
      ok: true,
      mikrotik: mikrotikResult,
      session: {
        id: session.id,
        code: voucher.code,
        type: voucher.tarif_slug,
        duree: toNum(voucher.duree_heures, 24),
        heureDebut: activatedAt.toISOString(),
        expireAt: expiresAt.toISOString(),
        mac: macAddress,
        macDetected: Boolean(detectedMac),
        borne: borneId || borneIdRaw || null,
        secondesRestantes: secondesRestantes(expiresAt),
        dataDownMb: 0,
        dataUpMb: 0,
        dataTotalMb: 0,
        debitDownMbps: 0,
        debitUpMbps: 0,
        vitesseMbps: toNum(voucher.vitesse_mbps, 5),
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Activation impossible' });
  }
});

router.post(['/captive/metrics/ingest', '/metrics/ingest'], async (req, res) => {
  try {
    if (!isMetricsIngestAuthorized(req)) {
      return res.status(401).json({ ok: false, error: 'Ingest non autorise' });
    }

    const borneId = String(req.body?.borneId || req.body?.borne_id || 'B08')
      .trim()
      .toUpperCase();
    const samples = Array.isArray(req.body?.samples) ? req.body.samples.slice(0, 1000) : [];
    if (samples.length === 0) {
      return res.status(400).json({ ok: false, error: 'Aucun echantillon recu' });
    }

    let updated = 0;
    let ignored = 0;

    for (const sample of samples) {
      const mac = normalizeMac(sample?.mac || sample?.macAddress);
      const ip = normalizeIp(sample?.ip || sample?.ipAddress);
      const rxBytes = toNum(sample?.rxBytes, NaN);
      const txBytes = toNum(sample?.txBytes, NaN);
      const rxDeltaBytes = toNum(sample?.rxDeltaBytes, NaN);
      const txDeltaBytes = toNum(sample?.txDeltaBytes, NaN);
      const rxKnown = Number.isFinite(rxBytes);
      const txKnown = Number.isFinite(txBytes);
      const rxDeltaKnown = Number.isFinite(rxDeltaBytes);
      const txDeltaKnown = Number.isFinite(txDeltaBytes);
      const downMbpsFromProbe = toNum(sample?.downMbps, NaN);
      const upMbpsFromProbe = toNum(sample?.upMbps, NaN);

      if (!mac && !ip) {
        ignored += 1;
        continue;
      }

      const session = await queryOne(
        `SELECT id, voucher_id
         FROM sessions_actives
         WHERE statut='active'
           AND expires_at > NOW()
           AND (
             (? IS NOT NULL AND mac_address = ?)
             OR
             (? IS NOT NULL AND ip_address = ?)
           )
         ORDER BY last_seen_at DESC
         LIMIT 1`,
        [mac, mac, ip, ip],
      );

      if (!session) {
        ignored += 1;
        continue;
      }

      const dataDownMbAbsolute = rxKnown ? toMbFromBytes(rxBytes) : null;
      const dataUpMbAbsolute = txKnown ? toMbFromBytes(txBytes) : null;
      const dataDownMbDelta = rxDeltaKnown ? toMbFromBytes(rxDeltaBytes) : null;
      const dataUpMbDelta = txDeltaKnown ? toMbFromBytes(txDeltaBytes) : null;

      await query(
        `UPDATE sessions_actives
         SET
           data_mb_down = CASE
             WHEN ? IS NOT NULL THEN data_mb_down + ?
             WHEN ? IS NULL THEN data_mb_down
             ELSE GREATEST(data_mb_down, ?)
           END,
           data_mb_up = CASE
             WHEN ? IS NOT NULL THEN data_mb_up + ?
             WHEN ? IS NULL THEN data_mb_up
             ELSE GREATEST(data_mb_up, ?)
           END,
           mac_address = CASE WHEN ? IS NOT NULL THEN ? ELSE mac_address END,
           ip_address = COALESCE(?, ip_address),
           borne_id = COALESCE(?, borne_id),
           last_seen_at = NOW()
         WHERE id = ?`,
        [
          dataDownMbDelta, dataDownMbDelta, dataDownMbAbsolute, dataDownMbAbsolute,
          dataUpMbDelta, dataUpMbDelta, dataUpMbAbsolute, dataUpMbAbsolute,
          mac, mac, ip, borneId, session.id,
        ],
      );

      await query(
        `UPDATE vouchers
         SET
           mac_utilisateur = COALESCE(?, mac_utilisateur),
           ip_utilisateur = COALESCE(?, ip_utilisateur),
           premiere_borne_id = COALESCE(?, premiere_borne_id),
           updated_at = NOW()
         WHERE id = ?`,
        [mac, ip, borneId, session.voucher_id],
      );

      const computedRates = (rxKnown && txKnown)
        ? computeRatesFromCounters(session.id, rxBytes, txBytes)
        : { downMbps: null, upMbps: null };

      const downMbps = Number.isFinite(downMbpsFromProbe)
        ? downMbpsFromProbe
        : computedRates.downMbps;
      const upMbps = Number.isFinite(upMbpsFromProbe)
        ? upMbpsFromProbe
        : computedRates.upMbps;

      if (Number.isFinite(downMbps) || Number.isFinite(upMbps)) {
        setRealtimeRates(session.id, downMbps, upMbps, 'collector');
      }

      updated += 1;
    }

    return res.json({ ok: true, updated, ignored });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Ingestion impossible' });
  }
});

// Retrouver la session active par code voucher (utile si sessionId non dispo côté client)
router.get(['/captive/sessions/by-code/:code', '/sessions/by-code/:code'], async (req, res) => {
  try {
    applyNoStore(res);

    const code = normalizeCode(req.params.code);
    if (!code) return res.status(400).json({ ok: false, error: 'Code requis' });

    const row = await queryOne(
      `SELECT
         s.id, s.voucher_id, s.borne_id, s.mac_address, s.ip_address,
         s.started_at, s.expires_at, s.last_seen_at, s.data_mb_down, s.data_mb_up, s.statut,
         v.code, v.statut AS voucher_statut, v.activated_at, v.premiere_borne_id, v.mac_utilisateur,
         t.slug AS tarif_slug, t.duree_heures, t.vitesse_mbps
       FROM sessions_actives s
       LEFT JOIN vouchers v ON v.id = s.voucher_id
       LEFT JOIN tarifs t ON t.id = v.tarif_id
       WHERE UPPER(v.code) = ? AND s.statut = 'active' AND s.expires_at > NOW()
       ORDER BY s.last_seen_at DESC
       LIMIT 1`,
      [code],
    );

    if (!row) return res.status(404).json({ ok: false, error: 'Aucune session active pour ce code' });

    const mikrotikLive = await enrichWithMikrotikLive(row, row.statut);
    const realtime = getRealtimeRates(row.id);
    const mappedRow = {
      ...row,
      data_mb_down: mikrotikLive ? mikrotikLive.dataDownMb : row.data_mb_down,
      data_mb_up: mikrotikLive ? mikrotikLive.dataUpMb : row.data_mb_up,
    };

    return res.json({
      ok: true,
      active: true,
      statut: row.statut,
      mikrotikLive,
      session: mapSessionForPortal(mappedRow, realtime),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Recherche impossible' });
  }
});

router.get(['/captive/sessions/:id/status', '/sessions/:id/status'], async (req, res) => {
  try {
    applyNoStore(res);

    const row = await queryOne(
      `SELECT
         s.id,
         s.voucher_id,
         s.borne_id,
         s.mac_address,
         s.started_at,
         s.expires_at,
         s.last_seen_at,
         s.data_mb_down,
         s.data_mb_up,
         s.statut,
         v.code,
         v.statut AS voucher_statut,
         v.activated_at,
         v.premiere_borne_id,
         v.mac_utilisateur,
         t.slug AS tarif_slug,
         t.duree_heures,
         t.vitesse_mbps
       FROM sessions_actives s
       LEFT JOIN vouchers v ON v.id = s.voucher_id
       LEFT JOIN tarifs t ON t.id = v.tarif_id
       WHERE s.id=?
       LIMIT 1`,
      [req.params.id],
    );

    if (!row) return res.status(404).json({ ok: false, error: 'Session introuvable' });

    if (!row.code || !row.tarif_slug) {
      await query(
        "UPDATE sessions_actives SET statut='terminee', last_seen_at=NOW() WHERE id=?",
        [row.id],
      );
      return res.status(410).json({ ok: false, active: false, statut: 'terminee', error: 'Session invalide (voucher supprime)' });
    }

    let statut = row.statut;
    if (statut === 'active' && (row.voucher_statut === 'revoque' || row.voucher_statut === 'expire')) {
      statut = 'terminee';
      await query(
        "UPDATE sessions_actives SET statut='terminee', last_seen_at=NOW() WHERE id=?",
        [row.id],
      );
    } else if (statut === 'active' && row.expires_at && !isVoucherValid(row.expires_at)) {
      statut = 'expiree';
      await query(
        "UPDATE sessions_actives SET statut='expiree', last_seen_at=NOW() WHERE id=?",
        [row.id],
      );
      await query(
        "UPDATE vouchers SET statut='expire', updated_at=NOW() WHERE id=?",
        [row.voucher_id],
      );
      if (process.env.MIKROTIK_ENABLED === 'true' && row.mac_address) {
        await mikrotik.disconnectUserByMac(row.mac_address);
      }
      // Supprimer l'utilisateur hotspot MikroTik pour empêcher toute reconnexion
      if (process.env.MIKROTIK_ENABLED === 'true' && row.code) {
        mikrotik.deleteHotspotUser(row.code).catch(err =>
          console.error('MikroTik delete expired user error:', err.message),
        );
      }
    } else if (statut === 'active') {
      await query(
        "UPDATE sessions_actives SET last_seen_at=NOW() WHERE id=?",
        [row.id],
      );
    }

    const realtime = getRealtimeRates(row.id);
    const mikrotikLive = await enrichWithMikrotikLive(row, statut);
    const mappedRow = {
      ...row,
      data_mb_down: mikrotikLive ? mikrotikLive.dataDownMb : row.data_mb_down,
      data_mb_up: mikrotikLive ? mikrotikLive.dataUpMb : row.data_mb_up,
      statut,
    };

    return res.json({
      ok: true,
      active: statut === 'active',
      statut,
      mikrotikLive,
      session: mapSessionForPortal(mappedRow, realtime),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Statut session indisponible' });
  }
});

router.post(['/captive/payments/initiate', '/payments/initiate'], async (req, res) => {
  try {
    const tarifId = req.body?.tarifId;
    const telephone = req.body?.telephone || null;
    const methode = paymentUiToDb(req.body?.methode);
    const paymentGateway = String(process.env.PAYMENT_GATEWAY || 'fedapay').trim().toLowerCase();
    const checkoutMode = getFedapayCheckoutMode(req.body?.checkoutMode);
    const providerData = {
      provider: paymentGateway,
      channel: mapDbMethodToFedapayChannel(methode),
      testMode: String(process.env.FEDAPAY_TEST_MODE || 'true').toLowerCase() !== 'false',
      checkoutMode,
      note: 'Transaction initiee via API captive',
    };

    if (!tarifId) return res.status(400).json({ ok: false, error: 'Tarif requis' });

    const tarif = await queryOne(
      'SELECT * FROM tarifs WHERE (slug=? OR id=?) AND actif=1 LIMIT 1',
      [String(tarifId), toNum(tarifId, -1)],
    );
    if (!tarif) return res.status(400).json({ ok: false, error: 'Tarif introuvable' });
    const tarifPrice = getTarifPriceFcfa(tarif);
    if (tarifPrice <= 0) return res.status(400).json({ ok: false, error: 'Prix tarif invalide' });

    const baseReturnUrl = normalizeReturnUrl(req.body?.returnUrl) || `${getBackendPublicBase(req)}/login.html`;

    const reference = generateTransactionRef();
    let fedapayCheckout = null;
    let immediateVoucher = null;

    if (paymentGateway === 'fedapay') {
      const callbackUrl = `${getBackendPublicBase(req)}/api/captive/payments/fedapay/callback?ref=${encodeURIComponent(reference)}`;

      fedapayCheckout = await createFedapayCheckout({
        amount: tarifPrice,
        description: `Achat forfait ${tarif.nom || tarif.slug || 'wifi'} - ${tarifPrice} FCFA - ${reference}`,
        callbackUrl,
        reference,
        currencyIso: 'XOF',
      });
    } else {
      immediateVoucher = await createVoucherAfterPayment({ tarif, methode });
    }

    await query(
      `INSERT INTO transactions
        (id, reference, voucher_id, montant, methode, statut, telephone, cinetpay_transaction_id, cinetpay_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        reference,
        immediateVoucher ? immediateVoucher.id : null,
        tarifPrice,
        methode,
        paymentGateway === 'fedapay' ? 'en_attente' : 'succes',
        telephone,
        fedapayCheckout ? String(fedapayCheckout.transactionId) : null,
        JSON.stringify({
          ...providerData,
          tarifId: tarif.id,
          tarifSlug: tarif.slug,
          returnUrl: baseReturnUrl,
        }),
      ],
    );

    return res.json({
      ok: true,
      ref: reference,
      paymentUrl: paymentGateway === 'fedapay' && checkoutMode === 'redirect' ? fedapayCheckout?.paymentUrl || null : null,
      checkout: paymentGateway === 'fedapay' ? {
        mode: checkoutMode,
        publicKey: getFedapayPublicKey() || null,
        environment: String(process.env.FEDAPAY_ENVIRONMENT || '').trim().toLowerCase() || null,
        transactionId: fedapayCheckout ? String(fedapayCheckout.transactionId) : null,
      } : null,
      payment: {
        provider: providerData.provider,
        channel: providerData.channel,
        testMode: providerData.testMode,
      },
      statut: paymentGateway === 'fedapay' ? 'en_attente' : 'succes',
      code: immediateVoucher ? immediateVoucher.code : null,
      voucher: immediateVoucher,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Paiement impossible' });
  }
});

router.post(['/captive/payments/complete', '/payments/complete'], async (req, res) => {
  try {
    const ref = String(req.body?.ref || '').trim();
    const transactionId = String(req.body?.transactionId || req.body?.fedapayTransactionId || '').trim();
    // Statut confirmé par FedaPay dans onComplete (bypass re-fetch API si approved)
    const fedapayStatus = String(req.body?.fedapayStatus || '').trim().toLowerCase();

    if (!ref) return res.status(400).json({ ok: false, statut: 'echoue', error: 'Reference requise' });

    if (transactionId) {
      await query(
        `UPDATE transactions
         SET cinetpay_transaction_id = ?,
             updated_at = NOW(),
             cinetpay_data = JSON_SET(
               COALESCE(cinetpay_data, JSON_OBJECT()),
               '$.oncomplete_transaction_id', ?,
               '$.oncomplete_status', ?
             )
         WHERE reference = ?`,
        [transactionId, transactionId, fedapayStatus || null, ref],
      );
    } else if (fedapayStatus) {
      await query(
        `UPDATE transactions
         SET updated_at = NOW(),
             cinetpay_data = JSON_SET(COALESCE(cinetpay_data, JSON_OBJECT()), '$.oncomplete_status', ?)
         WHERE reference = ?`,
        [fedapayStatus, ref],
      );
    }

    const result = await finalizePaymentReference(ref, fedapayStatus || null);
    if (!result.found) return res.status(404).json({ ok: false, statut: 'echoue', error: 'Transaction introuvable' });

    return res.json({
      ok: true,
      ref,
      statut: result.statut,
      remoteStatus: result.remoteStatus || null,
      code: result.code || null,
      voucher: result.voucher || null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, statut: 'echoue', error: error.message || 'Finalisation paiement impossible' });
  }
});

router.all(['/captive/payments/fedapay/callback', '/payments/fedapay/callback'], async (req, res) => {
  try {
    const ref = String(req.query?.ref || req.body?.ref || req.body?.payment_ref || '').trim();
    if (!ref) return res.status(400).json({ ok: false, error: 'Reference requise' });

    const result = await finalizePaymentReference(ref);
    if (!result.found) return res.status(404).json({ ok: false, error: 'Transaction introuvable' });

    const tx = await queryOne('SELECT cinetpay_data FROM transactions WHERE reference=? LIMIT 1', [ref]);
    const providerData = parseJsonSafe(tx?.cinetpay_data, {});
    const returnUrl = normalizeReturnUrl(providerData.returnUrl) || '/login.html';

    if (req.method === 'GET') {
      const sep = returnUrl.includes('?') ? '&' : '?';
      let redirectUrl = `${returnUrl}${sep}payment_ref=${encodeURIComponent(ref)}&payment_status=${encodeURIComponent(result.statut)}`;
      if (result.code) redirectUrl += `&code=${encodeURIComponent(result.code)}`;
      return res.redirect(302, redirectUrl);
    }

    return res.json({
      ok: true,
      ref,
      statut: result.statut,
      remoteStatus: result.remoteStatus || null,
      code: result.code || null,
      voucher: result.voucher || null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Callback FedaPay impossible' });
  }
});

router.post(['/captive/payments/status', '/payments/status'], async (req, res) => {
  try {
    const ref = String(req.body?.ref || '').trim();
    if (!ref) return res.status(400).json({ ok: false, statut: 'echoue', error: 'Reference requise' });

    const result = await finalizePaymentReference(ref);
    if (!result.found) return res.status(404).json({ ok: false, statut: 'echoue', error: 'Transaction introuvable' });

    return res.json({
      ok: true,
      ref,
      statut: result.statut,
      remoteStatus: result.remoteStatus || null,
      code: result.code || null,
      voucher: result.voucher || null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, statut: 'echoue', error: error.message || 'Statut indisponible' });
  }
});

router.post(['/captive/sessions/:id/disconnect', '/sessions/:id/disconnect'], async (req, res) => {
  try {
    const session = await queryOne(
      `SELECT s.mac_address, v.code
       FROM sessions_actives s
       LEFT JOIN vouchers v ON v.id = s.voucher_id
       WHERE s.id=? LIMIT 1`,
      [req.params.id]
    );

    await query("UPDATE sessions_actives SET statut='terminee', last_seen_at=NOW() WHERE id=?", [req.params.id]);

    if (process.env.MIKROTIK_ENABLED === 'true') {
      // Déconnecter par username (code) — plus fiable que MAC (la MAC en DB peut être pseudo)
      if (session?.code) {
        try { await mikrotik.disconnectUserByUsername(session.code); } catch (e) {
          console.warn('MikroTik disconnect (by-username):', e.message);
        }
      }
      // Également par MAC en backup
      if (session?.mac_address) {
        try { await mikrotik.disconnectUserByMac(session.mac_address); } catch (e) {
          console.warn('MikroTik disconnect (by-mac):', e.message);
        }
      }
      console.log(`✅ Session ${req.params.id} terminée + MikroTik déconnecté (code=${session?.code})`);
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Deconnexion impossible' });
  }
});

// Déconnexion par code voucher (fallback si sessionId non disponible)
router.post(['/captive/sessions/disconnect-by-code', '/sessions/disconnect-by-code'], async (req, res) => {
  try {
    const code = normalizeCode(req.body?.code);
    if (!code) return res.status(400).json({ ok: false, error: 'Code requis' });

    const session = await queryOne(
      `SELECT s.id, s.mac_address
       FROM sessions_actives s
       JOIN vouchers v ON v.id = s.voucher_id
       WHERE UPPER(v.code) = ? AND s.statut = 'active'
       ORDER BY s.last_seen_at DESC LIMIT 1`,
      [code]
    );

    if (!session) {
      return res.json({ ok: true, message: 'Aucune session active trouvee' });
    }

    await query("UPDATE sessions_actives SET statut='terminee', last_seen_at=NOW() WHERE id=?", [session.id]);

    if (process.env.MIKROTIK_ENABLED === 'true') {
      // Déconnecter par username (code) — c'est le username dans /ip/hotspot/active
      try { await mikrotik.disconnectUserByUsername(code); } catch (e) {
        console.warn('MikroTik disconnect (by-username):', e.message);
      }
      // Backup par MAC
      if (session.mac_address) {
        try { await mikrotik.disconnectUserByMac(session.mac_address); } catch (e) {
          console.warn('MikroTik disconnect (by-mac):', e.message);
        }
      }
      console.log(`✅ Session code=${code} terminée + MikroTik déconnecté`);
    }

    return res.json({ ok: true, sessionId: session.id });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Deconnexion impossible' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PONT PORTAIL ↔ MIKROTIK : endpoints pour l'architecture "portail comme pont"
// Le navigateur client (sur le réseau hotspot) appelle ces routes.
// Le backend répond avec les infos + synchronise MikroTik en coulisses.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/captive/mikrotik/ensure-user
 * Appelé par le portail AVANT la soumission du formulaire CHAP.
 * Garantit que l'utilisateur existe dans /ip/hotspot/user sur MikroTik.
 * Retourne toujours ok:true même si MikroTik est inaccessible (mode dégradé).
 */
router.post(['/captive/mikrotik/ensure-user', '/mikrotik/ensure-user'], async (req, res) => {
  try {
    const code = normalizeCode(req.body?.code);
    if (!code) return res.status(400).json({ ok: false, error: 'Code requis' });

    const voucher = await getVoucherByCode(code);
    if (!voucher) return res.status(404).json({ ok: false, error: 'Code introuvable' });

    if (['revoque', 'expire'].includes(voucher.statut)) {
      return res.status(400).json({ ok: false, error: `Code ${voucher.statut}` });
    }

    let mikrotikDone = false;
    let mikrotikError = null;

    if (process.env.MIKROTIK_ENABLED === 'true') {
      try {
        await mikrotik.ensureHotspotProfile(voucher.tarif_slug, toNum(voucher.vitesse_mbps, 5));
        const result = await mikrotik.createHotspotUser(
          voucher.code,
          voucher.tarif_slug,
          toNum(voucher.duree_heures, 24),
          { upsert: true },
        );
        mikrotikDone = result.success === true;
      } catch (err) {
        mikrotikError = err.message;
        console.warn('⚠️ MikroTik ensure-user:', err.message);
      }
    }

    return res.json({
      ok: true,
      mikrotikDone,
      mikrotikError,
      // Le portail utilise username/password = code (en majuscules) pour le CHAP
      credentials: { username: code.toUpperCase(), password: code.toUpperCase() },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Impossible de préparer le user MikroTik' });
  }
});

/**
 * POST /api/captive/mikrotik/sync-all
 * Synchronise TOUS les vouchers actifs vers MikroTik (import en masse).
 * À appeler depuis la plateforme admin ou manuellement après un reset MikroTik.
 */
router.post(['/captive/mikrotik/sync-all', '/mikrotik/sync-all'], async (req, res) => {
  try {
    if (process.env.MIKROTIK_ENABLED !== 'true') {
      return res.json({ ok: true, synced: 0, errors: 0, message: 'MikroTik désactivé' });
    }

    const vouchers = await query(
      `SELECT v.code, t.slug AS tarif_slug, t.duree_heures, t.vitesse_mbps
       FROM vouchers v
       JOIN tarifs t ON t.id = v.tarif_id
       WHERE v.statut IN ('actif', 'utilise')
       ORDER BY v.created_at DESC
       LIMIT 2000`,
    );

    const result = await mikrotik.syncVouchers(vouchers);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Sync MikroTik impossible' });
  }
});

/**
 * POST /api/captive/mikrotik/sync-reset
 * RESET COMPLET : Supprime TOUS les utilisateurs hotspot MikroTik,
 * ferme toutes les sessions actives, puis resynchronise depuis la DB.
 * Utiliser après un incident de synchronisation ou pour repartir de zéro.
 */
router.post(['/captive/mikrotik/sync-reset', '/mikrotik/sync-reset'], async (req, res) => {
  try {
    if (process.env.MIKROTIK_ENABLED !== 'true') {
      return res.json({ ok: true, message: 'MikroTik désactivé' });
    }

    // 1. Fermer toutes les sessions actives MikroTik
    const sessionsResult = await mikrotik.clearAllActiveSessions();
    console.log(`🔄 Sync-reset: sessions fermées:`, sessionsResult);

    // 2. Supprimer tous les utilisateurs hotspot MikroTik
    const clearResult = await mikrotik.clearAllHotspotUsers();
    console.log(`🔄 Sync-reset: utilisateurs supprimés:`, clearResult);

    // 3. Marquer toutes les sessions actives en DB comme terminées
    await query("UPDATE sessions_actives SET statut='terminee' WHERE statut='active'");

    // 4. Récupérer tous les vouchers valides depuis la DB
    const vouchers = await query(
      `SELECT v.code, t.slug AS tarif_slug, t.duree_heures, t.vitesse_mbps
       FROM vouchers v
       JOIN tarifs t ON t.id = v.tarif_id
       WHERE v.statut IN ('actif', 'utilise')
       ORDER BY v.created_at DESC
       LIMIT 2000`,
    );

    // 5. Resynchroniser profils + utilisateurs
    const slugsSeen = new Set();
    for (const v of vouchers) {
      if (!slugsSeen.has(v.tarif_slug)) {
        await mikrotik.ensureHotspotProfile(v.tarif_slug, Number(v.vitesse_mbps) || 5);
        slugsSeen.add(v.tarif_slug);
      }
    }
    const syncResult = await mikrotik.syncVouchers(vouchers);

    console.log(`✅ Sync-reset terminé: ${syncResult.synced} vouchers synchronisés, ${syncResult.errors} erreurs`);
    return res.json({
      ok: true,
      sessionsRemoved: sessionsResult?.removed || 0,
      usersDeleted: clearResult?.deleted || 0,
      vouchersSynced: syncResult.synced,
      errors: syncResult.errors,
    });
  } catch (error) {
    console.error('❌ Sync-reset error:', error.message);
    return res.status(500).json({ ok: false, error: error.message || 'Sync-reset impossible' });
  }
});

module.exports = router;
