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
    const borneId = String(req.body?.borneId || req.body?.borne_id || voucher.premiere_borne_id || 'B08')
      .trim()
      .toUpperCase();

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
      session: {
        id: session.id,
        code: voucher.code,
        type: voucher.tarif_slug,
        duree: toNum(voucher.duree_heures, 24),
        heureDebut: activatedAt.toISOString(),
        expireAt: expiresAt.toISOString(),
        mac: macAddress,
        macDetected: Boolean(detectedMac),
        borne: borneId,
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

router.get(['/captive/sessions/:id/status', '/sessions/:id/status'], async (req, res) => {
  try {
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
    } else if (statut === 'active') {
      await query(
        "UPDATE sessions_actives SET last_seen_at=NOW() WHERE id=?",
        [row.id],
      );
    }

    const realtime = getRealtimeRates(row.id);

    return res.json({
      ok: true,
      active: statut === 'active',
      statut,
      session: mapSessionForPortal({ ...row, statut }, realtime),
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

    if (!tarifId) return res.status(400).json({ ok: false, error: 'Tarif requis' });

    const tarif = await queryOne(
      'SELECT * FROM tarifs WHERE (slug=? OR id=?) AND actif=1 LIMIT 1',
      [String(tarifId), toNum(tarifId, -1)],
    );
    if (!tarif) return res.status(400).json({ ok: false, error: 'Tarif introuvable' });

    const existingRows = await query('SELECT code FROM vouchers');
    const existingCodes = new Set(existingRows.map(row => row.code));
    const [code] = await generateUniqueCodes(1, existingCodes);
    const voucherId = uuidv4();

    await query(
      `INSERT INTO vouchers
        (id, code, tarif_id, statut, methode_paiement, prix_vente, commission_agence)
       VALUES (?, ?, ?, 'actif', ?, ?, ?)`,
      [voucherId, code, tarif.id, methode, toNum(tarif.prix_fcfa), toNum(tarif.prix_fcfa) * 0.12],
    );

    const reference = generateTransactionRef();
    await query(
      `INSERT INTO transactions
        (id, reference, voucher_id, montant, methode, statut, telephone)
       VALUES (?, ?, ?, ?, ?, 'succes', ?)`,
      [uuidv4(), reference, voucherId, toNum(tarif.prix_fcfa), methode, telephone],
    );

    return res.json({
      ok: true,
      ref: reference,
      code,
      voucher: {
        id: voucherId,
        code,
        type: tarif.slug,
        prix: toNum(tarif.prix_fcfa),
        duree: toNum(tarif.duree_heures, 24),
        dureeLabel: durationLabel(toNum(tarif.duree_heures, 24)),
        vitesse: `${toNum(tarif.vitesse_mbps, 5)} Mbps`,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Paiement impossible' });
  }
});

router.post(['/captive/payments/status', '/payments/status'], async (req, res) => {
  try {
    const ref = String(req.body?.ref || '').trim();
    if (!ref) return res.status(400).json({ ok: false, statut: 'echoue', error: 'Reference requise' });

    const tx = await queryOne('SELECT statut FROM transactions WHERE reference=? LIMIT 1', [ref]);
    if (!tx) return res.status(404).json({ ok: false, statut: 'echoue', error: 'Transaction introuvable' });

    return res.json({ ok: true, statut: tx.statut });
  } catch (error) {
    return res.status(500).json({ ok: false, statut: 'echoue', error: error.message || 'Statut indisponible' });
  }
});

router.post(['/captive/sessions/:id/disconnect', '/sessions/:id/disconnect'], async (req, res) => {
  try {
    await query("UPDATE sessions_actives SET statut='terminee', last_seen_at=NOW() WHERE id=?", [req.params.id]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Deconnexion impossible' });
  }
});

module.exports = router;
