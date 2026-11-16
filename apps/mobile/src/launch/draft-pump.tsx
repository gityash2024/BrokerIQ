import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/lib/auth';
import { syncDrafts } from './drafts';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
export function DraftPump() {
  const { user, isBroker } = useAuth();
  const lastError = useRef('');
  const qc = useQueryClient();
  useEffect(() => {
    if (!isBroker) return;
    let active = true;
    const pump = async () => {
      try {
        const completed = await syncDrafts();
        if (active) {
          const delegated = user?.role === 'SUB_BROKER_ADMIN';
          const keys = delegated ? [['local-drafts']] : [['local-drafts'], ['ledger'], ['imports']];
          if (completed?.inventoryChanged) keys.push(['ledger'], ['ledger-stats'], ['ledger-item'], ['inventory-folders'], ['inventory-folder-items']);
          if (completed?.leadIds.length) keys.push(['follow-ups'], ['visits'], ['broker-dashboard'], ...completed.leadIds.map((id) => ['lead', id]));
          await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
        }
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
  }, [isBroker, user?.id, user?.role, user?.organization?.id, qc]);
  return null;
}
