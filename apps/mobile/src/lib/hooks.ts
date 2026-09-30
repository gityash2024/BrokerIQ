import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { ApiError, errorMessage } from './api';
import { toast } from './toast';

export function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

/** Shows friendly toasts; "not configured" errors tell the user where the admin must add credentials. */
export function showError(e: unknown) {
  if (e instanceof ApiError && e.isNotConfigured) toast.error(`${e.body.message}`);
  else toast.error(errorMessage(e));
}

export function useApiMutation<V = any, R = any>(
  fn: (v: V) => Promise<R>,
  opts: { success?: string | ((r: R) => string); invalidate?: QueryKey[]; onSuccess?: (r: R, v: V) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      opts.onSuccess?.(r, v);
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      showError(e);
    },
  });
}

/** Light status-bar icons while a screen with a dark header is focused (stack entry is popped on blur). */
export function useLightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      const entry = StatusBar.pushStackEntry({ barStyle: 'light-content', animated: true });
      return () => StatusBar.popStackEntry(entry);
    }, []),
  );
}
