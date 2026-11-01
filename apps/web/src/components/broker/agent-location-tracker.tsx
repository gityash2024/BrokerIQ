'use client';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

/** Browser tracking is limited to an open page and an explicitly active shift. */
export function AgentLocationTracker() {
  const { user } = useAuth();
  const lastSentRef = useRef(0);
  const status = useQuery({
    queryKey: ['time-logging-status', user?.id],
    queryFn: () => api<{ activeShift: { id: string; status: string; pauseReason?: string } | null }>('/time-logging/status'),
    enabled: !!user && ['BROKER_AGENT', 'BROKER_ADMIN'].includes(user.role),
    refetchInterval: 30_000,
  });
  const shift = status.data?.activeShift;
  const enabled = shift?.status === 'ACTIVE' || (shift?.status === 'PAUSED' && shift.pauseReason === 'GPS_SIGNAL_LOST');
  useEffect(() => {
    if (!user || !shift || !enabled || !navigator.geolocation) return;
    const owner = user.id;
    let cancelled = false;
    const report = async (pos: GeolocationPosition) => {
      if (cancelled || Date.now() - lastSentRef.current < 15 * 60_000) return;
      lastSentRef.current = Date.now();
      try {
        const current = await api<{ activeShift: { id: string; status: string; pauseReason?: string } | null }>('/time-logging/status', { ownerId: owner });
        if (
          cancelled ||
          current.activeShift?.id !== shift.id ||
          (current.activeShift.status !== 'ACTIVE' && current.activeShift.pauseReason !== 'GPS_SIGNAL_LOST')
        )
          return;
        await api('/time-logging/location', {
          ownerId: owner,
          body: {
            shiftId: shift.id,
            eventId: crypto.randomUUID(),
            capturedAt: new Date(pos.timestamp).toISOString(),
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: 'WEB_BROWSER',
          },
        });
      } catch {
        lastSentRef.current = 0;
      }
    };
    const watchId = navigator.geolocation.watchPosition(report, () => {}, { enableHighAccuracy: false, maximumAge: 30_000 });
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user?.id, shift?.id, enabled]);
  return null;
}
