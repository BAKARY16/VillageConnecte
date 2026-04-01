import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import orangeLogo from '../assets/orange.png';
import mtnLogo from '../assets/mtn.png';
import waveLogo from '../assets/wave.png';
import moovLogo from '../assets/moov.png';
import { HandCoins } from 'lucide-react';

const PortalContext = createContext(null);
const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const PORTAL_BACKGROUND_REFRESH_MS = Number(process.env.REACT_APP_PORTAL_REFRESH_MS || 5000);

function normalizeMac(value) {
  const cleaned = String(value || '').trim().replace(/-/g, ':').toUpperCase();
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(cleaned)) return null;
  return cleaned;
}

function pickParam(params, keys) {
  for (const key of keys) {
    const value = params.get(key);
    if (value) return value;
  }
  return '';
}

function parseClientContextFromUrl() {
  if (typeof window === 'undefined') {
    return { mac: null, ip: null, borneId: 'B08' };
  }

  const params = new URLSearchParams(window.location.search || '');
  const mac = normalizeMac(pickParam(params, ['client_mac', 'clientmac', 'mac', 'macAddress']));
  const ip = pickParam(params, ['client_ip', 'clientip', 'ip', 'ipAddress']) || null;
  const borneRaw = pickParam(params, ['borne_id', 'borneId', 'ap_id', 'gatewayid', 'node']) || 'B08';
  const borneId = String(borneRaw).trim().toUpperCase() || 'B08';
  return { mac, ip, borneId };
}

