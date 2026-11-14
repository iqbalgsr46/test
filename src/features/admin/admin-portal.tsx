'use client';

import { useSyncExternalStore } from 'react';
import {
  getAdminAuthState,
  setAdminAuthState,
  subscribeAdminAuth,
} from './admin-auth';
import { AdminLogin } from './admin-login';
import { AdminDashboard } from './admin-dashboard';

export function AdminPortal() {
  const isAuth = useSyncExternalStore(
    subscribeAdminAuth,
    getAdminAuthState,
    () => false,
  );

  function handleLoginSuccess() {
    setAdminAuthState(true);
  }

  function handleLogout() {
    setAdminAuthState(false);
  }

  if (!isAuth) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return <AdminDashboard onLogout={handleLogout} />;
}
