import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext(null);
const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const ADMIN_VISIBLE_REFRESH_MS = Number(process.env.REACT_APP_VISIBLE_REFRESH_MS || 5000);
const ADMIN_HIDDEN_REFRESH_MS = Number(process.env.REACT_APP_HIDDEN_REFRESH_MS || 45000);
const ADMIN_ERROR_BACKOFF_MAX_MS = Number(process.env.REACT_APP_ERROR_BACKOFF_MAX_MS || 120000);

const DEFAULT_KPIS = {
  usersConnectes: 0,
  revenusJour: 0,
  revenusHier: 0,
  revenusSemaine: 0,
  revenusSemainePassee: 0,
  revenusMois: 0,
  vouchersDuJour: 0,
  vouchersSemaine: 0,
  agentsActifs: 0,
  bornesActives: 0,
  bornesTotal: 0,
  bornesOffline: 0,
  alertesActives: 0,
  uptimeGlobal: 0,
};

const DEFAULT_STATS = {
  trafic24h: [],
  revenus30j: [],
};

const DEFAULT_NETWORK_SETTINGS = {
  ssid: 'VillageConnecte',
  channel: '6',
  bandwidth: '20MHz',
  maxUsers: 50,
  captivePortalUrl: 'http://192.168.1.108/portal',
  apiUrl: 'http://localhost:3001',
  cinetpayKey: '',
  cinetpaySiteId: '',
  commissionAgentPct: 12,
  partOperateurPct: 83,
  partCommunautairePct: 5,
};

const DEFAULT_BRANDING_SETTINGS = {
  nomProjet: 'Village Connecte Dioradougou',
  nomOrganisation: 'FabLab UVCI',
  couleurPrimaire: '#55104D',
  couleurSecondaire: '#F29A07',
  logoUrl: '',
  slogan: 'Internet pour tous !',
};

