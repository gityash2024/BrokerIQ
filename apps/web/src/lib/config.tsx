'use client';
import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_APP_CONFIG, featureDefault, type PublicConfig } from '@brokeriq/shared';
import { api } from './api';

const fallback: PublicConfig = { app: DEFAULT_APP_CONFIG, flags: {}, integrations: {}, apiVersion: '' };
const Ctx = createContext<PublicConfig>(fallback);

export function ConfigProvider({ initial, children }: { initial: PublicConfig | null; children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ['public-config'],
    queryFn: () => api<PublicConfig>('/public/config', { auth: false }),
    initialData: initial ?? undefined,
    staleTime: 60_000,
  });
  return <Ctx.Provider value={data ?? fallback}>{children}</Ctx.Provider>;
}

export const useConfig = () => useContext(Ctx);
export const useFlag = (key: string) => useContext(Ctx).flags[key] ?? featureDefault(key);
/** Launch phase: everything is free — no pricing, billing, boosts or plan limits anywhere. */
export const useFreeMode = () => useContext(Ctx).app.monetization?.freeMode !== false;
/** Nav/feature gate: a feature flag, or 'paid' = only when free mode is off. */
export const isGateOpen = (cfg: { flags: Record<string, boolean>; app: { monetization?: { freeMode?: boolean } } }, gate?: string) =>
  !gate || (gate === 'paid' ? cfg.app.monetization?.freeMode === false : (cfg.flags[gate] ?? featureDefault(gate)));
