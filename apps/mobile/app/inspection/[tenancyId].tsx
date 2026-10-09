import { useEffect, useState } from 'react';
import { Linking, Pressable, Share, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useQuery } from '@tanstack/react-query';
import { Camera, ImagePlus, Plus, Trash2, X } from 'lucide-react-native';
import { INSPECTION_CONDITIONS, INSPECTION_TEMPLATE, formatINR, type InspectionItem, type InspectionRoom } from '@brokeriq/shared';
import { api, img, put, uploadUri } from '@/lib/api';
import { showError, useApiMutation } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Chip, Header, Input, Loader, Row, Screen, Segmented, Txt } from '@/ui';

type Kind = 'MOVE_IN' | 'MOVE_OUT';

/** Move-in / move-out checklist editor: rooms & items, meters, keys, photos, deposit settlement; then share the OTP-confirm link. */
export default function InspectionEditor() {
  const { tenancyId, kind: kindParam } = useLocalSearchParams<{ tenancyId: string; kind?: Kind }>();
  const { c } = useTheme();
  const [kind, setKind] = useState<Kind>(kindParam === 'MOVE_OUT' ? 'MOVE_OUT' : 'MOVE_IN');
  const q = useQuery({ queryKey: ['inspections', tenancyId], queryFn: () => api<any[]>(`/broker/tenancies/${tenancyId}/inspections`) });
  const current = q.data?.find((i) => i.kind === kind);
  const moveIn = q.data?.find((i) => i.kind === 'MOVE_IN');
  const [rooms, setRooms] = useState<InspectionRoom[]>(INSPECTION_TEMPLATE);
  const [f, setF] = useState({ electricity: '', water: '', gas: '', keys: '', notes: '', deposit: '' });
  const [deductions, setDeductions] = useState<{ reason: string; amount: string }[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);

  useEffect(() => {
    // Move-out starts from the move-in list so each item can be compared.
    const src = current ?? (kind === 'MOVE_OUT' ? moveIn : null);
    setRooms((src?.rooms as InspectionRoom[]) ?? INSPECTION_TEMPLATE);
    const m = (current?.meters ?? {}) as Record<string, string>;
    setF({
      electricity: m.electricity ?? '',
      water: m.water ?? '',
      gas: m.gas ?? '',
      keys: src?.keys != null ? String(src.keys) : '',
      notes: current?.notes ?? '',
      deposit: current?.depositAmount != null ? String(current.depositAmount) : '',
    });
    setDeductions(((current?.deductions as any[]) ?? []).map((d) => ({ reason: d.reason, amount: String(d.amount) })));
    setPhotos(current?.photos ?? []);
  }, [current, moveIn, kind]);

  const save = useApiMutation(
    () =>
      put(`/broker/tenancies/${tenancyId}/inspections`, {
        kind,
        rooms: rooms.map((r) => ({ ...r, items: r.items.filter((i) => i.name.trim()) })).filter((r) => r.name.trim()),
        meters: { ...(f.electricity && { electricity: f.electricity }), ...(f.water && { water: f.water }), ...(f.gas && { gas: f.gas }) },
        keys: f.keys ? Number(f.keys) : null,
        photos,
        notes: f.notes || null,
        depositAmount: kind === 'MOVE_OUT' && f.deposit ? Number(f.deposit) : null,
        deductions: kind === 'MOVE_OUT' ? deductions.filter((d) => d.reason && d.amount).map((d) => ({ reason: d.reason, amount: Number(d.amount) })) : null,
      }),
    { success: 'Checklist save — अब दोनों से confirm करवाएँ', invalidate: [['inspections', tenancyId]] },
  );

  // Functional updates: fast typing (several events before a re-render) must not drop earlier edits.
  const setItem = (ri: number, ii: number, p: Partial<InspectionItem>) =>
    setRooms((rs) => rs.map((r, i) => (i !== ri ? r : { ...r, items: r.items.map((it, j) => (j === ii ? { ...it, ...p } : it)) })));

  const addPhotos = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.error('Permission दें');
    const res = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 20, quality: 0.9 });
    if (res.canceled) return;
    for (const a of res.assets.slice(0, 40 - photos.length)) {
      setUploading((n) => n + 1);
      try {
        const small = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: Math.min(1600, a.width || 1600) } }], {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        const { url } = await uploadUri(small.uri, 'inspection');
        setPhotos((p) => [...p, url]);
      } catch (e) {
        showError(e);
        break;
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const refund = Number(f.deposit || 0) - deductions.reduce((s, d) => s + Number(d.amount || 0), 0);
  if (q.isLoading) return <Loader />;
  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Move-in / move-out checklist" subtitle="दोनों पक्ष OTP से confirm करते हैं" />
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'MOVE_IN', label: 'Move-in' },
          { value: 'MOVE_OUT', label: 'Move-out' },
        ]}
      />
      {current && (
        <Card style={{ padding: 14, gap: 8, marginTop: 12 }}>
          <Row wrap>
            <Badge label={`Landlord ${current.landlordConfirmedAt ? '✓' : 'pending'}`} color={current.landlordConfirmedAt ? c.success : c.warning} />
            <Badge label={`Tenant ${current.tenantConfirmedAt ? '✓' : 'pending'}`} color={current.tenantConfirmedAt ? c.success : c.warning} />
          </Row>
          <Row wrap>
            <Button
              title="Link भेजें"
              size="sm"
              onPress={() => Share.share({ message: `${kind === 'MOVE_OUT' ? 'Move-out' : 'Move-in'} checklist देखें और OTP से confirm करें: ${current.url}` })}
            />
            <Button title="PDF" size="sm" variant="secondary" onPress={() => Linking.openURL(current.pdfUrl)} />
          </Row>
        </Card>
      )}

      {rooms.map((r, ri) => (
        <Card key={ri} style={{ padding: 12, gap: 8, marginTop: 12 }}>
          <Row>
            <Input value={r.name} onChangeText={(v) => setRooms((rs) => rs.map((x, i) => (i === ri ? { ...x, name: v } : x)))} containerStyle={{ flex: 1 }} />
            <Pressable accessibilityLabel="Room हटाएँ" hitSlop={8} onPress={() => setRooms((rs) => rs.filter((_, i) => i !== ri))}>
              <X size={20} color={c.muted} />
            </Pressable>
          </Row>
          {r.items.map((it, ii) => (
            <View key={ii} style={{ gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: c.line }}>
              <Row>
                <Input value={it.name} placeholder="Item" onChangeText={(v) => setItem(ri, ii, { name: v })} containerStyle={{ flex: 1 }} />
                <Pressable
                  accessibilityLabel="Remove"
                  hitSlop={8}
                  onPress={() => setRooms((rs) => rs.map((x, i) => (i === ri ? { ...x, items: x.items.filter((_, j) => j !== ii) } : x)))}
                >
                  <Trash2 size={18} color={c.muted} />
                </Pressable>
              </Row>
              <Row wrap>
                {INSPECTION_CONDITIONS.map((cond) => (
                  <Chip key={cond} label={cond} active={it.condition === cond} onPress={() => setItem(ri, ii, { condition: cond })} />
                ))}
              </Row>
              <Input placeholder="Note" value={it.note ?? ''} onChangeText={(v) => setItem(ri, ii, { note: v })} />
            </View>
          ))}
          <Button
            title="Item"
            size="sm"
            variant="ghost"
            icon={<Plus size={16} color={c.brand} />}
            onPress={() => setRooms((rs) => rs.map((x, i) => (i === ri ? { ...x, items: [...x.items, { name: '', condition: 'GOOD' }] } : x)))}
          />
        </Card>
      ))}
      <Button
        title="Room जोड़ें"
        variant="secondary"
        icon={<Plus size={16} color={c.fg} />}
        onPress={() => setRooms([...rooms, { name: `Room ${rooms.length + 1}`, items: [{ name: '', condition: 'GOOD' }] }])}
        style={{ marginTop: 12 }}
      />

      <Card style={{ padding: 12, gap: 10, marginTop: 12 }}>
        <Row>
          <Input label="Electricity meter" value={f.electricity} onChangeText={(v) => setF((p) => ({ ...p, electricity: v }))} containerStyle={{ flex: 1 }} />
          <Input label="Water meter" value={f.water} onChangeText={(v) => setF((p) => ({ ...p, water: v }))} containerStyle={{ flex: 1 }} />
        </Row>
        <Row>
          <Input label="Gas meter" value={f.gas} onChangeText={(v) => setF((p) => ({ ...p, gas: v }))} containerStyle={{ flex: 1 }} />
          <Input
            label="चाबियाँ (गिनती)"
            value={f.keys}
            keyboardType="number-pad"
            onChangeText={(v) => setF((p) => ({ ...p, keys: v.replace(/\D/g, '') }))}
            containerStyle={{ flex: 1 }}
          />
        </Row>
        <Input label="Notes" value={f.notes} multiline onChangeText={(v) => setF((p) => ({ ...p, notes: v }))} />
      </Card>

      <Card style={{ padding: 12, gap: 10, marginTop: 12 }}>
        <Txt v="bodyStrong">{`Photos (${photos.length})`}</Txt>
        <Txt v="caption" color="muted">
          दीवारें, फ़र्श, fittings, meter — deposit के झगड़े में यही सबूत हैं। PDF में भी छपती हैं।
        </Txt>
        <Row wrap>
          {photos.map((u) => (
            <View key={u}>
              <Image source={{ uri: img(u, 320) }} style={{ width: 92, height: 70, borderRadius: 10, backgroundColor: c.surface2 }} contentFit="cover" />
              <Pressable
                accessibilityLabel="Remove"
                onPress={() => setPhotos((ps) => ps.filter((x) => x !== u))}
                style={{ position: 'absolute', top: 4, right: 4, backgroundColor: c.danger, borderRadius: 8, padding: 3 }}
              >
                <X size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
        </Row>
        <Row>
          <Button
            title="Camera"
            size="sm"
            variant="secondary"
            icon={<Camera size={16} color={c.fg} />}
            loading={uploading > 0}
            disabled={photos.length >= 40}
            onPress={() => addPhotos(true)}
          />
          <Button
            title="Gallery"
            size="sm"
            variant="secondary"
            icon={<ImagePlus size={16} color={c.fg} />}
            disabled={uploading > 0 || photos.length >= 40}
            onPress={() => addPhotos(false)}
          />
        </Row>
      </Card>

      {kind === 'MOVE_OUT' && (
        <Card style={{ padding: 12, gap: 10, marginTop: 12 }}>
          <Txt v="bodyStrong">Deposit settlement</Txt>
          <Input
            label="Security deposit (₹)"
            value={f.deposit}
            keyboardType="number-pad"
            onChangeText={(v) => setF((p) => ({ ...p, deposit: v.replace(/\D/g, '') }))}
          />
          {deductions.map((d, i) => (
            <Row key={i}>
              <Input
                placeholder="Deduction का कारण"
                value={d.reason}
                onChangeText={(v) => setDeductions((ds) => ds.map((x, j) => (j === i ? { ...x, reason: v } : x)))}
                containerStyle={{ flex: 2 }}
              />
              <Input
                placeholder="₹"
                value={d.amount}
                keyboardType="number-pad"
                onChangeText={(v) => setDeductions((ds) => ds.map((x, j) => (j === i ? { ...x, amount: v.replace(/\D/g, '') } : x)))}
                containerStyle={{ flex: 1 }}
              />
              <Pressable accessibilityLabel="Remove" hitSlop={8} onPress={() => setDeductions((ds) => ds.filter((_, j) => j !== i))}>
                <X size={18} color={c.muted} />
              </Pressable>
            </Row>
          ))}
          <Button
            title="Deduction"
            size="sm"
            variant="ghost"
            icon={<Plus size={16} color={c.brand} />}
            onPress={() => setDeductions([...deductions, { reason: '', amount: '' }])}
          />
          {!!f.deposit && <Txt>{`Tenant को refund: ${formatINR(Math.max(0, refund))}`}</Txt>}
        </Card>
      )}

      <Button title="Save" full size="lg" loading={save.isPending} disabled={uploading > 0} onPress={() => save.mutate(undefined)} style={{ marginTop: 16 }} />
    </Screen>
  );
}
