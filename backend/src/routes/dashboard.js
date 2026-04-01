// src/routes/dashboard.js
const express = require('express');
const router = express.Router();

const db = require('../config/database');

// KPIs généraux
router.get('/kpis', async (req, res) => {
  try {
    const [revenus] = await db.query('SELECT SUM(montant) as total_revenus FROM transactions WHERE statut = "valide"');
    const [connexions] = await db.query('SELECT COUNT(*) as total_connexions FROM sessions WHERE active = 1');
    const [vouchers] = await db.query('SELECT COUNT(*) as total_vouchers FROM vouchers');
    const [agents] = await db.query('SELECT COUNT(*) as total_agents FROM agents');
    res.json({
      total_revenus: revenus[0]?.total_revenus || 0,
      total_connexions: connexions[0]?.total_connexions || 0,
      total_vouchers: vouchers[0]?.total_vouchers || 0,
      total_agents: agents[0]?.total_agents || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des KPIs', details: err.message });
  }
});

// Revenus des 30 derniers jours (vue v_revenus_30j)
router.get('/revenus-30j', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM v_revenus_30j ORDER BY jour ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des revenus', details: err.message });
  }
});

// Connexions des 24 dernières heures (vue v_connexions_24h)
router.get('/connexions-24h', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM v_connexions_24h ORDER BY heure ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des connexions', details: err.message });
  }
});

module.exports = router;
