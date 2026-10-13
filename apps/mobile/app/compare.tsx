// BROKER-ONLY LAUNCH: Consumer screen disabled
// Original code commented out below
import { View } from 'react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Screen, Txt } from '@/ui';

export default function DisabledScreen() {
  useEffect(() => {
    // Auto-redirect to broker dashboard
    const timer = setTimeout(() => router.replace('/(broker)/dashboard'), 2000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Screen title="Coming Soon">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Txt v="h2" center>🚧 Coming Soon</Txt>
        <Txt v="body" center style={{ marginTop: 8, opacity: 0.6 }}>
          यह feature जल्द ही उपलब्ध होगा। Broker Dashboard पर redirect हो रहे हैं...
        </Txt>
      </View>
    </Screen>
  );
}

/* === ORIGINAL CODE (commented out for broker-only launch) ===
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { FURNISHING_LABELS, formatINR } from '@brokeriq/shared';
import { api, img } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { Button, ErrorView, Header, Loader, Screen, Txt } from '@/ui';

const ROWS: [string, (l: any) => string][] = [
  ['किराया', (l) => `${formatINR(l.price)}/mo`],
  ['Deposit', (l) => (l.securityDeposit ? formatINR(l.securityDeposit) : '—')],
  ['Maintenance', (l) => (l.maintenance ? formatINR(l.maintenance) : '—')],
  ['BHK / bath', (l) => `${l.bedrooms ?? '—'} / ${l.bathrooms ?? '—'}`],
  ['Area', (l) => (l.superArea || l.builtUpArea || l.carpetArea ? `${l.superArea ?? l.builtUpArea ?? l.carpetArea} sq.ft` : '—')],
  ['Furnishing', (l) => (l.furnishing ? FURNISHING_LABELS[l.furnishing as keyof typeof FURNISHING_LABELS] : '—')],
  ['Floor', (l) => (l.floor != null ? `${l.floor}${l.totalFloors ? `/${l.totalFloors}` : ''}` : '—')],
  ['Parking', (l) => (l.parking != null ? String(l.parking) : '—')],
  ['Amenities', (l) => String(l.amenities?.length ?? 0)],
  ['Verified', (l) => (l.isVerified || l.visitVerifiedAt ? '✓' : '—')],
];
const COL = 150;

/** 2–4 saved homes side by side (scroll sideways). */
export default function Compare() {
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="घरों की तुलना" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }}>
        <Txt v="h2">Coming Soon</Txt>
        <Txt color="muted" style={{ textAlign: 'center' }}>
          यह फीचर जल्द ही उपलब्ध होगा।
        </Txt>
      </View>
    </Screen>
  );
  /*
  const { c } = useTheme();
  const { ids = '' } = useLocalSearchParams<{ ids: string }>();
  const q = useQuery({ queryKey: ['compare', ids], queryFn: () => api<any[]>(`/public/compare?ids=${ids}`, { auth: false }), enabled: !!ids });
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="घरों की तुलना" />
      {q.isError ? (
        <ErrorView error={q.error} />
      ) : !q.data ? (
        <Loader />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 96 }} />
              {q.data.map((l) => (
                <View key={l.id} style={{ width: COL, padding: 6, gap: 4 }}>
                  <Image
                    source={{ uri: l.coverUrl ? img(l.coverUrl, 300) : undefined }}
                    style={{ width: COL - 12, height: 90, borderRadius: 12, backgroundColor: c.surface2 }}
                  />
                  <Txt v="small" numberOfLines={2} style={{ fontWeight: '700' }}>
                    {l.title}
                  </Txt>
                </View>
              ))}
            </View>
            {ROWS.map(([label, get]) => (
              <View key={label} style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: c.line }}>
                <Txt v="caption" color="muted" style={{ width: 96, paddingVertical: 10 }}>
                  {label}
                </Txt>
                {q.data.map((l) => (
                  <Txt key={l.id} v="small" style={{ width: COL, padding: 10 }}>
                    {get(l)}
                  </Txt>
                ))}
              </View>
            ))}
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <View style={{ width: 96 }} />
              {q.data.map((l) => (
                <View key={l.id} style={{ width: COL, padding: 6 }}>
                  <Button title="देखें" size="sm" onPress={() => router.push(`/property/${l.slug}`)} />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
  */
}

=== END ORIGINAL CODE === */
