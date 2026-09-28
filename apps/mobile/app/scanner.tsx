import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { AlertCircle, CheckCircle2, FileText, ImagePlus, RotateCw, ScanLine, Send, Sparkles, Trash2 } from 'lucide-react-native';
import { BROKERAGE_LABELS, PROPERTY_TYPE_LABELS, RENTABLE_TYPES, formatPriceShort, plural, type PropertyType } from '@brokeriq/shared';
import { api, post } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Chip, ErrorView, Header, IconBtn, Input, PressableScale, Row, Screen, Sheet, Txt } from '@/ui';

type PageState = { uri: string; status: 'pending' | 'scanning' | 'done' | 'error'; rows: number; rawText?: string | null; error?: unknown };

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

/** Same property twice (across pages)? Same phone + unit, or same society + unit + rent. */
const rowKey = (r: any) => [r.contactPhone ?? '', (r.unit ?? '').toLowerCase(), (r.societyName ?? '').toLowerCase(), r.price ?? ''].join('|');

export default function Scanner() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const locs = useQuery({ queryKey: ['localities-all'], queryFn: () => api<any[]>('/public/localities', { auth: false }), staleTime: 600_000 });
  const [pages, setPages] = useState<PageState[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const [locQ, setLocQ] = useState('');
  const [importing, setImporting] = useState<false | 'draft' | 'submit'>(false);
  const [rawOpen, setRawOpen] = useState<number | null>(null);

  /** OCR + AI-extract pages one by one (keeps each request small and shows progress). */
  const processPages = async (uris: string[], startIndex: number) => {
    setBusy(true);
    setErr(null);
    let added = 0;
    for (let k = 0; k < uris.length; k++) {
      const idx = startIndex + k;
      setPages((ps) => ps.map((p, i) => (i === idx ? { ...p, status: 'scanning', error: undefined } : p)));
      try {
        const m = await ImageManipulator.manipulateAsync(uris[k], [{ resize: { width: 1600 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
        const res = await post<{ rows: any[]; rawText?: string | null }>('/ai/scan', { image: `data:image/jpeg;base64,${m.base64}`, page: idx + 1 });
        setRows((rs) => {
          const seen = new Set(rs.map(rowKey));
          const fresh = res.rows.filter((r) => !seen.has(rowKey(r)));
          added += fresh.length;
          return [...rs, ...fresh];
        });
        setPages((ps) => ps.map((p, i) => (i === idx ? { ...p, status: 'done', rows: res.rows.length, rawText: res.rawText } : p)));
      } catch (e) {
        setPages((ps) => ps.map((p, i) => (i === idx ? { ...p, status: 'error', error: e } : p)));
        setErr(e);
      }
    }
    setBusy(false);
    if (added) toast.success(`${plural(added, 'property', 'properties')} पढ़ी गईं ✨`);
  };

  const addPages = async (uris: string[]) => {
    if (!uris.length) return;
    const start = pages.length;
    setPages((ps) => [...ps, ...uris.map((uri) => ({ uri, status: 'pending' as const, rows: 0 }))]);
    await processPages(uris, start);
  };

  /** Google ML Kit document scanner: edge detection, perspective crop, clean-up filters, multiple pages. */
  const scanDocs = async () => {
    try {
      const res = await DocumentScanner.scanDocument({ maxNumDocuments: 20, croppedImageQuality: 85 });
      if (res.status === 'cancel' || !res.scannedImages?.length) return;
      await addPages(res.scannedImages);
    } catch {
      // Devices without the ML Kit module (no Play services) fall back to the plain camera.
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return toast.error('Camera permission दें');
      const r = await ImagePicker.launchCameraAsync({ quality: 0.9 });
      if (!r.canceled) await addPages(r.assets.map((a) => a.uri));
    }
  };
  const fromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.error('Gallery permission दें');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: true, selectionLimit: 20 });
    if (!r.canceled) await addPages(r.assets.map((a) => a.uri));
  };
  const retry = (i: number) => processPages([pages[i].uri], i);

  const importAll = async (submit: boolean) => {
    setImporting(submit ? 'submit' : 'draft');
    try {
      const payload = rows.map(({ localityName, confidence, error, page, ...r }) => (void localityName, void confidence, void error, void page, r));
      const res = await post<{ created: number; errors: { index: number; error: string }[] }>('/ai/scan/import', { rows: payload, submit });
      const bad = new Set(res.errors.map((e) => e.index));
      setRows((rs) => rs.map((r, i) => ({ ...r, error: res.errors.find((e) => e.index === i)?.error })).filter((_, i) => bad.has(i)));
      qc.invalidateQueries({ queryKey: ['my-listings'] });
      toast.success(submit ? `${plural(res.created, 'listing')} admin approval के लिए भेजी गईं ✅` : `${plural(res.created, 'draft listing')} बनीं — photos जोड़कर approval के लिए भेजें`);
      if (!res.errors.length) router.replace('/(broker)/inventory');
    } catch (e) {
      showError(e);
    } finally {
      setImporting(false);
    }
  };

  const cur = edit != null ? rows[edit] : null;
  const setCur = (p: any) => setRows((rs) => rs.map((r, i) => (i === edit ? { ...r, ...p, error: undefined } : r)));
  const scanning = pages.find((p) => p.status === 'scanning');
  const ready = rows.filter((r) => r.localityId && r.price).length;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="AI listing-book scanner" subtitle="Register के पन्ने scan करें → rent listings" />
      <Card style={{ overflow: 'hidden', marginTop: 6 }}>
        <View style={{ aspectRatio: 4 / 3, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
          {scanning || pages.length ? (
            <Image source={{ uri: (scanning ?? pages[pages.length - 1]).uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          ) : (
            <View style={{ alignItems: 'center', gap: 8, padding: 24 }}>
              <View style={{ width: 70, height: 70, borderRadius: 24, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
                <ScanLine size={34} color="#fff" />
              </View>
              <Txt v="h3">Register के पन्ने scan करें</Txt>
              <Txt v="small" color="muted" style={{ textAlign: 'center' }}>
                Scanner अपने-आप page के किनारे पहचानकर crop और साफ़ करता है। एक बार में कई पन्ने — Hindi/English handwriting दोनों चलती है।
              </Txt>
            </View>
          )}
          {!!scanning && <ScanOverlay />}
        </View>
        <Row style={{ padding: 12 }}>
          <Button title="Scan pages" icon={<ScanLine size={18} color="#fff" />} style={{ flex: 1 }} loading={busy} onPress={scanDocs} />
          <Button title="Gallery" variant="secondary" icon={<ImagePlus size={18} color={c.fg} />} style={{ flex: 1 }} disabled={busy} onPress={fromGallery} />
        </Row>
      </Card>

      {pages.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 12 }}>
          {pages.map((p, i) => (
            <PressableScale key={`${p.uri}${i}`} onPress={() => (p.status === 'error' ? retry(i) : p.rawText ? setRawOpen(i) : undefined)} style={{ width: 84 }}>
              <View style={{ width: 84, height: 108, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: p.status === 'error' ? c.danger : p.status === 'done' ? c.success : c.line }}>
                <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                <View style={{ position: 'absolute', top: 4, right: 4 }}>
                  {p.status === 'done' ? <CheckCircle2 size={18} color={c.success} /> : p.status === 'error' ? <RotateCw size={18} color={c.danger} /> : p.status === 'scanning' ? <Sparkles size={18} color={c.brand} /> : null}
                </View>
              </View>
              <Txt v="caption" color={p.status === 'error' ? 'danger' : 'muted'} style={{ textAlign: 'center', marginTop: 4 }}>
                {p.status === 'error' ? 'Retry' : p.status === 'done' ? `Page ${i + 1} · ${p.rows}` : `Page ${i + 1}`}
              </Txt>
            </PressableScale>
          ))}
        </ScrollView>
      )}

      {!!err && <ErrorView error={err} />}

      {rows.length > 0 && (
        <>
          <Row style={{ justifyContent: 'space-between', marginTop: 8, marginBottom: 8 }}>
            <Txt v="h3">{plural(rows.length, 'row')} — tap करके edit करें</Txt>
            <Badge label={`${ready}/${rows.length} ready`} color={ready === rows.length ? c.success : c.warning} />
          </Row>
          <View style={{ gap: 8 }}>
            {rows.map((r, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(Math.min(i, 10) * 40)}>
                <Card style={{ padding: 12, gap: 4, borderColor: r.error ? c.danger : !r.localityId || !r.price ? c.warning : c.line }} onPress={() => (setEdit(i), setLocQ(''))}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                      {r.bedrooms ? `${r.bedrooms} BHK ` : ''}
                      {PROPERTY_TYPE_LABELS[r.propertyType as PropertyType]}
                    </Txt>
                    <Row gap={4}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: (r.confidence ?? 0.6) > 0.75 ? c.success : (r.confidence ?? 0.6) > 0.5 ? c.warning : c.danger }} />
                      <IconBtn onPress={() => setRows(rows.filter((_, k) => k !== i))}>
                        <Trash2 size={16} color={c.muted} />
                      </IconBtn>
                    </Row>
                  </Row>
                  <Txt v="small" color={r.localityId ? 'muted' : 'warning'}>
                    {locs.data?.find((l) => l.id === r.localityId)?.name ?? (r.localityName ? `? ${r.localityName}` : 'Locality चुनें')}
                    {r.societyName ? ` · ${r.societyName}` : ''}
                  </Txt>
                  <Txt v="small" color={r.price ? 'brand' : 'warning'}>
                    {r.price ? `${formatPriceShort(r.price)}/mo` : 'Rent डालें'}
                    {r.securityDeposit ? ` · Deposit ${formatPriceShort(r.securityDeposit)}` : ''}
                    {r.brokerageType ? ` · ${BROKERAGE_LABELS[r.brokerageType as keyof typeof BROKERAGE_LABELS]}` : ''}
                  </Txt>
                  {!!(r.contactName || r.contactPhone) && <Txt v="caption" color="muted">{[r.contactName, r.contactPhone].filter(Boolean).join(' · ')}</Txt>}
                  {!!r.error && <Badge label={r.error} color={c.danger} />}
                </Card>
              </Animated.View>
            ))}
          </View>
          <Button title={`${plural(rows.length, 'listing')} approval के लिए भेजें`} size="lg" icon={<Send size={18} color="#fff" />} style={{ marginTop: 16 }} loading={importing === 'submit'} disabled={!!importing} onPress={() => importAll(true)} />
          <Button title="Drafts में डालें (photos बाद में)" variant="secondary" icon={<FileText size={18} color={c.fg} />} style={{ marginTop: 10 }} loading={importing === 'draft'} disabled={!!importing} onPress={() => importAll(false)} />
          <Txt v="caption" color="muted" style={{ textAlign: 'center', marginTop: 8 }}>हर listing admin approval के बाद ही live होती है।</Txt>
        </>
      )}

      <Sheet open={rawOpen != null} onClose={() => setRawOpen(null)} title={rawOpen != null ? `Page ${rawOpen + 1} — मूल text (OCR)` : ''}>
        {rawOpen != null && (
          <>
            <Row gap={6}>
              <AlertCircle size={14} color={c.muted} />
              <Txt v="caption" color="muted" style={{ flex: 1 }}>Rows को इस text से मिलाकर check करें।</Txt>
            </Row>
            <Txt selectable style={{ lineHeight: 22 }}>{pages[rawOpen]?.rawText || '—'}</Txt>
          </>
        )}
      </Sheet>

      <Sheet open={cur != null} onClose={() => setEdit(null)} title="Row edit करें">
        {cur && (
          <>
            <Row wrap>
              {RENTABLE_TYPES.filter((t) => ['APARTMENT', 'BUILDER_FLOOR', 'INDEPENDENT_HOUSE', 'VILLA', 'STUDIO', 'PG', 'OFFICE', 'SHOP'].includes(t)).map((t) => (
                <Chip key={t} label={PROPERTY_TYPE_LABELS[t]} active={cur.propertyType === t} onPress={() => setCur({ propertyType: t })} />
              ))}
            </Row>
            <Input label="Locality खोजें" value={locQ} onChangeText={setLocQ} />
            <Row wrap>
              {(locs.data ?? [])
                .filter((l) => cur.localityId === l.id || (locQ && l.name.toLowerCase().includes(locQ.toLowerCase())))
                .slice(0, 12)
                .map((l) => (
                  <Chip key={l.id} label={l.name} active={cur.localityId === l.id} onPress={() => setCur({ localityId: l.id })} />
                ))}
            </Row>
            <Row>
              <Input label="Society" value={cur.societyName ?? ''} onChangeText={(v) => setCur({ societyName: v || null })} containerStyle={{ flex: 1 }} />
              <Input label="Unit" value={cur.unit ?? ''} onChangeText={(v) => setCur({ unit: v || null })} containerStyle={{ flex: 1 }} />
            </Row>
            <Row>
              <Input label="BHK" value={cur.bedrooms != null ? String(cur.bedrooms) : ''} onChangeText={(v) => setCur({ bedrooms: v ? Number(v) : null })} keyboardType="numeric" containerStyle={{ flex: 1 }} />
              <Input label="Area sqft" value={cur.area != null ? String(cur.area) : ''} onChangeText={(v) => setCur({ area: v ? Number(v) : null })} keyboardType="numeric" containerStyle={{ flex: 1 }} />
            </Row>
            <Row>
              <Input label="Rent ₹/month" value={cur.price != null ? String(cur.price) : ''} onChangeText={(v) => setCur({ price: v ? Number(v.replace(/\D/g, '')) : null })} keyboardType="numeric" hint={cur.price ? formatPriceShort(cur.price) : undefined} containerStyle={{ flex: 1 }} />
              <Input label="Deposit ₹" value={cur.securityDeposit != null ? String(cur.securityDeposit) : ''} onChangeText={(v) => setCur({ securityDeposit: v ? Number(v.replace(/\D/g, '')) : null })} keyboardType="numeric" containerStyle={{ flex: 1 }} />
            </Row>
            <Txt v="label" color="subtle">Brokerage</Txt>
            <Row wrap>
              {Object.entries(BROKERAGE_LABELS).map(([k, l]) => (
                <Chip key={k} label={l} active={cur.brokerageType === k} onPress={() => setCur({ brokerageType: cur.brokerageType === k ? null : k })} />
              ))}
            </Row>
            {cur.brokerageType === 'FIXED' && <Input label="Brokerage ₹" value={cur.brokerageAmount != null ? String(cur.brokerageAmount) : ''} onChangeText={(v) => setCur({ brokerageAmount: v ? Number(v.replace(/\D/g, '')) : null })} keyboardType="numeric" />}
            <Row wrap>
              {(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'] as const).map((f) => (
                <Chip key={f} label={f === 'FULLY_FURNISHED' ? 'Fully furnished' : f === 'SEMI_FURNISHED' ? 'Semi' : 'Unfurnished'} active={cur.furnishing === f} onPress={() => setCur({ furnishing: cur.furnishing === f ? null : f })} />
              ))}
            </Row>
            <Row>
              <Input label="Owner" value={cur.contactName ?? ''} onChangeText={(v) => setCur({ contactName: v || null })} containerStyle={{ flex: 1 }} />
              <Input label="Phone" value={cur.contactPhone ?? ''} onChangeText={(v) => setCur({ contactPhone: v || null })} keyboardType="phone-pad" containerStyle={{ flex: 1 }} />
            </Row>
            <Input label="Notes" value={cur.notes ?? ''} onChangeText={(v) => setCur({ notes: v || null })} multiline />
            <Button title="Done" onPress={() => setEdit(null)} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
