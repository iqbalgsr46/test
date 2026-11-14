'use client';

const AUTH_STORAGE_KEY = 'cikaum_admin_logged_in';

export const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
};

const listeners = new Set<() => void>();

export function subscribeAdminAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAdminAuthState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAdminAuthState(loggedIn: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (loggedIn) {
      localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}
