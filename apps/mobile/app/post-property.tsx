import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInRight, FadeOutLeft, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Check, ImagePlus, LocateFixed, Sparkles, Star, X } from 'lucide-react-native';
import { FURNISHING_LABELS, POSSESSION_LABELS, formatPriceShort } from '@brokeriq/shared';
import { api, img, post, patch, uploadUri } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Button, Chip, Header, Input, PressableScale, Row, Txt } from '@/ui';

type Photo = { url?: string; uri?: string; uploading?: boolean };
const STEPS = ['Basics', 'Location', 'Details', 'Photos'];
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[^\d.]/g, '')));

export default function PostProperty() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { c } = useTheme();
  const { user, isBroker } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [locQ, setLocQ] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [f, setF] = useState<any>({ purpose: 'SALE', category: 'RESIDENTIAL', propertyType: 'APARTMENT', localityId: '', amenities: [], priceNegotiable: false, contactName: user?.name ?? '', contactPhone: user?.phone ?? '' });
  const set = (p: any) => setF((x: any) => ({ ...x, ...p }));
  const tax = useQuery({ queryKey: ['taxonomies'], queryFn: () => api<any>('/public/taxonomies', { auth: false }), staleTime: 600_000 });
  const locs = useQuery({ queryKey: ['localities-all'], queryFn: () => api<any[]>('/public/localities', { auth: false }), staleTime: 600_000 });
  const existing = useQuery({ queryKey: ['listing-edit', id], queryFn: () => api<any>(`/listings/${id}?track=0`), enabled: !!id });
  useEffect(() => {
    const l = existing.data;
    if (!l) return;
    const keys = ['purpose', 'propertyType', 'localityId', 'societyName', 'address', 'latitude', 'longitude', 'price', 'maintenance', 'securityDeposit', 'priceNegotiable', 'bedrooms', 'bathrooms', 'balconies', 'carpetArea', 'superArea', 'plotArea', 'floor', 'totalFloors', 'furnishing', 'possession', 'facing', 'parking', 'amenities', 'reraNumber', 'title', 'description', 'contactName', 'contactPhone'];
    setF({ ...Object.fromEntries(keys.map((k) => [k, l[k] ?? (k === 'amenities' ? [] : '')])), category: l.category, localityId: l.localityId ?? l.locality?.id });
    setPhotos((l.media ?? []).map((m: any) => ({ url: m.url })));
  }, [existing.data]);

  const types = useMemo(() => (tax.data?.propertyTypes ?? []).filter((t: any) => t.category === f.category), [tax.data, f.category]);
  const loc = locs.data?.find((l) => l.id === f.localityId);
  const residential = f.category === 'RESIDENTIAL';
  const plot = f.category === 'PLOT';
  const amenities = (tax.data?.amenities ?? []).filter((a: any) => (f.category === 'COMMERCIAL' ? a.category !== 'flat' : a.category !== 'commercial'));

  const errorFor = (s: number): string | null => {
    if (s === 0 && !f.price) return 'Price डालें';
    if (s === 1 && !f.localityId) return 'Locality / sector चुनें';
    if (s === 2 && !(f.superArea || f.carpetArea || f.plotArea)) return 'Area डालें';
    return null;
  };
  const next = () => {
    const e = errorFor(step);
    if (e) return toast.error(e);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.error('Permission दें');
    const res = camera ? await ImagePicker.launchCameraAsync({ quality: 0.9 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 20, quality: 0.9 });
    if (res.canceled) return;
    for (const a of res.assets) {
      const tmp: Photo = { uri: a.uri, uploading: true };
      setPhotos((p) => [...p, tmp]);
      try {
        const small = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: Math.min(1920, a.width || 1920) } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
        const { url } = await uploadUri(small.uri, 'listing');
        setPhotos((p) => p.map((x) => (x === tmp ? { url } : x)));
      } catch (e) {
        setPhotos((p) => p.filter((x) => x !== tmp));
        showError(e);
        break;
      }
    }
  };

  const locate = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return toast.error('Location permission दें');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    set({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    toast.success('Exact location जुड़ गई 📍');
  };

  const ai = async () => {
    setAiBusy(true);
    try {
      const r = await post<{ description: string }>('/listings/ai/description', { ...payload(false), tone: 'professional', language: 'en' });
      set({ description: r.description });
    } catch (e) {
      showError(e);
    } finally {
      setAiBusy(false);
    }
  };

  const payload = (submit: boolean) => {
    const n = (k: string) => (f[k] === '' || f[k] == null ? null : Number(f[k]));
    return {
      purpose: f.purpose,
      propertyType: f.propertyType,
      title: f.title?.length >= 8 ? f.title : undefined,
      description: f.description || null,
      localityId: f.localityId,
      societyName: f.societyName || null,
      address: f.address || null,
      latitude: f.latitude ?? loc?.latitude ?? null,
      longitude: f.longitude ?? loc?.longitude ?? null,
      price: Number(f.price),
      maintenance: n('maintenance'),
      securityDeposit: n('securityDeposit'),
      priceNegotiable: !!f.priceNegotiable,
      bedrooms: n('bedrooms'),
      bathrooms: n('bathrooms'),
      balconies: n('balconies'),
      carpetArea: n('carpetArea'),
      superArea: n('superArea'),
      plotArea: n('plotArea'),
      floor: n('floor'),
      totalFloors: n('totalFloors'),
      furnishing: f.furnishing || null,
      possession: f.possession || null,
      facing: f.facing || null,
      parking: n('parking'),
      amenities: f.amenities ?? [],
      reraNumber: f.reraNumber || null,
      photos: photos.filter((p) => p.url).map((p) => ({ url: p.url! })),
      contactName: f.contactName || null,
      contactPhone: f.contactPhone || null,
      submit,
    };
  };

  const save = async (submit: boolean) => {
    if (photos.some((p) => p.uploading)) return toast.info('Photos upload हो रहे हैं…');
    for (let s = 0; s < 3; s++) {
      const e = errorFor(s);
      if (e) return (setStep(s), toast.error(e));
    }
    setBusy(true);
    try {
      const l = id ? await patch<any>(`/listings/${id}`, payload(submit)) : await post<any>('/listings', payload(submit));
      qc.invalidateQueries({ queryKey: ['my-listings'] });
      toast.success(l.status === 'ACTIVE' ? 'Listing live है 🎉' : l.status === 'DRAFT' ? 'Draft saved' : 'Review के लिए भेज दी गई ✅');
      router.replace('/my-listings');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const progress = useAnimatedStyle(() => ({ width: withTiming(`${((step + 1) / STEPS.length) * 100}%`) }));
  const numInput = (k: string, label: string, hint?: string) => <Input label={label} hint={hint} value={f[k] == null ? '' : String(f[k])} onChangeText={(v) => set({ [k]: num(v) })} keyboardType="numeric" containerStyle={{ flex: 1 }} />;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={id ? 'Listing edit करें' : 'Property post करें'} subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} />
      <View style={{ height: 4, backgroundColor: c.surface2, marginHorizontal: 16, borderRadius: 2 }}>
        <Animated.View style={[{ height: 4, backgroundColor: c.brand, borderRadius: 2 }, progress]} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Animated.View key={step} entering={FadeInRight.duration(250)} exiting={FadeOutLeft.duration(150)} style={{ gap: 16 }}>
          {step === 0 && (
            <>
              <Txt v="label" color="subtle">मैं चाहता हूँ</Txt>
              <Row>
                <Chip label="बेचना (Sell)" active={f.purpose === 'SALE'} onPress={() => set({ purpose: 'SALE' })} />
                <Chip label="किराये पर देना (Rent)" active={f.purpose === 'RENT'} onPress={() => set({ purpose: 'RENT' })} />
              </Row>
              <Txt v="label" color="subtle">Category</Txt>
              <Row wrap>
                {(['RESIDENTIAL', 'COMMERCIAL', 'PLOT'] as const).map((cat) => (
                  <Chip key={cat} label={cat[0] + cat.slice(1).toLowerCase()} active={f.category === cat} onPress={() => set({ category: cat, propertyType: (tax.data?.propertyTypes ?? []).find((t: any) => t.category === cat)?.value })} />
                ))}
              </Row>
              <Txt v="label" color="subtle">Property type</Txt>
              <Row wrap>{types.map((t: any) => <Chip key={t.value} label={t.label} active={f.propertyType === t.value} onPress={() => set({ propertyType: t.value })} />)}</Row>
              <Input label={f.purpose === 'RENT' ? 'Monthly rent (₹)' : 'Expected price (₹)'} value={f.price ? String(f.price) : ''} onChangeText={(v) => set({ price: num(v) })} keyboardType="numeric" hint={f.price ? formatPriceShort(Number(f.price)) : undefined} />
              <Row>
                {f.purpose === 'RENT' && numInput('securityDeposit', 'Deposit (₹)')}
                {numInput('maintenance', 'Maintenance / month')}
              </Row>
              <Chip label="Price negotiable" active={f.priceNegotiable} onPress={() => set({ priceNegotiable: !f.priceNegotiable })} />
            </>
          )}
          {step === 1 && (
            <>
              <Input label="Locality / sector खोजें" value={locQ} onChangeText={setLocQ} placeholder="Sector 65, Golf Course Road…" />
              {!!loc && <Chip label={`📍 ${loc.name}`} active onPress={() => set({ localityId: '' })} icon={<X size={14} color={c.brand} />} />}
              <Row wrap>
                {(locs.data ?? [])
                  .filter((l) => !locQ || l.name.toLowerCase().includes(locQ.toLowerCase()) || (l.zone ?? '').toLowerCase().includes(locQ.toLowerCase()))
                  .slice(0, locQ ? 30 : 12)
                  .map((l) => <Chip key={l.id} label={l.name} active={f.localityId === l.id} onPress={() => (set({ localityId: l.id }), setLocQ(''))} />)}
              </Row>
              <Input label="Society / project name" value={f.societyName ?? ''} onChangeText={(v) => set({ societyName: v })} />
              <Input label="Address (optional)" value={f.address ?? ''} onChangeText={(v) => set({ address: v })} />
              <Button title={f.latitude ? 'Exact location जुड़ गई ✓' : 'Current location जोड़ें (property पर हों तो)'} variant="secondary" icon={<LocateFixed size={18} color={c.brand} />} onPress={locate} />
            </>
          )}
          {step === 2 && (
            <>
              {residential && (
                <>
                  <Txt v="label" color="subtle">BHK</Txt>
                  <Row wrap>{[1, 2, 3, 4, 5, 6].map((b) => <Chip key={b} label={`${b}${b === 6 ? '+' : ''} BHK`} active={f.bedrooms === b} onPress={() => set({ bedrooms: b })} />)}</Row>
                  <Row>
                    {numInput('bathrooms', 'Bathrooms')}
                    {numInput('balconies', 'Balconies')}
                    {numInput('parking', 'Parking')}
                  </Row>
                </>
              )}
              {plot ? numInput('plotArea', 'Plot area (sqft)') : (
                <Row>
                  {numInput('superArea', 'Super area (sqft)')}
                  {numInput('carpetArea', 'Carpet area (sqft)')}
                </Row>
              )}
              {!plot && (
                <Row>
                  {numInput('floor', 'Floor')}
                  {numInput('totalFloors', 'Total floors')}
                </Row>
              )}
              {!plot && (
                <>
                  <Txt v="label" color="subtle">Furnishing</Txt>
                  <Row wrap>{Object.entries(FURNISHING_LABELS).map(([k, v]) => <Chip key={k} label={v} active={f.furnishing === k} onPress={() => set({ furnishing: k })} />)}</Row>
                </>
              )}
              {f.purpose === 'SALE' && (
                <>
                  <Txt v="label" color="subtle">Possession</Txt>
                  <Row wrap>{Object.entries(POSSESSION_LABELS).map(([k, v]) => <Chip key={k} label={v} active={f.possession === k} onPress={() => set({ possession: k })} />)}</Row>
                </>
              )}
              <Txt v="label" color="subtle">Amenities</Txt>
              <Row wrap>
                {amenities.map((a: any) => {
                  const on = f.amenities.includes(a.key);
                  return <Chip key={a.key} label={a.label} active={on} onPress={() => set({ amenities: on ? f.amenities.filter((x: string) => x !== a.key) : [...f.amenities, a.key] })} />;
                })}
              </Row>
              {isBroker && <Input label="RERA number (project)" value={f.reraNumber ?? ''} onChangeText={(v) => set({ reraNumber: v })} />}
            </>
          )}
          {step === 3 && (
            <>
              <Row>
                <Button title="Camera" icon={<Camera size={18} color="#fff" />} style={{ flex: 1 }} onPress={() => pick(true)} />
                <Button title="Gallery" variant="secondary" icon={<ImagePlus size={18} color={c.fg} />} style={{ flex: 1 }} onPress={() => pick(false)} />
              </Row>
              <Txt v="small" color="muted">अच्छी रोशनी वाली 5+ photos ज़्यादा enquiries लाती हैं। पहली photo cover बनेगी (★ दबाकर बदलें)।</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {photos.map((p, i) => (
                  <View key={`${p.url ?? p.uri ?? ''}${i}`} style={{ width: '31%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: c.surface2 }}>
                    <Image source={{ uri: p.url ? img(p.url, 300) : p.uri }} style={{ width: '100%', height: '100%', opacity: p.uploading ? 0.5 : 1 }} contentFit="cover" />
                    {p.uploading && <ActivityIndicator style={{ position: 'absolute', top: '40%', alignSelf: 'center' }} color={c.brand} />}
                    {!p.uploading && (
                      <>
                        <PressableScale onPress={() => setPhotos((ps) => [ps[i], ...ps.filter((_, k) => k !== i)])} style={{ position: 'absolute', top: 6, left: 6, backgroundColor: i === 0 ? '#F59E0B' : 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 4 }}>
                          <Star size={14} color="#fff" fill={i === 0 ? '#fff' : 'transparent'} />
                        </PressableScale>
                        <PressableScale onPress={() => setPhotos((ps) => ps.filter((_, k) => k !== i))} style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(225,29,72,0.9)', borderRadius: 10, padding: 4 }}>
                          <X size={14} color="#fff" />
                        </PressableScale>
                      </>
                    )}
                  </View>
                ))}
              </View>
              <Input label="Title (optional — खाली छोड़ें तो अपने-आप बनेगा)" value={f.title ?? ''} onChangeText={(v) => set({ title: v })} />
              <Input label="Description" value={f.description ?? ''} onChangeText={(v) => set({ description: v })} multiline />
              <Button title="AI से description लिखवाएँ" variant="secondary" loading={aiBusy} icon={<Sparkles size={18} color={c.accent} />} onPress={ai} />
              <Row>
                <Input label="Contact name" value={f.contactName ?? ''} onChangeText={(v) => set({ contactName: v })} containerStyle={{ flex: 1 }} />
                <Input label="Contact phone" value={f.contactPhone ?? ''} onChangeText={(v) => set({ contactPhone: v })} keyboardType="phone-pad" containerStyle={{ flex: 1 }} />
              </Row>
            </>
          )}
        </Animated.View>
      </ScrollView>
      <Row style={{ padding: 16, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
        {step > 0 && <Button title="पीछे" variant="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
        {step < STEPS.length - 1 ? (
          <Button title="आगे" onPress={next} style={{ flex: 2 }} />
        ) : (
          <>
            <Button title="Draft" variant="secondary" onPress={() => save(false)} style={{ flex: 1 }} loading={busy} />
            <Button title={id ? 'Save' : 'Publish'} icon={<Check size={18} color="#fff" />} onPress={() => save(true)} style={{ flex: 2 }} loading={busy} />
          </>
        )}
      </Row>
    </SafeAreaView>
  );
}
