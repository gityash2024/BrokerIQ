import { useEffect } from 'react';
import { readLaunchConfig, saveLaunchConfig } from '@/launch/drafts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_APP_CONFIG, type PublicConfig, featureDefault } from '@brokeriq/shared';
import { api } from './api';

const FALLBACK: PublicConfig = { app: DEFAULT_APP_CONFIG, flags: {}, integrations: {}, apiVersion: '' };

/** Runtime config from Super Admin (branding, flags, public integration keys, versions). */
export function useConfig() {
  const client = useQueryClient();
  useEffect(() => {
    let active = true;
    readLaunchConfig()
      .then((cached) => {
        if (active && cached && !client.getQueryData(['public-config'])) client.setQueryData(['public-config'], cached, { updatedAt: 0 });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [client]);
  const q = useQuery({
    queryKey: ['public-config'],
    queryFn: async () => {
      const result = await api<PublicConfig>('/public/config', { auth: false });
      await saveLaunchConfig(result).catch(() => undefined);
      return result;
    },
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
  return { ...(q.data ?? FALLBACK), loaded: !!q.data, error: q.error, refetch: q.refetch };
}

export function useFlag(key: string) {
  const { flags } = useConfig();
  return flags[key] ?? featureDefault(key);
}

/** Launch phase: everything is free — no pricing, billing, boosts or plan limits anywhere. */
export function useFreeMode() {
  return useConfig().app.monetization?.freeMode !== false;
}

export function cmpVersion(a: string, b: string) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}
