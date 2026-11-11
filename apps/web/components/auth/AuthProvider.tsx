'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { accountApi, ApiError, type AccountUser } from '@/lib/api/account-client';

interface AuthState {
  user: AccountUser | null;
  /** True until the first /me call finishes. */
  loading: boolean;
  /** False when the gateway has accounts disabled (no database) — hide sign-in UI. */
  enabled: boolean;
  /** True after an explicit sign-out in this tab (pages should not bounce to /login). */
  signedOut: boolean;
  refresh: () => Promise<AccountUser | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  enabled: false,
  signedOut: false,
  refresh: async () => null,
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { user } = await accountApi.me();
      setUser(user);
      setEnabled(true);
      if (user) setSignedOut(false);
      return user;
    } catch (err) {
      setUser(null);
      // 401 = signed out (accounts enabled). 503 AUTH_DISABLED or network error = no accounts.
      setEnabled(err instanceof ApiError && err.status === 401);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setSignedOut(true);
    try { await accountApi.logout(); } finally { setUser(null); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return <AuthContext.Provider value={{ user, loading, enabled, signedOut, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
