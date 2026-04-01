const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || 'fallback_dev_secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Signer un token JWT
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
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
function requireAuth(req, res, next) {
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
    req.admin = decoded;
    next();
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

module.exports = { signToken, verifyToken, requireAuth, requireSuperAdmin };
