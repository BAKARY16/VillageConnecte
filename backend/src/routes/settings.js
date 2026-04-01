// src/routes/settings.js
const express = require('express');
const router = express.Router();

const db = require('../config/database');

// Paramètres réseau - lecture
router.get('/reseau', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM parametres_reseau LIMIT 1');
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des paramètres réseau', details: err.message });
  }
});
// Paramètres réseau - écriture
router.post('/reseau', async (req, res) => {
  try {
    const { ssid, password, ip, mask, gateway, dns } = req.body;
    await db.query(
      'UPDATE parametres_reseau SET ssid=?, password=?, ip=?, mask=?, gateway=?, dns=?',
      [ssid, password, ip, mask, gateway, dns]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres réseau', details: err.message });
  }
});

// Paramètres branding - lecture
router.get('/branding', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM parametres_branding LIMIT 1');
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des paramètres branding', details: err.message });
  }
});
// Paramètres branding - écriture
router.post('/branding', async (req, res) => {
  try {
    const { logo_url, couleur_primaire, couleur_secondaire, titre, slogan } = req.body;
    await db.query(
      'UPDATE parametres_branding SET logo_url=?, couleur_primaire=?, couleur_secondaire=?, titre=?, slogan=?',
      [logo_url, couleur_primaire, couleur_secondaire, titre, slogan]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres branding', details: err.message });
  }
});

module.exports = router;
