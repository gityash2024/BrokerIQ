'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export function AgentLocationTracker() {
  const { user } = useAuth();
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!user || (user.role !== 'BROKER_AGENT' && user.role !== 'BROKER_ADMIN')) return;
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const report = (pos: GeolocationPosition) => {
      const now = Date.now();
      // Send at most once every 45 seconds
      if (now - lastSentRef.current < 45 * 1000) return;
      lastSentRef.current = now;

      api('/broker/team/agent-location', {
        method: 'POST',
        body: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          source: 'WEB_BROWSER',
        },
      }).catch((err) => {
        console.warn('Agent location report failed:', err);
      });
    };

    navigator.geolocation.getCurrentPosition(report, (err) => {
      console.warn('Geolocation permission or device error:', err?.message);
    }, { enableHighAccuracy: true });

    const watchId = navigator.geolocation.watchPosition(report, () => {}, { enableHighAccuracy: true, maximumAge: 30000 });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  return null;
}