export const PAYMENT_METHODS = [
  { id: 'orange', nom: 'Orange Money', logo: orangeLogo, color: '#FF6B35', bg: 'rgba(255,107,53,0.1)', desc: 'Paiement Orange Money', prefix: '+225', ussd: '#144#', operateur: 'Orange CI' },
  { id: 'mtn', nom: 'MTN MoMo', logo: mtnLogo, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', desc: 'Mobile Money MTN', prefix: '+225', ussd: '*133#', operateur: 'MTN CI' },
  { id: 'wave', nom: 'Wave', logo: waveLogo, color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', desc: 'Paiement par Wave CI', prefix: '+225', ussd: 'App Wave', operateur: 'Wave CI' },
  { id: 'moov', nom: 'Moov Money', logo: moovLogo, color: '#10B981', bg: 'rgba(16,185,129,0.1)', desc: 'Flooz Moov Money', prefix: '+225', ussd: '#555#', operateur: 'Moov Africa' },
  { id: 'cash', nom: 'Cash Agent', emoji: <HandCoins />, color: '#8AA3BE', bg: 'rgba(138,163,190,0.1)', desc: 'Payer chez un agent', prefix: '', ussd: '', operateur: 'Agent local' },
];

async function apiRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || payload.message || 'Erreur API');
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function PortalProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [session, setSession] = useState(null);
  const [clientContext, setClientContext] = useState(() => {
    const fromUrl = parseClientContextFromUrl();
    if (typeof window === 'undefined') return fromUrl;
    try {
      const saved = JSON.parse(localStorage.getItem('vc_client_context') || '{}');
      return {
        mac: fromUrl.mac || normalizeMac(saved.mac) || null,
        ip: fromUrl.ip || saved.ip || null,
        borneId: fromUrl.borneId || saved.borneId || 'B08',
      };
    } catch (error) {
      return fromUrl;
    }
  });

  const [remoteTarifs, setRemoteTarifs] = useState([]);
  const [tarifsLoading, setTarifsLoading] = useState(true);
  const [tarifsError, setTarifsError] = useState('');

  const [portalMeta, setPortalMeta] = useState({
    borne: null,
    totalBornes: 0,
    bornesEnLigne: 0,
    debitReferenceMbps: 5,
  });
  const [portalMetaLoading, setPortalMetaLoading] = useState(true);

  useEffect(() => {
    const fromUrl = parseClientContextFromUrl();
    setClientContext((prev) => {
      const next = {
        mac: fromUrl.mac || prev.mac || null,
        ip: fromUrl.ip || prev.ip || null,
        borneId: fromUrl.borneId || prev.borneId || 'B08',
      };
      localStorage.setItem('vc_client_context', JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('vc_portal_session');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.expireAt && new Date(parsed.expireAt).getTime() > Date.now()) {
        setSession(parsed);
      } else {
        localStorage.removeItem('vc_portal_session');
      }
    } catch (error) {
      localStorage.removeItem('vc_portal_session');
    }
  }, []);

  const loadTarifs = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setTarifsLoading(true);
      setTarifsError('');
    }
    try {
      const data = await apiRequest('/public/tarifs');
      if (!Array.isArray(data.tarifs) || data.tarifs.length === 0) {
        throw new Error('Aucun tarif actif recu depuis l API');
      }
      setRemoteTarifs(data.tarifs);
    } catch (error) {
      if (!silent) {
        setRemoteTarifs([]);
        setTarifsError(error.message || 'Impossible de charger les tarifs');
      }
    } finally {
      if (!silent) setTarifsLoading(false);
    }
  }, []);

  const loadPortalMeta = useCallback(async (borneId = clientContext?.borneId || 'B08', { silent = false } = {}) => {
    if (!silent) setPortalMetaLoading(true);
    try {
      const data = await apiRequest(`/public/portal-meta?borneId=${encodeURIComponent(borneId)}`);
      if (data?.ok && data?.meta) {
        setPortalMeta({
          borne: data.meta.borne || null,
          totalBornes: Number(data.meta.totalBornes || 0),
          bornesEnLigne: Number(data.meta.bornesEnLigne || 0),
          debitReferenceMbps: Number(data.meta.debitReferenceMbps || 5),
        });
      }
    } catch (error) {
      // keep last known metadata
    } finally {
      if (!silent) setPortalMetaLoading(false);
    }
  }, [clientContext?.borneId]);

  useEffect(() => {
    loadTarifs();
    loadPortalMeta(clientContext?.borneId || 'B08');
  }, [loadTarifs, loadPortalMeta, clientContext?.borneId]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const runSilentRefresh = async () => {
      if (cancelled || inFlight || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
      inFlight = true;
      try {
        await Promise.all([
          loadTarifs({ silent: true }),
          loadPortalMeta(clientContext?.borneId || 'B08', { silent: true }),
        ]);
      } finally {
        inFlight = false;
      }
    };

    const interval = setInterval(() => {
      runSilentRefresh();
    }, Math.max(2000, PORTAL_BACKGROUND_REFRESH_MS));

    const onVisible = () => {
      if (document.visibilityState === 'visible') runSilentRefresh();
    };

    window.addEventListener('focus', runSilentRefresh);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', runSilentRefresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadTarifs, loadPortalMeta, clientContext?.borneId]);

  const addToast = useCallback((message, type = 'info', duration = 8000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => setToasts((prev) => prev.filter((toast) => toast.id !== id)), []);

  const validateVoucher = useCallback(async (code) => {
    try {
      return await apiRequest('/captive/vouchers/validate', {
        method: 'POST',
        body: {
          code,
          mac: clientContext?.mac || undefined,
          ipAddress: clientContext?.ip || undefined,
          borneId: clientContext?.borneId || undefined,
        },
      });
    } catch (error) {
      return { ok: false, error: error.message || 'Code invalide ou introuvable. Verifiez votre code.' };
    }
  }, [clientContext]);

  const activateSession = useCallback(async (voucher, macAddress = null) => {
    try {
      const resolvedMac = normalizeMac(macAddress) || clientContext?.mac || undefined;
      const result = await apiRequest('/captive/sessions/activate', {
        method: 'POST',
        body: {
          code: voucher.code,
          macAddress: resolvedMac,
          ipAddress: clientContext?.ip || undefined,
          borneId: clientContext?.borneId || undefined,
        },
      });

      if (result.ok && result.session) {
        setSession(result.session);
        localStorage.setItem('vc_portal_session', JSON.stringify(result.session));
      }
      return result;
    } catch (error) {
      return { ok: false, error: error.message || 'Erreur lors de l activation.' };
    }
  }, [clientContext]);

  const initPayment = useCallback(async ({ tarif, methode, telephone }) => {
    try {
      return await apiRequest('/captive/payments/initiate', {
        method: 'POST',
        body: {
          tarifId: tarif?.id,
          methode: methode?.nom || methode || 'Cash',
          telephone,
        },
      });
    } catch (error) {
      return { ok: false, error: error.message || 'La transaction a echoue. Reessayez.' };
    }
  }, []);

  const checkPaymentStatus = useCallback(async (ref) => {
    try {
      return await apiRequest('/captive/payments/status', {
        method: 'POST',
        body: { ref },
      });
    } catch (error) {
      return { ok: false, statut: 'echoue', error: error.message };
    }
  }, []);

  const getSessionStatus = useCallback(async (sessionId) => {
    try {
      return await apiRequest(`/captive/sessions/${sessionId}/status`);
    } catch (error) {
      return {
        ok: false,
        status: error?.status || 2000,
        error: error.message || 'Statut session indisponible',
      };
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      if (session?.id) {
        await apiRequest(`/captive/sessions/${session.id}/disconnect`, { method: 'POST' });
      }
    } catch (error) {
      // no-op
    } finally {
      setSession(null);
      localStorage.removeItem('vc_portal_session');
      addToast('Session terminee. Merci !', 'info');
    }
  }, [session, addToast]);

  return (
    <PortalContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        session,
        setSession,
        clientContext,
        activateSession,
        disconnect,
        validateVoucher,
        initPayment,
        checkPaymentStatus,
        getSessionStatus,
        remoteTarifs,
        tarifsLoading,
        tarifsError,
        reloadTarifs: loadTarifs,
        portalMeta,
        portalMetaLoading,
        reloadPortalMeta: loadPortalMeta,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export const usePortal = () => {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used within PortalProvider');
  return ctx;
};
