import { useState } from 'react';
import { Dimensions, FlatList, Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, Building2, ChevronLeft, FileDown, MapPin } from 'lucide-react-native';
import { POSSESSION_LABELS, formatPriceShort } from '@brokeriq/shared';
import { api, img, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { ListingRow } from '@/components/listing';
import { Badge, Button, Card, ErrorView, IconBtn, Input, Loader, Row, SectionTitle, Sheet, Txt } from '@/ui';

const W = Dimensions.get('window').width;

export default function Project() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['project', slug], queryFn: () => api<any>(`/public/projects/${slug}`, { auth: false }) });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <Loader />;
  if (q.isError) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ErrorView error={q.error} onRetry={() => q.refetch()} /></SafeAreaView>;
  const p = q.data;
  const photos: string[] = p.photos ?? [];
  const enquire = async () => {
    setBusy(true);
    try {
      await post('/enquiries', { projectId: p.id, name: f.name, phone: f.phone, message: `${p.name} — price list / brochure चाहिए`, source: 'APP' });
      toast.success('धन्यवाद! जल्द ही call आएगा');
      setOpen(false);
      if (p.brochureUrl) Linking.openURL(p.brochureUrl);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={p.listings ?? []}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        ListHeaderComponent={
          <>
            <View style={{ height: 300, backgroundColor: '#1E1B4B' }}>
              {photos.length ? (
                <FlatList horizontal pagingEnabled data={photos} keyExtractor={(u) => u} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <Image source={{ uri: img(item, 1200) }} style={{ width: W, height: 300 }} contentFit="cover" />} />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Building2 size={56} color="rgba(255,255,255,0.3)" /></View>
              )}
              <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 120 }} pointerEvents="none" />
              <SafeAreaView edges={['top']} style={{ position: 'absolute', left: 12, top: 0 }}>
                <IconBtn onPress={() => router.back()} style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}><ChevronLeft size={22} color="#0F172A" /></IconBtn>
              </SafeAreaView>
            </View>
            <View style={{ padding: 16, gap: 8 }}>
              <Row wrap gap={6}>
                {!!p.reraNumber && <Badge label={`RERA ${p.reraNumber}`} color={c.success} icon={<BadgeCheck size={11} color={c.success} />} />}
                {!!p.possession && <Badge label={POSSESSION_LABELS[p.possession as keyof typeof POSSESSION_LABELS]} color={c.brand} />}
              </Row>
              <Txt v="h1">{p.name}</Txt>
              <Txt color="muted">by {p.builder?.name}</Txt>
              <Row gap={4}><MapPin size={14} color={c.brand} /><Txt color="brand" onPress={() => router.push(`/locality/${p.locality.slug}`)}>{p.locality?.name}</Txt></Row>
              {!!(p.minPrice || p.maxPrice) && <Txt v="h2" style={{ marginTop: 6 }}>{formatPriceShort(p.minPrice)}{p.maxPrice && p.maxPrice !== p.minPrice ? ` – ${formatPriceShort(p.maxPrice)}` : ''}</Txt>}
              {!!(p.configurations as any[])?.length && (
                <>
                  <SectionTitle title="Configurations" />
                  <Card>
                    {(p.configurations as any[]).map((cf, i) => (
                      <Row key={i} style={{ justifyContent: 'space-between', padding: 14, borderTopWidth: i ? 1 : 0, borderColor: c.line }}>
                        <Txt v="bodyStrong">{cf.label}</Txt>
                        <Txt color="muted">{cf.area ? `${cf.area} sqft` : ''}</Txt>
                        <Txt v="bodyStrong" color="brand">{cf.price ? formatPriceShort(cf.price) : 'On request'}</Txt>
                      </Row>
                    ))}
                  </Card>
                </>
              )}
              {!!p.description && <Txt color="muted" style={{ lineHeight: 22, marginTop: 10 }}>{p.description}</Txt>}
              {!!p.listings?.length && <SectionTitle title="Available units (resale / rent)" />}
            </View>
          </>
        }
        renderItem={({ item }) => <View style={{ paddingHorizontal: 16, marginBottom: 10 }}><ListingRow l={item} /></View>}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 12, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.line }}>
        <Button title={p.brochureUrl ? 'Brochure & price list पाएँ' : 'Price list के लिए enquire करें'} icon={<FileDown size={18} color="#fff" />} size="lg" onPress={() => setOpen(true)} />
      </View>
      <Sheet open={open} onClose={() => setOpen(false)} title={p.name}>
        <Input label="नाम" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Input label="Mobile" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
        <Button title="भेजें" loading={busy} disabled={f.name.length < 2 || f.phone.length < 10} onPress={enquire} />
      </Sheet>
    </View>
  );
}
