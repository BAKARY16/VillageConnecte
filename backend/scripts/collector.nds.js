'use strict';

/**
 * NDS collector: reads nodogsplash client counters and pushes them to backend.
 *
 * Run:
 *   node scripts/collector.nds.js
 *
 * Required on hotspot/gateway host:
 * - ndsctl command available
 * - backend API reachable
 */

require('dotenv').config();
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const API_BASE = (process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3001/api').replace(/\/$/, '');
const INGEST_URL = `${API_BASE}/captive/metrics/ingest`;
const INGEST_TOKEN = String(process.env.METRICS_INGEST_TOKEN || process.env.INGEST_TOKEN || '').trim();
const BORE_ID = String(process.env.BORNE_ID || process.env.NDS_BORNE_ID || 'B08').trim().toUpperCase();
const POLL_MS = Math.max(2000, Number(process.env.NDS_POLL_MS || 5000));
const NDSCTL_CMD = String(process.env.NDSCTL_CMD || 'ndsctl json').trim();

const previousByMac = new Map();

function toNum(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMac(value) {
  const cleaned = String(value || '').trim().replace(/-/g, ':').toUpperCase();
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(cleaned)) return null;
  return cleaned;
}

function pickValue(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] != null) return obj[key];
  }
  return undefined;
}

function parseNdsClients(payload) {
  if (Array.isArray(payload)) return payload;
  const direct = [
    payload?.clients,
    payload?.client_list,
    payload?.authenticated_clients,
    payload?.auth_clients,
    payload?.data?.clients,
  ];
  for (const candidate of direct) {
    if (Array.isArray(candidate)) return candidate;
  }

  const discovered = [];
  const stack = [payload];
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item || typeof item !== 'object') continue;
    if (Array.isArray(item)) {
      for (const entry of item) stack.push(entry);
      continue;
    }

    const maybeMac = normalizeMac(
      pickValue(item, ['mac', 'mac_addr', 'macAddress', 'client_mac', 'clientMac']),
    );
    if (maybeMac) {
      discovered.push(item);
      continue;
    }

    for (const value of Object.values(item)) {
      if (value && typeof value === 'object') stack.push(value);
    }
  }

  return discovered;
}

function computeRates(mac, rxBytes, txBytes) {
  const now = Date.now();
  const prev = previousByMac.get(mac);
  previousByMac.set(mac, { rxBytes, txBytes, ts: now });

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

function mapClientToSample(client) {
  const mac = normalizeMac(
    pickValue(client, ['mac', 'mac_addr', 'macAddress', 'client_mac', 'clientMac']),
  );
  if (!mac) return null;

  const ip = pickValue(client, ['ip', 'ip_addr', 'ipAddress', 'client_ip', 'clientIp']) || null;

  const rxBytes = toNum(
    pickValue(client, ['downloaded', 'downloaded_bytes', 'rx_bytes', 'rxBytes', 'incoming', 'download']),
    NaN,
  );
  const txBytes = toNum(
    pickValue(client, ['uploaded', 'uploaded_bytes', 'tx_bytes', 'txBytes', 'outgoing', 'upload']),
    NaN,
  );

  if (!Number.isFinite(rxBytes) || !Number.isFinite(txBytes)) return null;

  const rates = computeRates(mac, rxBytes, txBytes);
  return {
    mac,
    ip,
    rxBytes,
    txBytes,
    downMbps: rates.downMbps,
    upMbps: rates.upMbps,
  };
}

async function readNdsSnapshot() {
  const { stdout } = await execAsync(NDSCTL_CMD, { timeout: 10000 });
  return JSON.parse(stdout);
}

async function pushSamples(samples) {
  if (samples.length === 0) return;
  const headers = { 'Content-Type': 'application/json' };
  if (INGEST_TOKEN) headers['x-ingest-token'] = INGEST_TOKEN;

  const response = await fetch(INGEST_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      borneId: BORE_ID,
      source: 'nodogsplash',
      samples,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  const updated = Number(payload.updated || 0);
  const ignored = Number(payload.ignored || 0);
  console.log(`[collector] pushed=${samples.length} updated=${updated} ignored=${ignored}`);
}

async function cycle() {
  try {
    const snapshot = await readNdsSnapshot();
    const clients = parseNdsClients(snapshot);
    const samples = clients
      .map(mapClientToSample)
      .filter(Boolean);

    await pushSamples(samples);
  } catch (error) {
    console.error(`[collector] ${new Date().toISOString()} ${error.message}`);
  }
}

async function start() {
  console.log('[collector] nodogsplash collector started');
  console.log(`[collector] ingest=${INGEST_URL} borne=${BORE_ID} poll_ms=${POLL_MS}`);
  await cycle();
  setInterval(cycle, POLL_MS);
}

start();
