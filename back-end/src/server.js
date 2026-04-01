'use strict';
require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

const { testConnection }   = require('./config/database');
const authRoutes           = require('./routes/auth');
const voucherRoutes        = require('./routes/vouchers');
const {
  dashboardRouter,
  bornesRouter,
  agentsRouter,
  sessionsRouter,
  transactionsRouter,
  alertesRouter,
  tarifsRouter,
} = require('./routes/api');

const app  = express();
const PORT = parseInt(process.env.PORT || '3001');

// ── Sécurité ───────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ───────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3002')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les appels sans origin (Postman, cURL, apps mobiles)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} non autorisée.`));
  },
  credentials:  true,
  methods:      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ── Rate Limiting ──────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max:      parseInt(process.env.RATE_LIMIT_MAX       || '200'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Trop de requêtes. Réessayez dans 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: 900000, // 15 min
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10'),
  message:  { success: false, error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
});

const voucherLimiter = rateLimit({
  windowMs: 60000, // 1 min
  max: 30,
  message: { success: false, error: 'Trop de validations. Attendez 1 minute.' },
});

app.use(globalLimiter);

// ── Logging ────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Body parsing ───────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Health check (sans auth) ───────────────────────────
app.get('/health', async (req, res) => {
  const dbOk = await testConnection();
  const status = dbOk ? 200 : 503;
  return res.status(status).json({
    status:    dbOk ? 'ok' : 'degraded',
    service:   'Village Connecté API',
    version:   '1.0.0',
    database:  dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
  });
});

// ── Routes API ─────────────────────────────────────────
app.use('/api/auth',         authLimiter, authRoutes);
app.use('/api/vouchers',     voucherLimiter, voucherRoutes);
app.use('/api/dashboard',    dashboardRouter);
app.use('/api/bornes',       bornesRouter);
app.use('/api/agents',       agentsRouter);
app.use('/api/sessions',     sessionsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/alertes',      alertesRouter);
app.use('/api/tarifs',       tarifsRouter);

// ── 404 ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error:   `Route ${req.method} ${req.path} introuvable.`,
  });
});

// ── Error handler global ───────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, error: 'Cette entrée existe déjà.' });
  }

  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Erreur serveur interne.'
      : err.message,
  });
});

// ── Démarrage ──────────────────────────────────────────
async function start() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  VILLAGE CONNECTÉ — API Backend v1.0.0   ║');
  console.log('║  Dioradougou · FabLab UVCI               ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // Attendre la DB (Docker healthcheck peut avoir un délai)
  let dbReady = false;
  let attempts = 0;
  while (!dbReady && attempts < 30) {
    dbReady = await testConnection();
    if (!dbReady) {
      console.log(`⏳ Waiting for database... (${++attempts}/30)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!dbReady) {
    console.error('❌ Cannot connect to database after 30 attempts. Exiting.');
    process.exit(1);
  }

  console.log('✅ Database connected');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API running on http://0.0.0.0:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('');
    console.log('📋 Endpoints disponibles:');
    console.log(`   GET  /health`);
    console.log(`   POST /api/auth/login`);
    console.log(`   POST /api/vouchers/validate`);
    console.log(`   GET  /api/vouchers/status/:code`);
    console.log(`   GET  /api/dashboard/kpis`);
    console.log(`   GET  /api/bornes`);
    console.log(`   GET  /api/agents`);
    console.log(`   GET  /api/sessions`);
    console.log(`   GET  /api/transactions`);
    console.log(`   GET  /api/alertes`);
    console.log(`   GET  /api/tarifs`);
    console.log('');
  });
}

// Gestion des signaux Docker
process.on('SIGTERM', () => { console.log('SIGTERM received. Shutting down.'); process.exit(0); });
process.on('SIGINT',  () => { console.log('SIGINT received.  Shutting down.'); process.exit(0); });

start();

module.exports = app;
