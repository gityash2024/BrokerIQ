import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { reportAppError } from '@/lib/report-error';

/**
 * Screen shown when a route crashes. Rendered outside the app's providers (theme, fonts may be missing),
 * so it uses plain React Native views with fixed colours. The error goes to Admin → Health → Errors.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportAppError(error, 'error-boundary');
  }, [error]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#F6F7FB' }}>
      <Text style={{ fontSize: 44 }}>⚠️</Text>
      <Text style={{ marginTop: 12, fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center' }}>कुछ गड़बड़ हो गई</Text>
      <Text style={{ marginTop: 8, fontSize: 15, lineHeight: 22, color: '#475569', textAlign: 'center' }}>
        यह screen ठीक से नहीं खुल पाई। हमारी team को अपने-आप खबर मिल गई है।
      </Text>
      <Pressable onPress={() => retry()} style={{ marginTop: 24, backgroundColor: '#4F46E5', paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>दोबारा कोशिश करें</Text>
      </Pressable>
    </View>
  );
}
