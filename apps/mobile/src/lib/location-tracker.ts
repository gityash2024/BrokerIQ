import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function useAgentLocationReporter() {
  const { user } = useAuth();
  const lastReportRef = useRef<number>(0);

  useEffect(() => {
    if (!user || user.role !== 'BROKER_AGENT') return;

    let subscriber: Location.LocationSubscription | null = null;
    let isCancelled = false;

    const reportPos = async (coords: Location.LocationObjectCoords) => {
      const now = Date.now();
      // Report at most once every 3 minutes
      if (now - lastReportRef.current < 3 * 60 * 1000) return;
      lastReportRef.current = now;

      try {
        await post('/broker/team/agent-location', {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          source: 'MOBILE_APP',
        });
      } catch {}
    };

    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || isCancelled) return;

        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (initial?.coords && !isCancelled) {
          reportPos(initial.coords);
        }

        subscriber = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 100, // Report every 100 meters
            timeInterval: 3 * 60 * 1000, // or 3 minutes
          },
          (loc) => {
            if (loc?.coords && !isCancelled) {
              reportPos(loc.coords);
            }
          },
        );
      } catch {}
    };

    startTracking();

    return () => {
      isCancelled = true;
      subscriber?.remove();
    };
  }, [user]);
}
