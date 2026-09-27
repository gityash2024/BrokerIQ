import { useState } from 'react';
import { FlatList, Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, ChevronLeft, MessageCircle, MessagesSquare, Phone, Star } from 'lucide-react-native';
import { timeAgo, whatsappLink } from '@brokeriq/shared';
import { api, img, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFlag } from '@/lib/config';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { ListingRow } from '@/components/listing';
import { Avatar, Badge, Button, Card, Chip, ErrorView, IconBtn, Input, Loader, PressableScale, Row, SectionTitle, Segmented, Sheet, Txt } from '@/ui';

export default function BrokerMicrosite() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const chatOn = useFlag('chat');
  const reviewsOn = useFlag('reviews');
  const q = useQuery({ queryKey: ['broker', slug], queryFn: () => api<any>(`/brokers/${slug}`, { auth: false }) });
  const [tab, setTab] = useState<'SALE' | 'RENT'>('SALE');
  const [review, setReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  if (q.isLoading) return <Loader />;
  if (q.isError) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ErrorView error={q.error} onRetry={() => q.refetch()} /></SafeAreaView>;
  const b = q.data;
  const listings = (b.listings ?? []).filter((l: any) => l.purpose === tab);
  const chat = async () => {
    if (!user) return router.push('/login');
    try {
      const conv = await post<any>('/chat/start', { organizationId: b.id, message: 'नमस्ते, मुझे property चाहिए।' });
      router.push({ pathname: '/chat/[id]', params: { id: conv.id, name: b.name } });
    } catch (e) {
      showError(e);
    }
  };
  const submitReview = async () => {
    try {
      await post(`/brokers/${b.id}/reviews`, { organizationId: b.id, rating, comment: comment || undefined });
      toast.success('Review के लिए धन्यवाद!');
      setReview(false);
      q.refetch();
    } catch (e) {
      showError(e);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={listings}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        ListHeaderComponent={
          <>
            <View style={{ height: 200 }}>
              {b.coverUrl ? <Image source={{ uri: img(b.coverUrl, 1000) }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : <LinearGradient colors={['#312E81', '#4F46E5', '#7C3AED']} style={{ position: 'absolute', inset: 0 } as any} />}
              <SafeAreaView edges={['top']} style={{ padding: 12 }}>
                <IconBtn onPress={() => router.back()} style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}><ChevronLeft size={22} color="#0F172A" /></IconBtn>
              </SafeAreaView>
            </View>
            <View style={{ paddingHorizontal: 16, marginTop: -44, gap: 8 }}>
              <View style={{ borderWidth: 4, borderColor: c.bg, borderRadius: 50, alignSelf: 'flex-start' }}><Avatar name={b.name} uri={b.logoUrl} size={88} /></View>
              <Row gap={6}>
                <Txt v="h1">{b.name}</Txt>
                {b.verification === 'VERIFIED' && <BadgeCheck size={22} color={c.success} />}
              </Row>
              <Row gap={4}>
                <Star size={14} color="#F59E0B" fill="#F59E0B" />
                <Txt color="muted">{b.reviewCount ? `${Number(b.rating).toFixed(1)} · ${b.reviewCount} reviews` : 'New on platform'}{b.experienceYears ? ` · ${b.experienceYears}+ yrs` : ''}</Txt>
              </Row>
              {!!b.reraNumber && <Badge label={`HRERA ${b.reraNumber}`} color={c.success} />}
              {!!b.about && <Txt color="muted" style={{ lineHeight: 21 }}>{b.about}</Txt>}
              {!!b.localities?.length && <Row wrap gap={6}>{b.localities.map((l: any) => <Chip key={l.id ?? l.slug} label={l.name} onPress={() => router.push(`/locality/${l.slug}`)} />)}</Row>}
              {!!b.team?.length && (
                <>
                  <SectionTitle title="Team" />
                  <Row wrap gap={12}>{b.team.map((m: any) => <View key={m.id} style={{ alignItems: 'center', gap: 4, width: 70 }}><Avatar name={m.name} uri={m.avatarUrl} size={48} /><Txt v="caption" numberOfLines={1}>{m.name}</Txt></View>)}</Row>
                </>
              )}
              {reviewsOn && (
                <>
                  <SectionTitle title="Reviews" action={user ? <Txt v="small" color="brand" onPress={() => setReview(true)}>Review लिखें</Txt> : undefined} />
                  {(b.reviews ?? []).slice(0, 5).map((r: any) => (
                    <Card key={r.id} style={{ padding: 12, gap: 4 }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Txt v="bodyStrong">{r.user?.name}</Txt>
                        <Txt v="caption" color="subtle">{timeAgo(r.createdAt)}</Txt>
                      </Row>
                      <Row gap={2}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={12} color="#F59E0B" fill={n <= r.rating ? '#F59E0B' : 'transparent'} />)}</Row>
                      {!!r.comment && <Txt v="small">{r.comment}</Txt>}
                      {!!r.reply && <Txt v="small" color="brand">↳ {r.reply}</Txt>}
                    </Card>
                  ))}
                  {!b.reviews?.length && <Txt v="small" color="muted">अभी कोई review नहीं।</Txt>}
                </>
              )}
              <SectionTitle title="Listings" />
              <Segmented value={tab} onChange={setTab} options={[{ value: 'SALE', label: 'Sale', count: b.stats?.SALE }, { value: 'RENT', label: 'Rent', count: b.stats?.RENT }]} />
              <View style={{ height: 8 }} />
            </View>
          </>
        }
        renderItem={({ item }) => <View style={{ paddingHorizontal: 16, marginBottom: 10 }}><ListingRow l={item} /></View>}
        ListEmptyComponent={<Txt v="small" color="muted" style={{ paddingHorizontal: 16 }}>कोई listing नहीं</Txt>}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 12, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.line, flexDirection: 'row', gap: 8 }}>
        {!!b.phone && <Button icon={<Phone size={18} color={c.fg} />} variant="secondary" style={{ width: 52, paddingHorizontal: 0 }} onPress={() => Linking.openURL(`tel:${b.phone}`)} />}
        {chatOn && <Button icon={<MessagesSquare size={18} color={c.fg} />} variant="secondary" style={{ width: 52, paddingHorizontal: 0 }} onPress={chat} />}
        {!!(b.whatsapp || b.phone) && <Button title="WhatsApp करें" variant="whatsapp" icon={<MessageCircle size={18} color="#fff" />} style={{ flex: 1 }} onPress={() => Linking.openURL(whatsappLink(b.whatsapp ?? b.phone, `नमस्ते ${b.name}, मुझे property चाहिए।`))} />}
      </View>
      <Sheet open={review} onClose={() => setReview(false)} title={`${b.name} को rate करें`}>
        <Row>{[1, 2, 3, 4, 5].map((n) => <PressableScale key={n} onPress={() => setRating(n)}><Star size={36} color="#F59E0B" fill={n <= rating ? '#F59E0B' : 'transparent'} /></PressableScale>)}</Row>
        <Input label="आपका अनुभव" value={comment} onChangeText={setComment} multiline />
        <Button title="Submit" onPress={submitReview} />
      </Sheet>
    </View>
  );
}
