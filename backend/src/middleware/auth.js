const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { query, queryOne } = require('../config/database');

const JWT_SECRET  = process.env.JWT_SECRET  || 'fallback_dev_secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';
let tokenTableReady = false;

async function ensureRevokedTokensTable() {
  if (tokenTableReady) return;

  await query(
    `CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti VARCHAR(64) PRIMARY KEY,
      admin_id INT UNSIGNED NULL,
      reason VARCHAR(50) NOT NULL DEFAULT 'logout',
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_revoked_tokens_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  tokenTableReady = true;
}

async function cleanupExpiredRevokedTokens() {
  await ensureRevokedTokensTable();
  await query('DELETE FROM revoked_tokens WHERE expires_at < NOW()');
}

async function isTokenRevoked(jti) {
  if (!jti) return false;
  await ensureRevokedTokensTable();
  const row = await queryOne(
    'SELECT jti FROM revoked_tokens WHERE jti = ? LIMIT 1',
    [jti],
  );
  return Boolean(row);
}

async function revokeToken(token, { adminId = null, reason = 'logout' } = {}) {
  if (!token) return;

  const decoded = verifyToken(token);
  if (!decoded?.jti || !decoded?.exp) return;

  await ensureRevokedTokensTable();
  await query(
    `INSERT INTO revoked_tokens (jti, admin_id, reason, expires_at)
     VALUES (?, ?, ?, FROM_UNIXTIME(?))
     ON DUPLICATE KEY UPDATE
       admin_id = VALUES(admin_id),
       reason = VALUES(reason),
       expires_at = VALUES(expires_at),
       revoked_at = CURRENT_TIMESTAMP`,
    [decoded.jti, adminId, reason, decoded.exp],
  );
}

/**
 * Signer un token JWT
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
    jwtid: randomUUID(),
  });
}

/**
 * Vérifier un token JWT
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Middleware: protéger les routes admin
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token manquant. Veuillez vous connecter.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);

    if (!decoded?.jti) {
      return res.status(401).json({
        success: false,
        error: 'Session invalide. Veuillez vous reconnecter.',
      });
    }

    if (await isTokenRevoked(decoded.jti)) {
      return res.status(401).json({
        success: false,
        error: 'Session invalidee. Veuillez vous reconnecter.',
      });
    }

    req.admin = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expirée. Veuillez vous reconnecter.',
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Token invalide.',
    });
  }
}

/**
 * Middleware: rôle superadmin requis
 */
function requireSuperAdmin(req, res, next) {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: 'Accès réservé aux super-administrateurs.',
    });
  }
  next();
}

module.exports = {
  signToken,
  verifyToken,
  requireAuth,
  requireSuperAdmin,
  revokeToken,
  cleanupExpiredRevokedTokens,
};
