import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/lib/auth';
import { syncDrafts } from './drafts';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
export function DraftPump() {
  const { user } = useAuth();
  const lastError = useRef('');
  const qc = useQueryClient();
  useEffect(() => {
    if (user?.role !== 'BROKER_ADMIN') return;
    let active = true;
    const pump = async () => {
      try {
        await syncDrafts();
        if (active) await Promise.all(['local-drafts', 'ledger', 'imports'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      } catch (e) {
        if (active && lastError.current !== (e as Error).message) {
          lastError.current = (e as Error).message;
          toast.error((e as Error).message);
        }
      }
    };
    void pump();
    const interval = setInterval(pump, 15000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void pump();
    });
    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [user?.id, qc]);
  return null;
}
