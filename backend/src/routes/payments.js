// src/routes/payments.js
const express = require('express');
const router = express.Router();

const db = require('../config/database');

// Initialisation paiement CinetPay (mock)
router.post('/init', async (req, res) => {
  // Pour la démo, on simule la création d'une transaction CinetPay
  try {
    const { montant, user_id } = req.body;
    // Générer un ID de transaction fictif
    const transaction_id = 'CPAY-' + Date.now();
    // Insérer la transaction en attente
    await db.query(
      'INSERT INTO transactions (transaction_id, user_id, montant, statut, created_at) VALUES (?, ?, ?, ?, NOW())',
      [transaction_id, user_id, montant, 'en_attente']
    );
    // Retourner l'URL de paiement fictive
    res.json({
      transaction_id,
      payment_url: `https://cinetpay.com/pay/${transaction_id}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'initialisation du paiement', details: err.message });
  }
});

// Webhook CinetPay (mock)
router.post('/webhook', async (req, res) => {
  // Pour la démo, on simule la réception d'un webhook de paiement
  try {
    const { transaction_id, statut } = req.body;
    // Mettre à jour le statut de la transaction
    await db.query(
      'UPDATE transactions SET statut=?, updated_at=NOW() WHERE transaction_id=?',
      [statut, transaction_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du traitement du webhook', details: err.message });
  }
});

module.exports = router;
