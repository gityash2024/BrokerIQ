import { router } from 'expo-router';
import type { AuthResponse, AuthUser } from '@brokeriq/shared';
import { api, authStore, captureAccountContext, assertAccountContext, useSession } from './api';
import { unregisterPush } from './push';

export function homeFor(user: AuthUser | null | undefined) {
  if (!user) return '/(user)/home' as const;
  if (['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role)) return '/(broker)/dashboard' as const;
  return user.role === 'USER' ? ('/(user)/home' as const) : ('/login' as const);
}

export function useAuth() {
  const session = useSession((s) => s.session);
  const ready = useSession((s) => s.ready);
  const user = session?.user ?? null;
  return {
    user,
    ready,
    isBroker: !!user && ['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role),
    isBrokerAdmin: user?.role === 'BROKER_ADMIN',
    setSession: (r: AuthResponse) => authStore.set({ accessToken: r.accessToken, refreshToken: r.refreshToken, user: r.user }),
    refreshMe: async () => {
      const cur = authStore.get();
      if (!cur) return;
      const owner = captureAccountContext();
      const me = await api<AuthUser>('/auth/me', { ownerContext: owner });
      assertAccountContext(owner);
      if (authStore.get()?.user.id === cur.user.id) await authStore.set({ ...authStore.get()!, user: me });
    },
    logout: async () => {
      const cur = authStore.get();
      // Clear in-memory ownership and stop native tracking before waiting on network cleanup.
      await authStore.set(null);
      await unregisterPush(cur?.accessToken, cur?.user.id).catch(() => undefined);
      if (cur) await api('/auth/logout', { method: 'POST', auth: false, body: { refreshToken: cur.refreshToken } }).catch(() => undefined);
      router.replace('/login');
    },
  };
}
