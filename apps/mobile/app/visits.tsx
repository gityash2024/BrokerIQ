import { useState } from 'react';
import { FlatList, Linking } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CalendarCheck, Check, MapPin, Navigation, Phone, Star, X } from 'lucide-react-native';
import { VISIT_STATUS_LABELS, type VisitStatus } from '@brokeriq/shared';
import { api, patch, qs } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Chip, Empty, ErrorView, Header, IconBtn, Input, PressableScale, Row, Screen, Sheet, Skeleton, Txt } from '@/ui';

const TONE: Record<string, string> = { SCHEDULED: '#4F46E5', CONFIRMED: '#0EA5E9', COMPLETED: '#10B981', CANCELLED: '#94A3B8', NO_SHOW: '#E11D48' };

export default function Visits() {
  const { c } = useTheme();
  const [days, setDays] = useState(0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + days);
  const end = new Date(start.getTime() + 7 * 86400_000);
  const q = useQuery({ queryKey: ['visits', days], queryFn: () => api<any[]>(`/visits${qs({ from: start.toISOString(), to: end.toISOString() })}`) });
  const upd = useApiMutation(({ id, ...b }: any) => patch(`/visits/${id}`, b), { invalidate: [['visits'], ['broker-dashboard']] });
  const [done, setDone] = useState<any>(null);
  const [fb, setFb] = useState({ feedback: '', rating: 0 });
  const checkIn = async (v: any) => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return toast.error('Location permission दें');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    upd.mutate({ id: v.id, checkInLat: pos.coords.latitude, checkInLng: pos.coords.longitude }, { onSuccess: () => toast.success('Check-in हो गया 📍') });
  };
  return (
    <Screen scroll={false} padded={false} edges={['top', 'bottom']}>
      <Header title="Site visits" subtitle={`${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(end.getTime() - 1).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`} />
      <Row style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <Chip label="← पिछले 7 दिन" onPress={() => setDays(days - 7)} />
        <Chip label="आज से" active={days === 0} onPress={() => setDays(0)} />
        <Chip label="अगले 7 दिन →" onPress={() => setDays(days + 7)} />
      </Row>
      {q.isError ? <ErrorView error={q.error} /> : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(x) => x.id}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={q.isLoading ? <Skeleton h={120} /> : <Empty icon={<CalendarCheck size={28} color={c.brand} />} title="कोई visit नहीं" text="Lead page से visit schedule करें।" />}
          renderItem={({ item: v, index }) => {
            const open = v.status === 'SCHEDULED' || v.status === 'CONFIRMED';
            const loc = v.listing?.latitude ? `${v.listing.latitude},${v.listing.longitude}` : v.address ?? v.listing?.address;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30)}>
                <Card style={{ padding: 14, gap: 8 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="bodyStrong" onPress={() => router.push(`/lead/${v.lead.id}`)}>{v.lead.name}</Txt>
                    <Badge label={VISIT_STATUS_LABELS[v.status as VisitStatus]} color={TONE[v.status]} />
                  </Row>
                  <Txt v="small" color="brand">{new Date(v.scheduledAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Txt>
                  {!!(v.listing?.title || v.address) && <Row gap={4}><MapPin size={13} color={c.muted} /><Txt v="small" color="muted" style={{ flex: 1 }}>{v.listing?.title ?? v.address}</Txt></Row>}
                  {v.checkInAt && <Txt v="caption" color="success">📍 Checked-in {new Date(v.checkInAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</Txt>}
                  <Row wrap gap={6}>
                    <IconBtn onPress={() => Linking.openURL(`tel:${v.lead.phone}`)} style={{ backgroundColor: c.surface2 }}><Phone size={17} color={c.brand} /></IconBtn>
                    {!!loc && <IconBtn onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc)}`)} style={{ backgroundColor: c.surface2 }}><Navigation size={17} color={c.brand} /></IconBtn>}
                    {open && v.status === 'SCHEDULED' && <Chip label="Confirm" onPress={() => upd.mutate({ id: v.id, status: 'CONFIRMED' })} />}
                    {open && !v.checkInAt && <Chip label="📍 Check-in" onPress={() => checkIn(v)} />}
                    {open && <Chip label="✓ Done" color={c.success} active onPress={() => (setDone(v), setFb({ feedback: '', rating: 0 }))} />}
                    {open && new Date(v.scheduledAt) < new Date() && <Chip label="No-show" onPress={() => upd.mutate({ id: v.id, status: 'NO_SHOW' })} />}
                    {open && new Date(v.scheduledAt) > new Date() && <IconBtn onPress={() => upd.mutate({ id: v.id, status: 'CANCELLED' })}><X size={17} color={c.muted} /></IconBtn>}
                  </Row>
                </Card>
              </Animated.View>
            );
          }}
        />
      )}
      <Sheet open={!!done} onClose={() => setDone(null)} title="Visit कैसी रही?">
        <Row>{[1, 2, 3, 4, 5].map((n) => <PressableScale key={n} onPress={() => setFb({ ...fb, rating: n })}><Star size={34} color="#F59E0B" fill={n <= fb.rating ? '#F59E0B' : 'transparent'} /></PressableScale>)}</Row>
        <Input value={fb.feedback} onChangeText={(v) => setFb({ ...fb, feedback: v })} multiline placeholder="Client का feedback" />
        <Button title="Save" variant="success" icon={<Check size={18} color="#fff" />} onPress={() => upd.mutate({ id: done.id, status: 'COMPLETED', feedback: fb.feedback || null, rating: fb.rating || null }, { onSuccess: () => (setDone(null), toast.success('Visit completed')) })} />
      </Sheet>
    </Screen>
  );
}
