import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api';
import { tokenStore } from '../api/client';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get()); // validating a stored token

  useEffect(() => {
    if (!tokenStore.get()) return;
    authApi.me().then((r) => setUser(r.data)).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('fleet:unauthorized', onUnauthorized);
    return () => window.removeEventListener('fleet:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    tokenStore.set(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  const value = useMemo(() => ({
    user, loading, login, logout,
    isAdmin: user?.role === 'admin',
    canWrite: user?.role === 'admin' || user?.role === 'fleet_manager', // create/update/telemetry/geocode
  }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
