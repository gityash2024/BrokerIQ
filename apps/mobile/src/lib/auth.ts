import { router } from 'expo-router';
import type { AuthResponse, AuthUser } from '@brokeriq/shared';
import { api, authStore, useSession } from './api';
import { unregisterPush } from './push';

export function homeFor(user: AuthUser | null | undefined) {
  if (!user) return '/login' as const;
  if (user.role === 'BROKER_ADMIN' || user.role === 'BROKER_AGENT') return '/(broker)/dashboard' as const;
  return '/login' as const;
}

export function useAuth() {
  const session = useSession((s) => s.session);
  const ready = useSession((s) => s.ready);
  const user = session?.user ?? null;
  return {
    user,
    ready,
    isBroker: user?.role === 'BROKER_ADMIN' || user?.role === 'BROKER_AGENT',
    isBrokerAdmin: user?.role === 'BROKER_ADMIN',
    setSession: (r: AuthResponse) => authStore.set({ accessToken: r.accessToken, refreshToken: r.refreshToken, user: r.user }),
    refreshMe: async () => {
      const cur = authStore.get();
      if (!cur) return;
      const me = await api<AuthUser>('/auth/me');
      await authStore.set({ ...cur, user: me });
    },
    logout: async () => {
      const cur = authStore.get();
      await unregisterPush().catch(() => undefined);
      if (cur) await api('/auth/logout', { method: 'POST', body: { refreshToken: cur.refreshToken } }).catch(() => undefined);
      await authStore.set(null);
      router.replace('/login');
    },
  };
}
