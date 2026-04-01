const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { query, queryOne } = require('../config/database');
const { signToken, requireAuth } = require('../middleware/auth');
const { validate, schemas }      = require('../middleware/validate');

/**
 * POST /api/auth/login
 * Connexion administrateur
 */
router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Chercher l'admin
    const admin = await queryOne(
      'SELECT * FROM admins WHERE email = ? AND actif = 1',
      [email]
    );

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect.',
      });
    }

    // Vérifier le mot de passe
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect.',
      });
    }

    // Mettre à jour la dernière connexion
    await query(
      'UPDATE admins SET derniere_connexion = NOW() WHERE id = ?',
      [admin.id]
    );

    // Signer le JWT
    const token = signToken({
      id:    admin.id,
      email: admin.email,
      nom:   admin.nom,
      prenom: admin.prenom,
      role:  admin.role,
    });

    return res.json({
      success: true,
      token,
      admin: {
        id:     admin.id,
        nom:    admin.nom,
        prenom: admin.prenom,
        email:  admin.email,
        role:   admin.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

/**
 * GET /api/auth/me
 * Profil de l'admin connecté
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const admin = await queryOne(
      'SELECT id,nom,prenom,email,role,derniere_connexion,created_at FROM admins WHERE id = ?',
      [req.admin.id]
    );

    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin introuvable.' });
    }

    return res.json({ success: true, admin });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

/**
 * POST /api/auth/logout
 * Logout (côté client, simplement confirmer)
 */
router.post('/logout', requireAuth, (req, res) => {
  return res.json({ success: true, message: 'Déconnexion réussie.' });
});

/**
 * PUT /api/auth/password
 * Changer son mot de passe
 */
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password || new_password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Mot de passe actuel requis. Nouveau mot de passe minimum 8 caractères.',
      });
    }

    const admin = await queryOne('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
    const match = await bcrypt.compare(current_password, admin.password_hash);

    if (!match) {
      return res.status(400).json({ success: false, error: 'Mot de passe actuel incorrect.' });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    await query('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, req.admin.id]);

    return res.json({ success: true, message: 'Mot de passe mis à jour.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

module.exports = router;
