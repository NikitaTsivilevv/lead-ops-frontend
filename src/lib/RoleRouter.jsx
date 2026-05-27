import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './LeadOpsAuthContext';

const ROLE_HOME = {
  caller:        '/intake',
  confirmation:  '/leads',
  operations:    '/leads',
  admin:         '/leads',
  client:        '/leads',
};

export function RoleHome() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const dest = ROLE_HOME[user.role] || '/leads';
  return <Navigate to={dest} replace />;
}

export function RequireAuth({ allow, children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}