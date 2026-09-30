'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthResponse, AuthUser } from '@brokeriq/shared';
import { api, authStore } from './api';

interface AuthCtx {
  user: AuthUser | null;
  ready: boolean;
  isBroker: boolean;
  isAdmin: boolean;
  setSession: (r: AuthResponse) => void;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
  homePath: string;
}

const Ctx = createContext<AuthCtx | null>(null);

export function homeFor(user: AuthUser | null) {
  if (!user) return '/';
  if (user.role === 'SUPER_ADMIN') return '/admin';
  if (user.role === 'BROKER_ADMIN' || user.role === 'BROKER_AGENT')
    return user.organization?.onboarded === false && user.role === 'BROKER_ADMIN' ? '/broker/onboarding' : '/broker';
  return '/account';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const sync = () => setUser(authStore.get()?.user ?? null);
    sync();
    setReady(true);
    window.addEventListener('biq-auth', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('biq-auth', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setSession = useCallback((r: AuthResponse) => {
    authStore.set({ accessToken: r.accessToken, refreshToken: r.refreshToken, user: r.user });
  }, []);

  const refreshMe = useCallback(async () => {
    const cur = authStore.get();
    if (!cur) return;
    const me = await api<AuthUser>('/auth/me');
    authStore.set({ ...cur, user: me });
  }, []);

  const logout = useCallback(async () => {
    const cur = authStore.get();
    authStore.set(null);
    await api('/auth/logout', { method: 'POST', body: { refreshToken: cur?.refreshToken }, auth: false }).catch(() => undefined);
    router.push('/');
  }, [router]);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      ready,
      isBroker: user?.role === 'BROKER_ADMIN' || user?.role === 'BROKER_AGENT',
      isAdmin: user?.role === 'SUPER_ADMIN',
      setSession,
      refreshMe,
      logout,
      homePath: homeFor(user),
    }),
    [user, ready, setSession, refreshMe, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