async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Erreur API (${response.status})`);
  }
  return payload;
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('vc_theme') || 'light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [bornes, setBornes] = useState([]);
  const [agents, setAgents] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [alertes, setAlertes] = useState([]);
  const [kpis, setKpis] = useState(DEFAULT_KPIS);
  const [voucherCommands, setVoucherCommands] = useState([]);
  const [tarifs, setTarifs] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [networkSettings, setNetworkSettings] = useState(DEFAULT_NETWORK_SETTINGS);
  const [brandingSettings, setBrandingSettings] = useState(DEFAULT_BRANDING_SETTINGS);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vc_theme', theme);
  }, [theme]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setBornes([]);
    setAgents([]);
    setVouchers([]);
    setTransactions([]);
    setSessions([]);
    setAlertes([]);
    setKpis(DEFAULT_KPIS);
    setVoucherCommands([]);
    setTarifs([]);
    setStats(DEFAULT_STATS);
    setNetworkSettings(DEFAULT_NETWORK_SETTINGS);
    setBrandingSettings(DEFAULT_BRANDING_SETTINGS);
    localStorage.removeItem('vc_user');
    localStorage.removeItem('vc_jwt');
  }, []);

  const refreshData = useCallback(
    async (customToken = token, { notifyError = true, silent = false } = {}) => {
      if (!customToken) return;
      if (!silent) setIsBootstrapping(true);
      try {
        const data = await apiRequest('/admin/bootstrap', { token: customToken });
        setBornes(data.bornes || []);
        setAgents(data.agents || []);
        setVouchers(data.vouchers || []);
        setTransactions(data.transactions || []);
        setSessions(data.sessions || []);
        setAlertes(data.alertes || []);
        setKpis({ ...DEFAULT_KPIS, ...(data.kpis || {}) });
        setVoucherCommands(data.voucherCommands || []);
        setTarifs(data.tarifs || []);
        setStats({ ...DEFAULT_STATS, ...(data.stats || {}) });
        setNetworkSettings({ ...DEFAULT_NETWORK_SETTINGS, ...(data.networkSettings || {}) });
        setBrandingSettings({ ...DEFAULT_BRANDING_SETTINGS, ...(data.brandingSettings || {}) });
      } catch (error) {
        if (notifyError) {
          addToast(error.message || 'Impossible de charger les donnees', 'error');
        }
        if (/token/i.test(error.message || '')) {
          logout();
        }
      } finally {
        if (!silent) setIsBootstrapping(false);
      }
    },
    [token, addToast, logout],
  );

  const login = useCallback(
    async (credentials) => {
      try {
        const data = await apiRequest('/admin/auth/login', {
          method: 'POST',
          body: {
            username: credentials.username,
            password: credentials.password,
          },
        });

        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('vc_user', JSON.stringify(data.user));
        localStorage.setItem('vc_jwt', data.token);
        await refreshData(data.token, { notifyError: false });
        return true;
      } catch (error) {
        return false;
      }
    },
    [refreshData],
  );

  const updateProfile = useCallback(
    async (updates) => {
      if (!token) return false;
      try {
        const data = await apiRequest('/admin/profile', {
          method: 'PUT',
          token,
          body: updates,
        });
        const nextUser = data.user || { ...user, ...updates };
        setUser(nextUser);
        localStorage.setItem('vc_user', JSON.stringify(nextUser));
        addToast('Profil administrateur mis a jour', 'success');
        return true;
      } catch (error) {
        addToast(error.message || 'Mise a jour profil impossible', 'error');
        return false;
      }
    },
    [token, user, addToast],
  );

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!token) return false;
      try {
        await apiRequest('/admin/profile/password', {
          method: 'PUT',
          token,
          body: {
            current_password: currentPassword,
            new_password: newPassword,
          },
        });
        addToast('Mot de passe mis a jour', 'success');
        return true;
      } catch (error) {
        addToast(error.message || 'Mise a jour mot de passe impossible', 'error');
        return false;
      }
    },
    [token, addToast],
  );

  useEffect(() => {
    const savedUser = localStorage.getItem('vc_user');
    const savedToken = localStorage.getItem('vc_jwt');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      refreshData(token, { notifyError: false });
    }
  }, [token, refreshData]);

  useEffect(() => {
    if (!token) return undefined;

    let timeoutId = null;
    let isRefreshing = false;
    let destroyed = false;
    let consecutiveErrors = 0;

    const getNextDelay = (forceVisible = false) => {
      const visible = forceVisible || document.visibilityState === 'visible';
      const baseDelay = visible
        ? Math.max(2000, ADMIN_VISIBLE_REFRESH_MS)
        : Math.max(10000, ADMIN_HIDDEN_REFRESH_MS);

      if (consecutiveErrors <= 0) return baseDelay;
      return Math.min(
        ADMIN_ERROR_BACKOFF_MAX_MS,
        baseDelay * Math.pow(2, Math.min(consecutiveErrors, 4)),
      );
    };

    const scheduleNext = (forceVisible = false) => {
      if (destroyed) return;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(runSilentRefresh, getNextDelay(forceVisible));
    };

    const runSilentRefresh = async () => {
      if (destroyed) return;
      if (isRefreshing || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        scheduleNext();
        return;
      }

      if (document.visibilityState !== 'visible') {
        scheduleNext();
        return;
      }

      isRefreshing = true;
      try {
        await refreshData(token, { notifyError: false, silent: true });
        consecutiveErrors = 0;
      } catch (error) {
        consecutiveErrors += 1;
      } finally {
        isRefreshing = false;
        scheduleNext();
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        consecutiveErrors = 0;
        runSilentRefresh();
      } else {
        scheduleNext();
      }
    };

    scheduleNext();
    window.addEventListener('focus', runSilentRefresh);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      destroyed = true;
      clearTimeout(timeoutId);
      window.removeEventListener('focus', runSilentRefresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, refreshData]);

  // Synchronise les notifications avec les alertes non résolues issues de l'API
  useEffect(() => {
    if (!user || !alertes.length) return;
    const unresolved = alertes.filter((a) => !a.resolue);
    setNotifications(
      unresolved.slice(0, 20).map((a) => ({
        id: a.id,
        type: a.type === 'critical' ? 'error' : a.type === 'warning' ? 'warning' : 'info',
        message: `${a.titre}${a.borneId ? ` — ${a.borneId}` : ''}`,
        time: new Date(a.date),
        read: false,
      })),
    );
  }, [user, alertes]);

  const callAndRefresh = useCallback(
    async (path, options, successMessage, successType = 'success') => {
      if (!token) return false;
      try {
        await apiRequest(path, { ...options, token });
        await refreshData(token, { notifyError: false });
        if (successMessage) addToast(successMessage, successType);
        return true;
      } catch (error) {
        addToast(error.message || 'Operation impossible', 'error');
        return false;
      }
    },
    [token, refreshData, addToast],
  );

  const addBorne = useCallback(
    async (borne) => {
      await callAndRefresh('/admin/bornes', { method: 'POST', body: borne }, 'Nouvelle borne ajoutee');
    },
    [callAndRefresh],
  );

  const updateBorne = useCallback(
    async (id, updates) => {
      await callAndRefresh(`/admin/bornes/${id}`, { method: 'PUT', body: updates }, 'Borne mise a jour avec succes');
    },
    [callAndRefresh],
  );

  const deleteBorne = useCallback(
    async (id) => {
      await callAndRefresh(`/admin/bornes/${id}`, { method: 'DELETE' }, 'Borne supprimee', 'warning');
    },
    [callAndRefresh],
  );

  const addAgent = useCallback(
    async (agent) => {
      await callAndRefresh('/admin/agents', { method: 'POST', body: agent }, `Compte cree pour ${agent.nom}`);
    },
    [callAndRefresh],
  );

  const updateAgent = useCallback(
    async (id, updates) => {
      await callAndRefresh(`/admin/agents/${id}`, { method: 'PUT', body: updates }, 'Agent mis a jour');
    },
    [callAndRefresh],
  );

  const deleteAgent = useCallback(
    async (id) => {
      await callAndRefresh(`/admin/agents/${id}`, { method: 'DELETE' }, 'Agent supprime', 'warning');
    },
    [callAndRefresh],
  );

  const resolveAlerte = useCallback(
    async (id) => {
      await callAndRefresh(`/admin/alertes/${id}/resolve`, { method: 'POST' }, 'Alerte marquee comme resolue');
    },
    [callAndRefresh],
  );

  const disconnectSession = useCallback(
    async (id) => {
      await callAndRefresh(`/admin/sessions/${id}/disconnect`, { method: 'POST' }, 'Session deconnectee', 'warning');
    },
    [callAndRefresh],
  );

  const generateVouchersForAgent = useCallback(
    async (type, count, agentId, paymentMethod = 'Cash') => {
      if (!type || !count) {
        addToast('Type et quantite obligatoires', 'warning');
        return [];
      }
      try {
        const data = await apiRequest('/admin/vouchers/generate', {
          method: 'POST',
          token,
          body: { type, count, agentId: agentId || null, paymentMethod },
        });
        await refreshData(token, { notifyError: false });
        addToast(`${count} vouchers ${type}s generes avec succes`, 'success');
        return data.vouchers || [];
      } catch (error) {
        addToast(error.message || 'Generation impossible', 'error');
        return [];
      }
    },
    [token, refreshData, addToast],
  );

  const generateVouchersBatch = useCallback(
    async (type, count) => generateVouchersForAgent(type, count, null, 'Cash'),
    [generateVouchersForAgent],
  );

  const reactivateVoucher = useCallback(
    async (id) => {
      await callAndRefresh(`/admin/vouchers/${id}/reactivate`, { method: 'POST' }, 'Voucher expire reactive');
    },
    [callAndRefresh],
  );

  const deleteVoucher = useCallback(
    async (id) => {
      await callAndRefresh(`/admin/vouchers/${id}`, { method: 'DELETE' }, 'Voucher supprime', 'warning');
    },
    [callAndRefresh],
  );

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
  }, []);

  const saveTarifs = useCallback(
    async (nextTarifs) => {
      if (!token || !Array.isArray(nextTarifs)) return false;
      try {
        await Promise.all(
          nextTarifs.map((tarif) => {
            const vitesse = Number(String(tarif.debit || '').replace(/[^\d.]/g, '')) || Number(tarif.vitesse_mbps) || 5;
            return apiRequest(`/tarifs/${tarif.id}`, {
              method: 'PUT',
              token,
              body: {
                prix_fcfa: Number(tarif.prix),
                vitesse_mbps: vitesse,
              },
            });
          }),
        );
        await refreshData(token, { notifyError: false });
        addToast('Tarifs sauvegardes', 'success');
        return true;
      } catch (error) {
        addToast(error.message || 'Sauvegarde tarifs impossible', 'error');
        return false;
      }
    },
    [token, refreshData, addToast],
  );

  const saveNetworkSettings = useCallback(
    async (nextNetworkSettings) => {
      if (!token) return false;
      try {
        await apiRequest('/admin/settings/network', {
          method: 'PUT',
          token,
          body: nextNetworkSettings,
        });
        setNetworkSettings((prev) => ({ ...prev, ...nextNetworkSettings }));
        addToast('Configuration reseau sauvegardee', 'success');
        return true;
      } catch (error) {
        addToast(error.message || 'Sauvegarde reseau impossible', 'error');
        return false;
      }
    },
    [token, addToast],
  );

  const saveBrandingSettings = useCallback(
    async (nextBrandingSettings) => {
      if (!token) return false;
      try {
        await apiRequest('/admin/settings/branding', {
          method: 'PUT',
          token,
          body: nextBrandingSettings,
        });
        setBrandingSettings((prev) => ({ ...prev, ...nextBrandingSettings }));
        addToast('Configuration branding sauvegardee', 'success');
        return true;
      } catch (error) {
        addToast(error.message || 'Sauvegarde branding impossible', 'error');
        return false;
      }
    },
    [token, addToast],
  );

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        updateProfile,
        theme,
        setTheme,
        sidebarOpen,
        setSidebarOpen,
        toasts,
        addToast,
        removeToast,
        notifications,
        markNotificationsRead,
        bornes,
        setBornes,
        addBorne,
        updateBorne,
        deleteBorne,
        agents,
        setAgents,
        addAgent,
        updateAgent,
        deleteAgent,
        vouchers,
        generateVouchersBatch,
        generateVouchersForAgent,
        reactivateVoucher,
        deleteVoucher,
        voucherCommands,
        transactions,
        sessions,
        disconnectSession,
        alertes,
        resolveAlerte,
        kpis,
        tarifs,
        stats,
        networkSettings,
        brandingSettings,
        saveTarifs,
        saveNetworkSettings,
        saveBrandingSettings,
        changePassword,
        isBootstrapping,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
