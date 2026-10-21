import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearAuthTokens,
  deleteSavedDataset,
  getCurrentUser,
  listSavedDatasets,
  loginAccount,
  logoutAccount,
  refreshAccessToken,
  registerAccount,
  uploadSavedDataset,
} from './accountApi.js';

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const [user, setUser] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const reloadDatasets = useCallback(async () => {
    const result = await listSavedDatasets();
    setDatasets(result);
    return result;
  }, []);

  const establishSession = useCallback(async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    await reloadDatasets();
  }, [reloadDatasets]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (await refreshAccessToken()) {
          const currentUser = await getCurrentUser();
          const saved = await listSavedDatasets();
          if (active) {
            setUser(currentUser);
            setDatasets(saved);
          }
        }
      } catch {
        clearAuthTokens();
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    user,
    datasets,
    isLoading,
    async login(credentials) {
      await loginAccount(credentials);
      await establishSession();
    },
    async register(credentials) {
      await registerAccount(credentials);
      await establishSession();
    },
    async logout() {
      try { await logoutAccount(); } finally {
        setUser(null);
        setDatasets([]);
      }
    },
    async saveDataset(file, name) {
      const saved = await uploadSavedDataset(file, name);
      await reloadDatasets();
      return saved;
    },
    async deleteDataset(id) {
      await deleteSavedDataset(id);
      setDatasets((current) => current.filter((dataset) => dataset.id !== id));
    },
    reloadDatasets,
  }), [datasets, establishSession, isLoading, reloadDatasets, user]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error('useAccount must be used inside AccountProvider.');
  return account;
}
