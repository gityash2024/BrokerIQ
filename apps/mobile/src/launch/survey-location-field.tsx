import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { errorMessage } from '@/lib/api';
import { readSurveyLocation } from '@/lib/survey-location';
import { useTheme } from '@/lib/theme';
import { Button, Input, Txt } from '@/ui';

export function SurveyLocationField({
  value,
  onChange,
  disabled,
  onReading,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  onReading: (reading: boolean) => void;
}) {
  const { c } = useTheme();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [accuracy, setAccuracy] = useState<number>();
  const latestChange = useRef(onChange);
  latestChange.current = onChange;
  const mounted = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function capture() {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setReading(true);
    onReading(true);
    setError('');
    try {
      const position = await readSurveyLocation();
      if (!mounted.current) return;
      latestChange.current(position.link);
      setAccuracy(position.accuracy);
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setReading(false);
        onReading(false);
      }
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Input
        label="Directions link or latitude, longitude"
        value={value ?? ''}
        editable={!disabled && !reading}
        autoCapitalize="none"
        onChangeText={(text) => {
          latestChange.current(text);
          setAccuracy(undefined);
          setError('');
        }}
      />
      <Button
        title="Use current location"
        disabled={disabled}
        loading={reading}
        variant="secondary"
        size="sm"
        icon={<MapPin size={16} color={c.brand} />}
        onPress={() => void capture()}
      />
      {accuracy !== undefined && (
        <Txt v="caption" color="muted">
          Property pin captured · about {accuracy} m accuracy
        </Txt>
      )}
      {!!error && (
        <Txt v="caption" color="danger" accessibilityRole="alert">
          {error}
        </Txt>
      )}
    </View>
  );
}
