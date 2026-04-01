const { v4: uuidv4 } = require('uuid');

const CODE_CHARS   = process.env.VOUCHER_CODE_CHARS || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH  = parseInt(process.env.VOUCHER_CODE_LENGTH || '8');

/**
 * Générer un code voucher alphanumérique unique
 */
function generateCode(length = CODE_LENGTH) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * Générer un lot de codes uniques
 */
async function generateUniqueCodes(count, existingCodes = new Set()) {
  const codes = [];
  let attempts = 0;
  const maxAttempts = count * 20;

  while (codes.length < count && attempts < maxAttempts) {
    const code = generateCode();
    if (!existingCodes.has(code) && !codes.includes(code)) {
      codes.push(code);
    }
    attempts++;
  }

  if (codes.length < count) {
    throw new Error(`Impossible de générer ${count} codes uniques après ${maxAttempts} tentatives`);
  }

  return codes;
}

/**
 * Calculer la date d'expiration d'un voucher
 * La durée commence DÈS L'ACTIVATION (pas la création)
 * et continue même si l'utilisateur se déconnecte
 */
function calculateExpiry(activatedAt, dureeHeures) {
  const base = new Date(activatedAt);
  return new Date(base.getTime() + dureeHeures * 60 * 60 * 1000);
}

/**
 * Vérifier si un voucher est toujours valide (non expiré)
 */
function isVoucherValid(expiresAt) {
  if (!expiresAt) return false;
  return new Date() < new Date(expiresAt);
}

/**
 * Calculer les secondes restantes d'un voucher
 */
function secondesRestantes(expiresAt) {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}

/**
 * Formater la durée en texte lisible
 */
function formatDuree(secondes) {
  if (secondes <= 0) return 'Expiré';
  const j = Math.floor(secondes / 86400);
  const h = Math.floor((secondes % 86400) / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  if (j > 0)  return `${j}j ${h}h ${m}min`;
  if (h > 0)  return `${h}h ${m}min`;
  return `${m}min`;
}

/**
 * Référence de transaction unique
 */
function generateTransactionRef() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2,6).toUpperCase();
  return `VC${ts}${rand}`;
}

module.exports = {
  generateCode,
  generateUniqueCodes,
  calculateExpiry,
  isVoucherValid,
  secondesRestantes,
  formatDuree,
  generateTransactionRef,
};
