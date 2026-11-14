import { hasDelegatedAccess } from '@brokeriq/shared';
import { useEffect } from 'react';
import { useAuth } from './auth';
import { authStore } from './api';
import { useTimeTrackingStore } from './time-tracking-store';
import { trackingBinding } from './shift-location-outbox';
import { configureBackgroundShift } from './background-shift-tracking';

/** Membership never implies consent to track outside a disclosed active shift. */
export function useAgentLocationReporter() {
  const { user } = useAuth();
  const shift = useTimeTrackingStore((s) => s.activeShift);
  const paused = useTimeTrackingStore((s) => s.isPaused);
  const reason = useTimeTrackingStore((s) => s.pauseReason);
  const canTrack = !!user && (['BROKER_AGENT', 'BROKER_ADMIN'].includes(user.role) ||
    (user.role === 'SUB_BROKER_ADMIN' && hasDelegatedAccess(user, 'time_logging', 'create')));
  useEffect(() => {
    const restore = async () => {
      if (!user || !canTrack) {
        await useTimeTrackingStore.getState().clearLocalShift();
        return;
      }
      const binding = await trackingBinding();
      if (authStore.get()?.user.id !== user.id) return;
      if (binding && binding.ownerId !== user.id) await configureBackgroundShift(null);
      await useTimeTrackingStore.getState().loadPersistedState();
      if (authStore.get()?.user.id === user.id) await useTimeTrackingStore.getState().syncStatus();
    };
    restore().catch((error) => useTimeTrackingStore.setState({ error: error.message }));
  }, [user?.id, canTrack]);
  useEffect(() => {
    // Null UI state during hydration is not evidence that the server shift ended.
    if (!canTrack || !user || !shift || shift.userId !== user.id) return;
    const enabled = !!user && shift?.userId === user.id && shift?.status !== 'COMPLETED' && (!paused || reason === 'GPS_SIGNAL_LOST');
    configureBackgroundShift(shift.id, enabled, { reason: reason || 'MANUAL', at: shift.pausedAt || new Date().toISOString() }).catch((error) =>
      useTimeTrackingStore.setState({ error: error.message }),
    );
  }, [canTrack, user?.id, shift?.id, shift?.status, paused, reason]);
}
