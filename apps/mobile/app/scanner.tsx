import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Camera, CheckCircle2, ImagePlus, ScanLine, Sparkles, Trash2 } from 'lucide-react-native';
import { PROPERTY_TYPE_LABELS, formatPriceShort, type PropertyType } from '@brokeriq/shared';
import { api, post } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Chip, ErrorView, Header, IconBtn, Input, Row, Screen, Sheet, Txt } from '@/ui';

function ScanOverlay() {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
  }, [y]);
  const a = useAnimatedStyle(() => ({ top: `${y.value * 90}%` }));
  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(30,27,75,0.35)' } as any}>
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#818CF8', shadowColor: '#818CF8', shadowOpacity: 1, shadowRadius: 12 }, a]} />
    </View>
  );
}

export default function Scanner() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const locs = useQuery({ queryKey: ['localities-all'], queryFn: () => api<any[]>('/public/localities', { auth: false }), staleTime: 600_000 });
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const [locQ, setLocQ] = useState('');
  const [importing, setImporting] = useState(false);

  const scan = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.error('Permission दें');
    const r = camera ? await ImagePicker.launchCameraAsync({ quality: 0.9 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (r.canceled) return;
    setErr(null);
    const m = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 1800 } }], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true });
    setPreview(m.uri);
    setScanning(true);
    try {
      const res = await post<{ rows: any[] }>('/ai/scan', { image: `data:image/jpeg;base64,${m.base64}` });
      setRows(res.rows);
      if (!res.rows.length) toast.info('कोई row नहीं पढ़ी गई — साफ़, सीधी photo लें');
      else toast.success(`${res.rows.length} properties पढ़ी गईं ✨`);
    } catch (e) {
      setErr(e);
    } finally {
      setScanning(false);
    }
  };
  const importAll = async () => {
    setImporting(true);
    try {
      const payload = rows.map(({ localityName, confidence, error, ...r }) => (void localityName, void confidence, void error, r));
      const res = await post<{ created: number; errors: { index: number; error: string }[] }>('/ai/scan/import', { rows: payload });
      const bad = new Set(res.errors.map((e) => e.index));
      setRows((rs) => rs.map((r, i) => ({ ...r, error: res.errors.find((e) => e.index === i)?.error })).filter((_, i) => bad.has(i)));
      qc.invalidateQueries({ queryKey: ['my-listings'] });
      toast.success(`${res.created} draft listings बनीं — photos जोड़कर publish करें`);
      if (!res.errors.length) router.replace('/(broker)/inventory');
    } catch (e) {
      showError(e);
    } finally {
      setImporting(false);
    }
  };
  const cur = edit != null ? rows[edit] : null;
  const setCur = (p: any) => setRows((rs) => rs.map((r, i) => (i === edit ? { ...r, ...p, error: undefined } : r)));
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="AI listing-book scanner" subtitle="Register की photo → inventory" />
      <Card style={{ overflow: 'hidden', marginTop: 6 }}>
        <View style={{ aspectRatio: 4 / 3, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
          {preview ? <Image source={{ uri: preview }} style={{ width: '100%', height: '100%' }} contentFit="contain" /> : (
            <View style={{ alignItems: 'center', gap: 8, padding: 24 }}>
              <View style={{ width: 70, height: 70, borderRadius: 24, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}><ScanLine size={34} color="#fff" /></View>
              <Txt v="h3">Page की photo लें</Txt>
              <Txt v="small" color="muted" style={{ textAlign: 'center' }}>अच्छी रोशनी, page सीधा। Hindi/English handwriting दोनों चलती है।</Txt>
            </View>
          )}
          {scanning && <ScanOverlay />}
        </View>
        <Row style={{ padding: 12 }}>
          <Button title="Camera" icon={<Camera size={18} color="#fff" />} style={{ flex: 1 }} loading={scanning} onPress={() => scan(true)} />
          <Button title="Gallery" variant="secondary" icon={<ImagePlus size={18} color={c.fg} />} style={{ flex: 1 }} disabled={scanning} onPress={() => scan(false)} />
        </Row>
      </Card>
      {!!err && <ErrorView error={err} />}
      {rows.length > 0 && (
        <>
          <Row style={{ justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
            <Txt v="h3">{rows.length} rows — tap करके edit करें</Txt>
            <Sparkles size={18} color={c.accent} />
          </Row>
          <View style={{ gap: 8 }}>
            {rows.map((r, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(i * 40)}>
                <Card style={{ padding: 12, gap: 4, borderColor: r.error ? c.danger : !r.localityId || !r.price ? c.warning : c.line }} onPress={() => (setEdit(i), setLocQ(''))}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="bodyStrong">{r.bedrooms ? `${r.bedrooms} BHK ` : ''}{PROPERTY_TYPE_LABELS[r.propertyType as PropertyType]} · {r.purpose}</Txt>
                    <Row gap={4}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: (r.confidence ?? 0.6) > 0.75 ? c.success : (r.confidence ?? 0.6) > 0.5 ? c.warning : c.danger }} />
                      <IconBtn onPress={() => setRows(rows.filter((_, k) => k !== i))}><Trash2 size={16} color={c.muted} /></IconBtn>
                    </Row>
                  </Row>
                  <Txt v="small" color={r.localityId ? 'muted' : 'warning'}>{locs.data?.find((l) => l.id === r.localityId)?.name ?? (r.localityName ? `? ${r.localityName}` : 'Locality चुनें')}{r.societyName ? ` · ${r.societyName}` : ''}</Txt>
                  <Txt v="small" color={r.price ? 'brand' : 'warning'}>{r.price ? formatPriceShort(r.price) : 'Price डालें'}{r.area ? ` · ${r.area} sqft` : ''}{r.contactName ? ` · ${r.contactName}` : ''}</Txt>
                  {!!r.error && <Badge label={r.error} color={c.danger} />}
                </Card>
              </Animated.View>
            ))}
          </View>
          <Button title={`Import ${rows.length} as drafts`} size="lg" icon={<CheckCircle2 size={18} color="#fff" />} style={{ marginTop: 16 }} loading={importing} onPress={importAll} />
        </>
      )}
      <Sheet open={cur != null} onClose={() => setEdit(null)} title="Row edit करें">
        {cur && (
          <>
            <Row><Chip label="Sale" active={cur.purpose === 'SALE'} onPress={() => setCur({ purpose: 'SALE' })} /><Chip label="Rent" active={cur.purpose === 'RENT'} onPress={() => setCur({ purpose: 'RENT' })} /></Row>
            <Input label="Locality खोजें" value={locQ} onChangeText={setLocQ} />
            <Row wrap>{(locs.data ?? []).filter((l) => cur.localityId === l.id || (locQ && l.name.toLowerCase().includes(locQ.toLowerCase()))).slice(0, 12).map((l) => <Chip key={l.id} label={l.name} active={cur.localityId === l.id} onPress={() => setCur({ localityId: l.id })} />)}</Row>
            <Input label="Society" value={cur.societyName ?? ''} onChangeText={(v) => setCur({ societyName: v || null })} />
            <Row>
              <Input label="BHK" value={cur.bedrooms != null ? String(cur.bedrooms) : ''} onChangeText={(v) => setCur({ bedrooms: v ? Number(v) : null })} keyboardType="numeric" containerStyle={{ flex: 1 }} />
              <Input label="Area sqft" value={cur.area != null ? String(cur.area) : ''} onChangeText={(v) => setCur({ area: v ? Number(v) : null })} keyboardType="numeric" containerStyle={{ flex: 1 }} />
            </Row>
            <Input label="Price ₹" value={cur.price != null ? String(cur.price) : ''} onChangeText={(v) => setCur({ price: v ? Number(v.replace(/\D/g, '')) : null })} keyboardType="numeric" hint={cur.price ? formatPriceShort(cur.price) : undefined} />
            <Row>
              <Input label="Owner" value={cur.contactName ?? ''} onChangeText={(v) => setCur({ contactName: v || null })} containerStyle={{ flex: 1 }} />
              <Input label="Phone" value={cur.contactPhone ?? ''} onChangeText={(v) => setCur({ contactPhone: v || null })} keyboardType="phone-pad" containerStyle={{ flex: 1 }} />
            </Row>
            <Button title="Done" onPress={() => setEdit(null)} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
