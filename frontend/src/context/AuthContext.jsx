import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  authApi,
  getStoredToken,
  setOnUnauthorized,
  setStoredToken,
} from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => logout);
  }, [logout]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateUser() {
      const token = getStoredToken();
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const res = await authApi.me();
        if (isMounted) {
          setUser(res.user);
        }
      } catch {
        setStoredToken(null);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    hydrateUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await authApi.login(credentials);
    setStoredToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await authApi.register(payload);
    setStoredToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
