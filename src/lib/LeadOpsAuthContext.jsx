import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!apiClient.getToken()) { setLoading(false); return; }
      try {
        const me = await apiClient.me();
        if (!cancelled) setUser(me.user);
      } catch {
        apiClient.setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function login(email, password) {
    const res = await apiClient.login(email, password);
    apiClient.setToken(res.token);
    setUser(res.user);
    return res.user;
  }

  function logout() {
    apiClient.setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}