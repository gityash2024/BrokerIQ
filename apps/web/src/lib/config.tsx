'use client';
import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_APP_CONFIG, type PublicConfig } from '@brokeriq/shared';
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
export const useFlag = (key: string) => useContext(Ctx).flags[key] !== false;
