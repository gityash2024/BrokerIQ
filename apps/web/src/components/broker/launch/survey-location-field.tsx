'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { surveyLocationLink } from '@brokeriq/shared';
import { assertAccountContext, captureAccountContext, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function SurveyLocationField({
  value,
  onChange,
  disabled,
  onReading,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onReading: (reading: boolean) => void;
}) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [accuracy, setAccuracy] = useState<number>();
  const active = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function capture() {
    if (disabled || inFlight.current) return;
    if (!navigator.geolocation) {
      setError('Location is unavailable in this browser. Enter the property map link.');
      return;
    }
    const owner = captureAccountContext();
    inFlight.current = true;
    setReading(true);
    onReading(true);
    setError('');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (failure) =>
            reject(
              new Error(
                failure.code === 1
                  ? 'Allow location access or enter the property map link.'
                  : 'Could not get a location fix. Try again or enter the property map link.',
              ),
            ),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
        );
      });
      if (!active.current) return;
      assertAccountContext(owner);
      onChange(surveyLocationLink(position.coords));
      setAccuracy(Math.ceil(position.coords.accuracy));
    } catch (cause) {
      if (active.current) setError(errorMessage(cause));
    } finally {
      inFlight.current = false;
      if (active.current) {
        setReading(false);
        onReading(false);
      }
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-muted">
        Directions link or latitude, longitude
        <input
          name="directionsUrl"
          value={value}
          disabled={disabled}
          readOnly={reading}
          onChange={(event) => {
            onChange(event.target.value);
            setAccuracy(undefined);
            setError('');
          }}
          className="mt-1 block min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg"
        />
      </label>
      <Button type="button" variant="secondary" size="sm" loading={reading} disabled={disabled} onClick={() => void capture()}>
        <MapPin className="size-4" /> Use current location
      </Button>
      {accuracy !== undefined && (
        <p role="status" className="text-xs text-muted">
          Property pin captured · about {accuracy} m accuracy
        </p>
      )}
      {!!error && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
