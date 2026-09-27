import { useState } from 'react';
import { FlatList, Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MessageCircle, Phone, Send } from 'lucide-react-native';
import { formatPriceShort, timeAgo, whatsappLink } from '@brokeriq/shared';
import { api, patch } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { Badge, Card, Empty, ErrorView, Header, IconBtn, Row, Screen, Segmented, Skeleton, Txt } from '@/ui';

const TONE: Record<string, string> = { NEW: '#4F46E5', RESPONDED: '#10B981', CLOSED: '#94A3B8' };

export default function Enquiries() {
  const { c } = useTheme();
  const [tab, setTab] = useState<'sent' | 'received'>('sent');
  const q = useQuery({ queryKey: ['enquiries', tab], queryFn: () => api<any[]>(`/enquiries/${tab}`) });
  const upd = useApiMutation((b: { id: string; status: string }) => patch(`/enquiries/${b.id}`, { status: b.status }), { invalidate: [['enquiries']] });
  return (
    <Screen scroll={false} padded={false}>
      <Header title="Enquiries" />
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'sent', label: 'मैंने भेजी' }, { value: 'received', label: 'मेरी listings पर आईं' }]} />
      </View>
      {q.isError ? <ErrorView error={q.error} /> : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(x) => x.id}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={q.isLoading ? <Skeleton h={90} /> : <Empty icon={<Send size={28} color={c.brand} />} title="कोई enquiry नहीं" text={tab === 'sent' ? 'किसी property पर "Enquire" दबाएँ।' : 'अपनी property post करें — buyers की enquiries यहाँ आएँगी।'} />}
          renderItem={({ item: e, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 40)}>
              <Card style={{ padding: 14, gap: 6 }} onPress={() => e.listing && router.push(`/property/${e.listing.slug}`)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Badge label={e.status} color={TONE[e.status]} />
                  <Txt v="caption" color="subtle">{timeAgo(e.createdAt)}</Txt>
                </Row>
                <Txt v="bodyStrong" numberOfLines={1}>{e.listing?.title ?? e.project?.name ?? e.organization?.name ?? 'General enquiry'}</Txt>
                {tab === 'sent' && e.listing && <Txt v="small" color="muted">{formatPriceShort(e.listing.price)} · {e.listing.locality?.name}</Txt>}
                {tab === 'received' && (
                  <>
                    <Txt v="small">{e.name} · {e.phone}</Txt>
                    {!!e.message && <Txt v="small" color="muted">“{e.message}”</Txt>}
                    <Row style={{ marginTop: 4 }}>
                      <IconBtn onPress={() => Linking.openURL(`tel:${e.phone}`)} style={{ backgroundColor: c.surface2 }}><Phone size={18} color={c.fg} /></IconBtn>
                      <IconBtn onPress={() => Linking.openURL(whatsappLink(e.phone, `Hi ${e.name}, आपकी enquiry के बारे में`))} style={{ backgroundColor: '#25D36622' }}><MessageCircle size={18} color="#16A34A" /></IconBtn>
                      {e.status !== 'CLOSED' && <Txt v="small" color="brand" onPress={() => upd.mutate({ id: e.id, status: e.status === 'NEW' ? 'RESPONDED' : 'CLOSED' })}>{e.status === 'NEW' ? 'Responded mark करें' : 'Close करें'}</Txt>}
                    </Row>
                  </>
                )}
              </Card>
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );
}
