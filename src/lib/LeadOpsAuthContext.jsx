import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';
import { base44 } from '@/api/base44Client';

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

  async function logout() {
    apiClient.setToken(null);
    setUser(null);
    try { await base44.auth.logout(); } catch {}
    window.location.href = '/login';
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