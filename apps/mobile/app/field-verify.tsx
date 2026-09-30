import { useEffect, useState } from 'react';
import { FlatList, Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BadgeCheck, Camera, LocateFixed, MapPin, Navigation } from 'lucide-react-native';
import { api, img, post, uploadUri } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Button, Card, Empty, ErrorView, Header, IconBtn, Row, Screen, Skeleton, Txt } from '@/ui';

async function position() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('Location permission दें');
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
}

/**
 * BrokerIQ field team (Super Admin): stand at the property, take a photo — the phone's GPS proves the visit.
 * Server accepts it within 300 m of the listing pin (1.5 km of the locality when there's no pin).
 */
export default function FieldVerify() {
  const { c } = useTheme();
  const { user } = useAuth();
  const admin = user?.role === 'SUPER_ADMIN';
  const [near, setNear] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['visit-queue', near], queryFn: () => api<any[]>(`/admin/visit-verification${near ? `?near=${near}` : ''}`), enabled: admin });

  const locate = async (silent = false) => {
    try {
      const p = await position();
      setNear(`${p.coords.latitude},${p.coords.longitude}`);
    } catch (e) {
      if (!silent) showError(e);
    }
  };
  useEffect(() => {
    if (admin) locate(true);
  }, [admin]);

  const verify = async (id: string) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return toast.error('Camera permission दें');
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (shot.canceled) return;
    setBusy(id);
    try {
      // Position at the moment of the photo — this is what the server checks against the pin.
      const pos = await position();
      const a = shot.assets[0];
      const small = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: Math.min(1600, a.width || 1600) } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      const { url } = await uploadUri(small.uri, 'listing');
      await post(`/admin/listings/${id}/visit-verify`, { photos: [{ url, lat: pos.coords.latitude, lng: pos.coords.longitude }] });
      toast.success('✅ Visit verified');
      q.refetch();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  };

  if (!admin)
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Field verification" />
        <Empty icon={<BadgeCheck size={28} color={c.brand} />} title="यह BrokerIQ team के लिए है" />
      </Screen>
    );

  return (
    <Screen scroll={false} padded={false} edges={['top', 'bottom']}>
      <Header title="Field verification" subtitle={near ? 'आपके सबसे पास वाली पहले' : 'Property पर पहुँचकर photo लें'} right={<IconBtn onPress={() => locate()}><LocateFixed size={20} color={c.brand} /></IconBtn>} />
      <Txt v="small" color="muted" style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        Photo के साथ phone का GPS जाता है — map pin से 300 m के अंदर (pin न हो तो locality से 1.5 km) होने पर "Visit verified" badge लगता है।
      </Txt>
      {q.isError ? (
        <ErrorView error={q.error} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(x) => x.id}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={q.isLoading ? <Skeleton h={160} /> : <Empty icon={<MapPin size={28} color={c.brand} />} title="सब listings verified हैं" />}
          renderItem={({ item: l, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30)}>
              <Card style={{ overflow: 'hidden' }}>
                <View style={{ height: 140, backgroundColor: c.surface2 }}>
                  {l.coverUrl && <Image source={{ uri: img(l.coverUrl, 600) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
                </View>
                <View style={{ padding: 14, gap: 6 }}>
                  <Txt v="bodyStrong" numberOfLines={1} onPress={() => router.push(`/property/${l.slug}`)}>{l.title}</Txt>
                  <Txt v="small" color="muted" numberOfLines={2}>
                    {[l.societyName, l.address, l.locality?.name].filter(Boolean).join(', ')}
                    {l.km != null ? ` · ${l.km} km दूर` : ''}
                  </Txt>
                  <Txt v="caption" color="subtle">{l.organization?.name ?? 'Owner'}{l.latitude == null ? ' · map pin नहीं' : ''}</Txt>
                  <Row style={{ marginTop: 6 }}>
                    <Button size="sm" title="Photo लेकर verify" icon={<Camera size={16} color="#fff" />} loading={busy === l.id} disabled={!!busy} onPress={() => verify(l.id)} style={{ flex: 1 }} />
                    <Button size="sm" variant="secondary" title="Directions" icon={<Navigation size={16} color={c.fg} />} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${l.point.lat},${l.point.lng}`)} />
                  </Row>
                </View>
              </Card>
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );
}
