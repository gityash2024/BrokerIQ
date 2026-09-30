'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage, ApiError } from './api';

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Mutation helper: toasts success/error and invalidates keys. */
export function useApiMutation<TVars = any, TRes = any>(
  fn: (vars: TVars) => Promise<TRes>,
  opts: { success?: string | ((r: TRes) => string); invalidate?: QueryKey[]; onSuccess?: (r: TRes, v: TVars) => void; silentError?: boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      opts.onSuccess?.(r, v);
    },
    onError: (e) => {
      if (opts.silentError) return;
      if (e instanceof ApiError && e.isNotConfigured)
        toast.error(e.body.message, {
          duration: 8000,
          action: e.body.integration ? { label: 'Settings', onClick: () => (window.location.href = e.body.integration!.settingsPath) } : undefined,
        });
      else toast.error(errorMessage(e));
    },
  });
}

export const post = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const patch = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
