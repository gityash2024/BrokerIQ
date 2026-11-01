import { useEffect } from 'react';
import { useAuth } from './auth';
import { useTimeTrackingStore } from './time-tracking-store';
import { configureBackgroundShift } from './background-shift-tracking';

/** Membership never implies consent to track outside a disclosed active shift. */
export function useAgentLocationReporter() {
  const { user } = useAuth();
  const shift = useTimeTrackingStore((s) => s.activeShift);
  const paused = useTimeTrackingStore((s) => s.isPaused);
  const reason = useTimeTrackingStore((s) => s.pauseReason);
  useEffect(() => {
    if (user && ['BROKER_AGENT', 'BROKER_ADMIN'].includes(user.role)) useTimeTrackingStore.getState().syncStatus();
    else useTimeTrackingStore.getState().clearLocalShift();
  }, [user?.id, user?.role]);
  useEffect(() => {
    const enabled = !!user && shift?.userId === user.id && shift?.status !== 'COMPLETED' && (!paused || reason === 'GPS_SIGNAL_LOST');
    configureBackgroundShift(enabled ? shift!.id : null).catch((error) => useTimeTrackingStore.setState({ error: error.message }));
  }, [user?.id, shift?.id, shift?.status, paused, reason]);
}
