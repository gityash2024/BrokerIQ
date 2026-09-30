import { useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Camera, FileUp, Lock, Trash2 } from 'lucide-react-native';
import { api, del, patch, post, uploadUri } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError, useApiMutation } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Avatar, Badge, Button, Card, Chip, Header, Input, PressableScale, Row, Screen, SectionTitle, Txt } from '@/ui';
import { alert } from '@/lib/i18n';

const DOCS_USER = [
  ['OWNERSHIP_PROOF', 'Ownership proof'],
  ['ELECTRICITY_BILL', 'Electricity bill'],
  ['AADHAAR', 'Aadhaar'],
  ['PAN', 'PAN'],
];
const DOCS_BROKER = [
  ['RERA_CERTIFICATE', 'HRERA certificate'],
  ['GST_CERTIFICATE', 'GST certificate'],
  ['PAN', 'PAN'],
];
const TONE: Record<string, string> = { PENDING: '#F59E0B', VERIFIED: '#10B981', REJECTED: '#E11D48' };

export default function EditProfile() {
  const { c } = useTheme();
  const { user, refreshMe, logout, isBroker } = useAuth();
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [docType, setDocType] = useState(isBroker ? 'RERA_CERTIFICATE' : 'OWNERSHIP_PROOF');
  const [docNumber, setDocNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const kyc = useQuery({ queryKey: ['kyc'], queryFn: () => api<any[]>('/kyc/mine') });
  const save = useApiMutation(() => patch('/me', { name: f.name, phone: f.phone || null }), { success: 'Profile saved', onSuccess: () => refreshMe() });
  const changePw = useApiMutation(() => post('/auth/password/change', { currentPassword: pw.currentPassword || undefined, newPassword: pw.newPassword }), {
    success: 'Password बदल गया',
    onSuccess: () => setPw({ currentPassword: '', newPassword: '' }),
  });

  const pickImage = async (kind: 'avatar' | 'kyc') => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: kind === 'avatar', aspect: [1, 1] });
    if (r.canceled) return null;
    const small = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: kind === 'avatar' ? 600 : 1800 } }], {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return (await uploadUri(small.uri, kind)).url;
  };
  const avatar = async () => {
    try {
      const url = await pickImage('avatar');
      if (!url) return;
      await patch('/me', { avatarUrl: url });
      await refreshMe();
      toast.success('Photo updated');
    } catch (e) {
      showError(e);
    }
  };
  const uploadKyc = async () => {
    setUploading(true);
    try {
      const url = await pickImage('kyc');
      if (!url) return;
      await post('/kyc', { docType, fileUrl: url, docNumber: docNumber || null });
      toast.success('Document भेज दिया — 24–48 घंटे में verify होगा');
      setDocNumber('');
      kyc.refetch();
    } catch (e) {
      showError(e);
    } finally {
      setUploading(false);
    }
  };
  const deleteAccount = () =>
    alert('Account delete करें?', 'आपकी listings, saved properties और chats हट जाएँगी। यह वापस नहीं होगा।', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await del('/me');
            await logout();
          } catch (e) {
            showError(e);
          }
        },
      },
    ]);

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Profile & KYC" />
      <View style={{ alignItems: 'center', gap: 8, marginVertical: 12 }}>
        <PressableScale onPress={avatar}>
          <Avatar name={user?.name} uri={user?.avatarUrl} size={96} />
          <View
            style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: c.brand, borderRadius: 16, padding: 7, borderWidth: 3, borderColor: c.bg }}
          >
            <Camera size={16} color="#fff" />
          </View>
        </PressableScale>
        <Txt v="small" color="muted">
          {user?.email}
        </Txt>
      </View>
      <Card style={{ padding: 16, gap: 14 }}>
        <Input label="नाम" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Input
          label="Mobile"
          value={f.phone}
          onChangeText={(v) => setF({ ...f, phone: v })}
          keyboardType="phone-pad"
          hint="Brokers को enquiries के लिए दिखता है"
        />
        <Button title="Save" loading={save.isPending} onPress={() => save.mutate(undefined)} />
      </Card>

      <SectionTitle title="Password" subtitle="OTP / Google से login करते हैं तो current password खाली छोड़ें" />
      <Card style={{ padding: 16, gap: 14 }}>
        <Input
          label="Current password"
          secureTextEntry
          value={pw.currentPassword}
          onChangeText={(v) => setPw({ ...pw, currentPassword: v })}
          icon={<Lock size={18} color={c.subtle} />}
        />
        <Input
          label="New password"
          secureTextEntry
          value={pw.newPassword}
          onChangeText={(v) => setPw({ ...pw, newPassword: v })}
          icon={<Lock size={18} color={c.subtle} />}
          hint="8+ अक्षर, एक number"
        />
        <Button
          title="Password बदलें"
          variant="secondary"
          loading={changePw.isPending}
          disabled={pw.newPassword.length < 8}
          onPress={() => changePw.mutate(undefined)}
        />
      </Card>

      <SectionTitle
        title="Verification (KYC)"
        subtitle={isBroker ? 'HRERA certificate से Verified broker badge' : 'Ownership verify करने पर listing पर Verified badge'}
      />
      <Card style={{ padding: 16, gap: 12 }}>
        <Row wrap>
          {(isBroker ? DOCS_BROKER : DOCS_USER).map(([k, l]) => (
            <Chip key={k} label={l} active={docType === k} onPress={() => setDocType(k)} />
          ))}
        </Row>
        <Input label="Document number (optional)" value={docNumber} onChangeText={setDocNumber} />
        <Button title="Photo upload करें" icon={<FileUp size={18} color="#fff" />} loading={uploading} onPress={uploadKyc} />
        {(kyc.data ?? []).map((d) => (
          <Row key={d.id} style={{ justifyContent: 'space-between' }}>
            <Txt v="small">{d.docType.replace(/_/g, ' ')}</Txt>
            <Badge label={d.status} color={TONE[d.status]} icon={d.status === 'VERIFIED' ? <BadgeCheck size={11} color={TONE.VERIFIED} /> : undefined} />
          </Row>
        ))}
      </Card>

      <Button
        title="Account delete करें"
        variant="ghost"
        color={c.danger}
        icon={<Trash2 size={18} color={c.danger} />}
        style={{ marginTop: 24 }}
        onPress={deleteAccount}
      />
    </Screen>
  );
}
