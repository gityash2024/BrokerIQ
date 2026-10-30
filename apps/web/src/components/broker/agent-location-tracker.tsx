'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export function AgentLocationTracker() {
  const { user } = useAuth();
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!user || user.role !== 'BROKER_AGENT') return;
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const report = (pos: GeolocationPosition) => {
      const now = Date.now();
      // Send at most once every 3 minutes
      if (now - lastSentRef.current < 3 * 60 * 1000) return;
      lastSentRef.current = now;

      api('/broker/team/agent-location', {
        method: 'POST',
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'WEB_BROWSER',
        }),
      }).catch(() => {});
    };

    navigator.geolocation.getCurrentPosition(report, () => {}, { enableHighAccuracy: true });
    const watchId = navigator.geolocation.watchPosition(report, () => {}, { enableHighAccuracy: true, maximumAge: 60000 });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  return null;
}
