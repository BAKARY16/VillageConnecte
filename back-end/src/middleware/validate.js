const Joi = require('joi');

/**
 * Wrapper Joi validation → Express middleware
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map(d => d.message.replace(/"/g, "'"));
      return res.status(400).json({
        success: false,
        error: 'Données invalides',
        details: messages,
      });
    }

    req[target] = value;
    next();
  };
}

// ── Schemas ────────────────────────────────────────────

const schemas = {
  // Auth
  login: Joi.object({
    email:    Joi.string().email().required().messages({ 'string.email': 'Email invalide' }),
    password: Joi.string().min(6).required(),
  }),

  // Voucher validation (portail captif)
  validateVoucher: Joi.object({
    code:       Joi.string().alphanum().min(6).max(12).uppercase().required(),
    mac:        Joi.string().pattern(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/).optional(),
    borne_id:   Joi.string().max(10).optional(),
    ip_address: Joi.string().ip({ version: ['ipv4','ipv6'] }).optional(),
  }),

  // Générer des vouchers (admin)
  generateVouchers: Joi.object({
    tarif_slug: Joi.string().valid('journalier','hebdomadaire','mensuel').required(),
    quantite:   Joi.number().integer().min(1).max(500).required(),
    agent_id:   Joi.string().optional().allow(null, ''),
    methode:    Joi.string().valid('cash','orange_money','mtn','wave','moov','admin').default('cash'),
  }),

  // Créer/modifier un agent
  upsertAgent: Joi.object({
    id:          Joi.string().max(20).optional(),
    nom:         Joi.string().min(2).max(200).required(),
    telephone:   Joi.string().min(8).max(30).required(),
    zone:        Joi.string().max(150).optional().allow(''),
    statut:      Joi.string().valid('actif','inactif').default('actif'),
    commission_pct: Joi.number().min(0).max(100).default(12),
    bornes:      Joi.array().items(Joi.string()).default([]),
  }),

  // Créer/modifier une borne
  upsertBorne: Joi.object({
    id:          Joi.string().max(10).optional(),
    zone:        Joi.string().min(2).max(100).required(),
    type_borne:  Joi.string().valid('Répéteur','Nœud central','Borne principale','HUB principal').default('Répéteur'),
    puissance_solaire: Joi.string().valid('20W','30W','50W').default('20W'),
    hauteur_mat: Joi.string().valid('4m','6m','8m').default('4m'),
    adresse_ip:  Joi.string().ip({ version: 'ipv4' }).optional().allow(null,''),
    adresse_mac: Joi.string().pattern(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/).optional().allow(null,''),
    latitude:    Joi.number().min(-90).max(90).optional().allow(null),
    longitude:   Joi.number().min(-180).max(180).optional().allow(null),
  }),

  // Modifier le statut d'une borne
  borneStatus: Joi.object({
    statut:       Joi.string().valid('online','offline','warning').required(),
    signal_pct:   Joi.number().min(0).max(100).optional(),
    batterie_pct: Joi.number().min(0).max(100).optional(),
    users_connectes: Joi.number().min(0).optional(),
  }),

  // Paiement Mobile Money
  initPayment: Joi.object({
    tarif_slug: Joi.string().valid('journalier','hebdomadaire','mensuel').required(),
    methode:    Joi.string().valid('orange_money','mtn','wave','moov').required(),
    telephone:  Joi.string().min(8).max(20).required(),
    borne_id:   Joi.string().max(10).optional().allow(null,''),
  }),

  // Pagination
  pagination: Joi.object({
    page:    Joi.number().integer().min(1).default(1),
    limit:   Joi.number().integer().min(1).max(100).default(20),
    search:  Joi.string().max(100).optional().allow(''),
    statut:  Joi.string().optional().allow(''),
    type:    Joi.string().optional().allow(''),
    agent_id: Joi.string().optional().allow(''),
  }),
};

module.exports = { validate, schemas };
