import { useState } from 'react';
import { Dimensions, FlatList, Linking, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, BedDouble, Bath, Building, CalendarDays, ChevronLeft, Compass, Flag, IndianRupee, Layers, MapPin, Maximize2, MessageCircle, MessagesSquare, Orbit, Phone, PlayCircle, Share2, Sofa, Star, TrendingDown, TrendingUp, Wallet } from 'lucide-react-native';
import { FACING_LABELS, FURNISHING_LABELS, POSSESSION_LABELS, PROPERTY_TYPE_LABELS, brokerageText, formatINR, formatPriceShort, moveInCost, whatsappLink, type Furnishing, type PropertyType } from '@brokeriq/shared';
import { api, img, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig, useFlag } from '@/lib/config';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { palette, useTheme } from '@/lib/theme';
import { ListingCard, SaveButton, areaOf } from '@/components/listing';
import { MapView } from '@/components/map';
import { CommuteCard, PanoramaSheet, ReviewsSummary, SafetyNote, SlotSheet, TokenSheet } from '@/components/property-extras';
import { Avatar, Badge, Button, Card, Chip, ErrorView, IconBtn, Input, Loader, PressableScale, Row, SectionTitle, Sheet, Txt } from '@/ui';

const W = Dimensions.get('window').width;
const H = 340;

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value?: React.ReactNode }) {
  const { c } = useTheme();
  if (value == null || value === '') return null;
  return (
    <View style={{ width: '48%', flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
      {icon}
      <View style={{ flex: 1 }}>
        <Txt v="caption" color="subtle">{label}</Txt>
        <Txt v="bodyStrong" numberOfLines={1}>{value}</Txt>
      </View>
    </View>
  );
}

export default function Property() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { app } = useConfig();
  const chatOn = useFlag('chat');
  const q = useQuery({ queryKey: ['listing', slug], queryFn: () => api<any>(`/listings/${slug}`) });
  const tax = useQuery({ queryKey: ['taxonomies'], queryFn: () => api<any>('/public/taxonomies', { auth: false }), staleTime: 600_000 });
  const similar = useQuery({ queryKey: ['similar', q.data?.id], queryFn: () => api<any[]>(`/listings/${q.data.id}/similar`, { auth: false }), enabled: !!q.data?.id });
  const [photo, setPhoto] = useState(0);
  const [enquire, setEnquire] = useState(false);
  const [report, setReport] = useState(false);
  const [slots, setSlots] = useState(false);
  const [token, setToken] = useState(false);
  const [pano, setPano] = useState<string | null>(null);
  const [contact, setContact] = useState<{ name: string; phone: string; whatsapp: string } | null>(null);
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => (y.value = e.contentOffset.y));
  const heroStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(y.value, [-H, 0, H], [-H / 2, 0, H * 0.4]) }, { scale: interpolate(y.value, [-H, 0], [2, 1], 'clamp') }] }));
  const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [H - 140, H - 80], [0, 1], 'clamp') }));

  if (q.isLoading) return <Loader />;
  if (q.isError || !q.data) return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: c.bg }}><ErrorView error={q.error} onRetry={() => q.refetch()} /></View>;
  const l = q.data;
  const photos: string[] = l.media?.some((m: any) => m.kind === 'PHOTO') ? l.media.filter((m: any) => m.kind === 'PHOTO').map((m: any) => m.url) : l.coverUrl ? [l.coverUrl] : [];
  const panoramas: string[] = (l.media ?? []).filter((m: any) => m.kind === 'PANORAMA').map((m: any) => m.url);
  const area = areaOf(l);
  const psf = l.pricePerSqft;
  const avg: number | null = l.localityAvgPsf;
  const diff = psf && avg ? Math.round(((psf - avg) / avg) * 100) : null;
  const amenityLabel = (k: string) => tax.data?.amenities?.find((a: any) => a.key === k)?.label ?? k;
  // Upfront cash to move in: advance rent + deposit + brokerage (rental marketplace).
  const moveIn = l.purpose === 'RENT' ? moveInCost({ rent: l.price, depositMonths: l.securityDeposit ? l.securityDeposit / l.price : 0, brokerage: l.brokerageType ?? 'NONE', brokerageFixed: l.brokerageAmount ?? 0, maintenance: l.maintenance ?? 0 }) : null;

  const reveal = async () => {
    if (!user && app.listing?.contactRevealRequiresLogin !== false) return router.push('/login');
    try {
      const r = await post<any>(`/listings/${l.id}/contact`);
      setContact(r);
      return r;
    } catch (e) {
      showError(e);
    }
  };
  const call = async () => {
    const r = contact ?? (await reveal());
    if (r?.phone) Linking.openURL(`tel:${r.phone}`);
  };
  const wa = async () => {
    const r = contact ?? (await reveal());
    if (r?.whatsapp) Linking.openURL(whatsappLink(r.whatsapp, `नमस्ते, मुझे ${app.siteName} पर यह property पसंद आई: ${l.title} (${formatPriceShort(l.price)}). Ref #${l.refNo}`));
  };
  const chat = async () => {
    if (!user) return router.push('/login');
    try {
      const conv = await post<any>('/chat/start', { organizationId: l.organization.id, listingId: l.id, message: `नमस्ते, "${l.title}" के बारे में जानकारी चाहिए।` });
      router.push({ pathname: '/chat/[id]', params: { id: conv.id, name: l.organization.name } });
    } catch (e) {
      showError(e);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}>
        <View style={{ height: H, overflow: 'hidden', backgroundColor: c.surface2 }}>
          <Animated.View style={[{ height: H }, heroStyle]}>
            <FlatList
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(u, i) => `${u}${i}`}
              onMomentumScrollEnd={(e) => setPhoto(Math.round(e.nativeEvent.contentOffset.x / W))}
              renderItem={({ item }) => <Image source={{ uri: img(item, 1200) }} style={{ width: W, height: H }} contentFit="cover" transition={250} />}
            />
          </Animated.View>
          <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.5)']} style={{ position: 'absolute', inset: 0 } as any} pointerEvents="none" />
          {photos.length > 1 && (
            <View style={{ position: 'absolute', bottom: 40, right: 14, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Txt v="caption" color="white">{photo + 1} / {photos.length}</Txt>
            </View>
          )}
        </View>

        <View style={{ padding: 16, marginTop: -26, backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 6 }}>
          <Row wrap gap={6}>
            {l.isVerified && <Badge label="Verified" color={c.success} icon={<BadgeCheck size={11} color={c.success} />} />}
            {l.isFeatured && <Badge label="Featured" color={palette.saffron[600]} />}
            {!!l.visitVerifiedAt && <Badge label="Visit verified" color={c.success} icon={<BadgeCheck size={11} color={c.success} />} />}
            {!!l.tokenReceivedAt && <Badge label="Token मिल चुका" color={c.warning} />}
            <Badge label={l.purpose === 'RENT' ? 'For rent' : 'For sale'} color={c.brand} />
            {['SOLD', 'RENTED'].includes(l.status) && <Badge label={l.status} color={c.danger} solid />}
          </Row>
          <Animated.View entering={FadeInDown.duration(400)}>
            <Txt v="display" style={{ marginTop: 6 }}>
              {formatPriceShort(l.price)}
              {l.purpose === 'RENT' && <Txt v="h3" color="muted">/month</Txt>}
            </Txt>
          </Animated.View>
          {!!psf && (
            <Row gap={6}>
              {l.purpose === 'SALE' && <Txt v="small" color="muted">₹{Math.round(psf).toLocaleString('en-IN')}/sqft</Txt>}
              {diff != null && diff !== 0 && (
                <Badge label={`Locality avg से ${Math.abs(diff)}% ${diff < 0 ? 'कम' : 'ज़्यादा'}`} color={diff < 0 ? c.success : c.warning} icon={diff < 0 ? <TrendingDown size={11} color={c.success} /> : <TrendingUp size={11} color={c.warning} />} />
              )}
            </Row>
          )}
          <Txt v="h2" style={{ marginTop: 8 }}>{l.title}</Txt>
          <PressableScale onPress={() => router.push(`/locality/${l.locality.slug}`)}>
            <Row gap={4}>
              <MapPin size={15} color={c.brand} />
              <Txt color="brand">{[l.societyName, l.locality.name].filter(Boolean).join(', ')}</Txt>
            </Row>
          </PressableScale>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', marginTop: 16 }}>
            <Fact icon={<BedDouble size={20} color={c.brand} />} label="Bedrooms" value={l.bedrooms != null ? `${l.bedrooms} BHK` : null} />
            <Fact icon={<Bath size={20} color={c.brand} />} label="Bathrooms" value={l.bathrooms} />
            <Fact icon={<Maximize2 size={20} color={c.brand} />} label="Area" value={area ? `${Math.round(area).toLocaleString('en-IN')} sqft` : null} />
            <Fact icon={<Building size={20} color={c.brand} />} label="Type" value={PROPERTY_TYPE_LABELS[l.propertyType as PropertyType]} />
            <Fact icon={<Layers size={20} color={c.brand} />} label="Floor" value={l.floor != null ? `${l.floor}${l.totalFloors ? ` of ${l.totalFloors}` : ''}` : null} />
            <Fact icon={<Sofa size={20} color={c.brand} />} label="Furnishing" value={l.furnishing ? FURNISHING_LABELS[l.furnishing as Furnishing] : null} />
            <Fact icon={<CalendarDays size={20} color={c.brand} />} label="Possession" value={l.possession ? POSSESSION_LABELS[l.possession as keyof typeof POSSESSION_LABELS] : null} />
            <Fact icon={<Compass size={20} color={c.brand} />} label="Facing" value={l.facing ? FACING_LABELS[l.facing as keyof typeof FACING_LABELS] : null} />
            {l.purpose === 'RENT' && <Fact icon={<IndianRupee size={20} color={c.brand} />} label="Deposit" value={l.securityDeposit ? formatINR(l.securityDeposit) : null} />}
            <Fact icon={<IndianRupee size={20} color={c.brand} />} label="Brokerage" value={brokerageText(l.brokerageType, l.brokerageAmount, l.price)} />
            <Fact icon={<IndianRupee size={20} color={c.brand} />} label="Maintenance" value={l.maintenance ? `${formatINR(l.maintenance)}/mo` : null} />
          </View>

          {(l.propertyType === 'PG' || l.preferredTenants?.length > 0) && (
            <Row wrap style={{ marginTop: 12 }}>
              {!!l.pgGender && <Badge label={({ FEMALE: 'Girls PG', MALE: 'Boys PG', ANY: 'Co-ed' } as Record<string, string>)[l.pgGender]} color={c.brand} />}
              {!!l.pgFood && <Badge label={({ VEG: 'Veg food', NONVEG: 'Non-veg food', BOTH: 'Veg + non-veg', NONE: 'Food नहीं' } as Record<string, string>)[l.pgFood]} color={c.success} />}
              {(l.pgSharing ?? []).map((x: string) => <Badge key={x} label={`${x.toLowerCase()} sharing`} color={c.muted} />)}
              {(l.preferredTenants ?? []).map((x: string) => <Badge key={x} label={x} color={c.muted} />)}
              {(l.pgRules ?? []).map((x: string) => <Badge key={x} label={x} color={c.warning} />)}
            </Row>
          )}

          {!!l.description && (
            <>
              <SectionTitle title="About this property" />
              <Txt color="muted" style={{ lineHeight: 22 }}>{l.description}</Txt>
            </>
          )}

          {!!l.amenities?.length && (
            <>
              <SectionTitle title="Amenities" />
              <Row wrap gap={8}>{l.amenities.map((a: string) => <Chip key={a} label={amenityLabel(a)} />)}</Row>
            </>
          )}

          {l.latitude != null && (
            <>
              <SectionTitle title="Location" subtitle={l.address ?? l.locality.name} />
              <MapView points={[{ id: l.id, lat: l.latitude, lng: l.longitude }]} zoom={15} height={200} />
              <Button title="Google Maps में directions" variant="secondary" size="sm" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${l.latitude},${l.longitude}`)} />
            </>
          )}

          {(!!l.videoUrl || panoramas.length > 0) && (
            <Row style={{ marginTop: 16 }}>
              {!!l.videoUrl && <Button title="Video tour" variant="secondary" size="sm" icon={<PlayCircle size={16} color={c.fg} />} onPress={() => Linking.openURL(l.videoUrl)} />}
              {panoramas.length > 0 && <Button title="360° view" variant="secondary" size="sm" icon={<Orbit size={16} color={c.fg} />} onPress={() => setPano(panoramas[0])} />}
            </Row>
          )}

          <CommuteCard l={l} />
          <ReviewsSummary localitySlug={l.locality.slug} society={l.societyName} />

          {moveIn && (
            <Card style={{ marginTop: 20, padding: 16, gap: 4 }} onPress={() => router.push({ pathname: '/tools', params: { tab: 'movein' } })}>
              <Txt v="caption" color="muted">Move-in cost (advance rent + deposit + brokerage)</Txt>
              <Txt v="h2" color="brand">≈ {formatINR(moveIn.total)}</Txt>
              <Txt v="caption" color="brand">Calculator खोलें →</Txt>
            </Card>
          )}

          <SafetyNote />
          <SectionTitle title={l.organization ? 'Listed by broker' : 'Listed by owner'} />
          <Card style={{ padding: 16 }} onPress={l.organization ? () => router.push(`/broker/${l.organization.slug}`) : undefined}>
            <Row gap={12}>
              <Avatar name={l.organization?.name ?? l.postedBy?.name} uri={l.organization?.logoUrl ?? l.postedBy?.avatarUrl} size={52} />
              <View style={{ flex: 1 }}>
                <Row gap={4}>
                  <Txt v="bodyStrong">{l.organization?.name ?? l.contactName ?? l.postedBy?.name}</Txt>
                  {l.organization?.verification === 'VERIFIED' && <BadgeCheck size={16} color={c.success} />}
                </Row>
                {l.organization ? (
                  <Row gap={4}>
                    <Star size={12} color="#F59E0B" fill="#F59E0B" />
                    <Txt v="caption" color="muted">{l.organization.reviewCount ? `${Number(l.organization.rating).toFixed(1)} (${l.organization.reviewCount})` : 'New'}{l.organization.reraNumber ? ` · RERA ${l.organization.reraNumber}` : ''}</Txt>
                  </Row>
                ) : (
                  <Txt v="caption" color="muted">Owner · no brokerage</Txt>
                )}
                <Txt v="small" color="brand" style={{ marginTop: 2 }}>{contact?.phone ?? l.contactPhone ?? l.organization?.phone}</Txt>
              </View>
            </Row>
          </Card>

          {!!l.organization && !!user && !l.canManage && (
            <PressableScale onPress={() => setToken(true)} style={{ alignSelf: 'center', marginTop: 10 }}>
              <Row gap={6}><Wallet size={14} color={c.muted} /><Txt v="small" color="muted">Broker को token दिया है? Record रखें</Txt></Row>
            </PressableScale>
          )}

          {!!similar.data?.length && (
            <>
              <SectionTitle title="Similar properties" />
              <FlatList horizontal data={similar.data} keyExtractor={(x) => x.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} renderItem={({ item }) => <ListingCard l={item} width={270} />} />
            </>
          )}
          <PressableScale onPress={() => (user ? setReport(true) : router.push('/login'))} style={{ alignSelf: 'center', marginTop: 24 }}>
            <Row gap={6}>
              <Flag size={14} color={c.subtle} />
              <Txt v="small" color="subtle">Listing में गड़बड़ी? Report करें · Ref #{l.refNo}</Txt>
            </Row>
          </PressableScale>
        </View>
      </Animated.ScrollView>

      {/* floating top bar */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top }}>
        <Animated.View style={[{ position: 'absolute', inset: 0, backgroundColor: c.bg, borderBottomWidth: 1, borderColor: c.line } as any, barStyle]} />
        <Row style={{ paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'space-between' }}>
          <IconBtn onPress={() => (router.canGoBack() ? router.back() : router.replace('/(user)/home'))} style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}>
            <ChevronLeft size={22} color="#0F172A" />
          </IconBtn>
          <Animated.View style={[{ flex: 1, paddingHorizontal: 8 }, barStyle]}>
            <Txt v="bodyStrong" numberOfLines={1}>{formatPriceShort(l.price)} · {l.locality.name}</Txt>
          </Animated.View>
          <Row gap={8}>
            <IconBtn onPress={() => Share.share({ message: `${l.title} — ${formatPriceShort(l.price)}\n${app.siteUrl || ''}/property/${l.slug}` })} style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}>
              <Share2 size={19} color="#0F172A" />
            </IconBtn>
            <SaveButton id={l.id} light />
          </Row>
        </Row>
      </View>

      {/* sticky CTA */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.line, flexDirection: 'row', gap: 8 }}>
        <Button icon={<Phone size={18} color={c.fg} />} variant="secondary" onPress={call} style={{ width: 52, paddingHorizontal: 0 }} />
        <Button icon={<MessageCircle size={18} color="#fff" />} variant="whatsapp" onPress={wa} style={{ width: 52, paddingHorizontal: 0 }} />
        {chatOn && l.organization && <Button icon={<MessagesSquare size={18} color={c.fg} />} variant="secondary" onPress={chat} style={{ width: 52, paddingHorizontal: 0 }} />}
        {l.organization && <Button title="Visit" variant="secondary" style={{ paddingHorizontal: 14 }} onPress={() => (user ? setSlots(true) : router.push('/login'))} />}
        <Button title={l.organization ? 'Enquire' : 'Enquire / Visit'} style={{ flex: 1 }} onPress={() => setEnquire(true)} />
      </View>

      <EnquirySheet open={enquire} onClose={() => setEnquire(false)} listing={l} />
      <ReportSheet open={report} onClose={() => setReport(false)} listingId={l.id} />
      {!!l.organization && <SlotSheet listingId={l.id} open={slots} onClose={() => setSlots(false)} />}
      {!!l.organization && <TokenSheet listingId={l.id} open={token} onClose={() => setToken(false)} />}
      <PanoramaSheet url={pano} open={!!pano} onClose={() => setPano(null)} />
    </View>
  );
}

function EnquirySheet({ open, onClose, listing }: { open: boolean; onClose: () => void; listing: any }) {
  const { user } = useAuth();
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', email: user?.email ?? '', message: `Hi, I'm interested in ${listing.title}.`, wantsVisit: false });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await post('/enquiries', { listingId: listing.id, name: f.name, phone: f.phone, email: f.email || '', message: f.message, wantsVisit: f.wantsVisit, source: 'APP' });
      toast.success('Enquiry भेज दी गई — जल्द ही call/WhatsApp आएगा ✅');
      onClose();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Enquiry भेजें">
      <Input label="नाम" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
      <Input label="Mobile" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
      <Input label="Email (optional)" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Message" value={f.message} onChangeText={(v) => setF({ ...f, message: v })} multiline />
      <Row>
        <Chip label="🗓 Site visit चाहिए" active={f.wantsVisit} onPress={() => setF({ ...f, wantsVisit: !f.wantsVisit })} />
      </Row>
      <Button title="भेजें" size="lg" loading={busy} disabled={f.name.length < 2 || f.phone.length < 10} onPress={submit} />
    </Sheet>
  );
}

const REASONS = [
  ['FAKE', 'Fake / गलत listing'],
  ['ALREADY_SOLD', 'Already sold / rented'],
  ['WRONG_PRICE', 'गलत price'],
  ['BROKER_AS_OWNER', 'Broker, owner बनकर'],
  ['SPAM', 'Spam'],
  ['OTHER', 'Other'],
];
function ReportSheet({ open, onClose, listingId }: { open: boolean; onClose: () => void; listingId: string }) {
  const [reason, setReason] = useState('FAKE');
  const [details, setDetails] = useState('');
  const send = async () => {
    try {
      await post(`/listings/${listingId}/report`, { listingId, reason, details: details || undefined });
      toast.success('Report मिल गई — हमारी team जाँच करेगी');
      onClose();
    } catch (e) {
      showError(e);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Listing report करें">
      <Row wrap>{REASONS.map(([k, l]) => <Chip key={k} label={l} active={reason === k} onPress={() => setReason(k)} />)}</Row>
      <Input label="Details (optional)" value={details} onChangeText={setDetails} multiline />
      <Button title="Report भेजें" variant="danger" onPress={send} />
    </Sheet>
  );
}
