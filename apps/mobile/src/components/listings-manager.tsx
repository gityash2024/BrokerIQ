import { useState } from 'react';
import { FlatList, Linking, Share, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Building2, Eye, MessageSquare, Pencil, Rocket } from 'lucide-react-native';
import { LISTING_STATUS_LABELS, formatPriceShort, type ListingStatus, plural } from '@brokeriq/shared';
import { api, patch, post } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { Badge, Button, Card, Chip, Empty, ErrorView, IconBtn, Row, Screen, Skeleton, Txt } from '@/ui';
import { Image } from 'expo-image';
import { img } from '@/lib/api';
import { alert } from '../lib/i18n';
import { useFreeMode } from '@/lib/config';

const TONE: Record<string, string> = { ACTIVE: '#10B981', PENDING_REVIEW: '#F59E0B', REJECTED: '#E11D48', DRAFT: '#64748B', SOLD: '#0EA5E9', RENTED: '#0EA5E9', EXPIRED: '#94A3B8', ARCHIVED: '#94A3B8', BLOCKED: '#E11D48' };

export function ListingsManager({ header }: { header: React.ReactNode }) {
  const freeMode = useFreeMode();
  const { c } = useTheme();
  const [status, setStatus] = useState('');
  const q = useQuery({ queryKey: ['my-listings', status], queryFn: () => api<any>(`/listings/mine?pageSize=50${status ? `&status=${status}` : ''}`) });
  const setSt = useApiMutation((b: { id: string; status: string }) => patch(`/listings/${b.id}/status`, { status: b.status }), { success: 'Updated', invalidate: [['my-listings']] });
  const counts = q.data?.statusCounts ?? {};
  const { user } = useAuth();
  const isBroker = user?.role === 'BROKER_ADMIN' || user?.role === 'BROKER_AGENT';
  /** Tracked link + caption; the post/story image opens in the browser for saving. */
  const shareKit = async (id: string) => {
    try {
      const k = await post<any>(`/broker/share-kit/${id}`, {});
      alert('Share kit', 'Caption share करें या post image खोलकर save करें।', [
        { text: 'Caption share', onPress: () => Share.share({ message: k.caption }) },
        { text: 'Post image', onPress: () => Linking.openURL(`${k.images.post}&download=1`) },
        { text: 'Story image', onPress: () => Linking.openURL(`${k.images.story}&download=1`) },
      ]);
    } catch (e) {
      showError(e);
    }
  };
  /** Copy-ready text for posting the same listing on Housing / 99acres / MagicBricks. */
  const portalPack = async (id: string) => {
    try {
      const d = await api<any>(`/broker/portal-pack/${id}`);
      await Share.share({ message: `${d.text}${d.photos.length ? `\n\nPhotos:\n${d.photos.join('\n')}` : ''}` });
    } catch (e) {
      showError(e);
    }
  };
  const actions = (l: any) =>
    alert(l.title, undefined, [
      { text: 'Edit', onPress: () => router.push({ pathname: '/post-property', params: { id: l.id } }) },
      ...(isBroker && l.status === 'ACTIVE' ? [{ text: 'Share kit (WhatsApp / Insta)', onPress: () => shareKit(l.id) }] : []),
      ...(isBroker ? [{ text: 'Portal pack (Housing / 99acres)', onPress: () => portalPack(l.id) }] : []),
      ...(l.status === 'ACTIVE' ? [{ text: l.purpose === 'RENT' ? 'Rented mark करें' : 'Sold mark करें', onPress: () => setSt.mutate({ id: l.id, status: l.purpose === 'RENT' ? 'RENTED' : 'SOLD' }) }] : []),
      ...(l.status !== 'ARCHIVED' ? [{ text: 'Archive (hide)', style: 'destructive' as const, onPress: () => setSt.mutate({ id: l.id, status: 'ARCHIVED' }) }] : [{ text: 'फिर से active करें', onPress: () => setSt.mutate({ id: l.id, status: 'ACTIVE' }) }]),
      { text: 'Cancel', style: 'cancel' },
    ]);
  return (
    <Screen scroll={false} padded={false}>
      {header}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={['', 'ACTIVE', 'PENDING_REVIEW', 'DRAFT', 'REJECTED', 'SOLD', 'RENTED', 'EXPIRED']}
        keyExtractor={(x) => x || 'all'}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
        style={{ flexGrow: 0 }}
        renderItem={({ item }) => <Chip label={`${item ? LISTING_STATUS_LABELS[item as ListingStatus] : 'All'}${item && counts[item] ? ` ${counts[item]}` : ''}`} active={status === item} onPress={() => setStatus(item)} />}
      />
      {q.isError ? <ErrorView error={q.error} /> : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(x) => x.id}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={q.isLoading ? <Skeleton h={120} /> : <Empty icon={<Building2 size={28} color={c.brand} />} title="कोई listing नहीं" text="2 मिनट में free property post करें।" action={<Button title="Property post करें" onPress={() => router.push('/post-property')} />} />}
          renderItem={({ item: l, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40)}>
              <Card style={{ padding: 12, gap: 10 }} onPress={() => router.push(`/property/${l.slug}`)}>
                <Row gap={12}>
                  <View style={{ width: 84, height: 84, borderRadius: 14, overflow: 'hidden', backgroundColor: c.surface2 }}>{l.coverUrl && <Image source={{ uri: img(l.coverUrl, 300) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}</View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Badge label={LISTING_STATUS_LABELS[l.status as ListingStatus] ?? l.status} color={TONE[l.status]} />
                    <Txt v="bodyStrong" numberOfLines={2}>{l.title}</Txt>
                    <Txt v="small" color="brand">{formatPriceShort(l.price)}</Txt>
                  </View>
                  <IconBtn onPress={() => actions(l)}><Pencil size={18} color={c.muted} /></IconBtn>
                </Row>
                {l.status === 'REJECTED' && !!l.rejectionReason && <Txt v="small" color="danger">Reason: {l.rejectionReason}</Txt>}
                {l.status === 'BLOCKED' && <Txt v="small" color="danger">BrokerIQ ने यह listing हटाई है{l.blockedReason ? ` — ${String(l.blockedReason).replace(/^(ACCOUNT|FIRM): /, '')}` : ''}। Support से संपर्क करें।</Txt>}
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={14}>
                    <Row gap={4}><Eye size={14} color={c.muted} /><Txt v="caption" color="muted">{plural(l.views, 'view')}</Txt></Row>
                    <Row gap={4}><MessageSquare size={14} color={c.muted} /><Txt v="caption" color="muted">{plural(l.enquiryCount, 'enquiry', 'enquiries')}</Txt></Row>
                  </Row>
                  {l.status === 'ACTIVE' && !freeMode && !l.isFeatured && (
                    <Button title="Boost" size="sm" variant="accent" icon={<Rocket size={14} color="#111" />} onPress={() => router.push({ pathname: '/boost', params: { id: l.id, title: l.title } })} />
                  )}
                  {l.isFeatured && <Badge label="Featured" color="#D97706" />}
                </Row>
              </Card>
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );
}
