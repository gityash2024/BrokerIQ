import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Building2, Camera, Rocket } from 'lucide-react-native';
import type { AuthResponse } from '@brokeriq/shared';
import { api, post, uploadUri } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError, useLightStatusBar } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Avatar, Button, Chip, Input, PressableScale, Row, Screen, Txt } from '@/ui';
import type { LocalityListItem } from '@brokeriq/shared';

export default function BrokerOnboarding() {
  useLightStatusBar();
  const { c } = useTheme();
  const { user, setSession } = useAuth();
  const insets = useSafeAreaInsets();
  const locs = useQuery({ queryKey: ['localities-all'], queryFn: () => api<LocalityListItem[]>('/public/localities', { auth: false }), staleTime: 600_000 });
  const [f, setF] = useState({
    firmName: user?.organization?.name ?? '',
    phone: user?.phone ?? '',
    whatsapp: '',
    reraNumber: '',
    gstNumber: '',
    about: '',
    experienceYears: '',
    address: '',
    logoUrl: '',
    localityIds: [] as string[],
  });
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const logo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (r.canceled) return;
    try {
      const small = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 600 } }], {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      setF((x) => ({ ...x, logoUrl: '' }));
      const { url } = await uploadUri(small.uri, 'logo');
      setF((x) => ({ ...x, logoUrl: url }));
    } catch (e) {
      showError(e);
    }
  };
  const submit = async () => {
    setBusy(true);
    try {
      const r = await post<AuthResponse>('/broker/onboarding', {
        ...f,
        experienceYears: f.experienceYears ? Number(f.experienceYears) : null,
        logoUrl: f.logoUrl || null,
        whatsapp: f.whatsapp || null,
        reraNumber: f.reraNumber || null,
        gstNumber: f.gstNumber || null,
        website: '',
      });
      await setSession(r);
      toast.success('Setup पूरा! 🎉 अब leads connect करें');
      router.replace('/(broker)/dashboard');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string) =>
    setF((x) => ({ ...x, localityIds: x.localityIds.includes(id) ? x.localityIds.filter((y) => y !== id) : [...x.localityIds, id].slice(0, 30) }));
  return (
    <Screen edges={['bottom']} keyboard padded={false}>
      <LinearGradient
        colors={['#1E1B4B', '#4F46E5']}
        style={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 36, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
      >
        <Animated.View entering={FadeInDown}>
          <Building2 size={32} color="#fff" />
          <Txt v="h1" color="white" style={{ marginTop: 10 }}>
            {user?.organization?.onboarded ? 'Firm profile' : 'अपनी firm set up करें'}
          </Txt>
          <Txt color="rgba(255,255,255,0.8)">Free CRM — Housing, 99acres, Facebook की सारी leads एक app में, WhatsApp automation के साथ।</Txt>
        </Animated.View>
      </LinearGradient>
      <View style={{ padding: 16, gap: 14 }}>
        <Row gap={14}>
          <PressableScale onPress={logo}>
            <Avatar name={f.firmName || 'Firm'} uri={f.logoUrl || null} size={72} />
            <View style={{ position: 'absolute', right: -2, bottom: -2, backgroundColor: c.brand, borderRadius: 12, padding: 5 }}>
              <Camera size={14} color="#fff" />
            </View>
          </PressableScale>
          <Txt v="small" color="muted" style={{ flex: 1 }}>
            Logo (optional) — microsite और WhatsApp पर दिखेगा
          </Txt>
        </Row>
        <Input label="Firm / agency name *" value={f.firmName} onChangeText={(v) => setF({ ...f, firmName: v })} />
        <Row>
          <Input
            label="Business phone *"
            value={f.phone}
            onChangeText={(v) => setF({ ...f, phone: v })}
            keyboardType="phone-pad"
            containerStyle={{ flex: 1 }}
          />
          <Input label="WhatsApp" value={f.whatsapp} onChangeText={(v) => setF({ ...f, whatsapp: v })} keyboardType="phone-pad" containerStyle={{ flex: 1 }} />
        </Row>
        <Row>
          <Input label="HRERA agent no." value={f.reraNumber} onChangeText={(v) => setF({ ...f, reraNumber: v })} containerStyle={{ flex: 1 }} />
          <Input
            label="Experience (yrs)"
            value={f.experienceYears}
            onChangeText={(v) => setF({ ...f, experienceYears: v.replace(/\D/g, '') })}
            keyboardType="numeric"
            containerStyle={{ flex: 1 }}
          />
        </Row>
        <Input label="Office address" value={f.address} onChangeText={(v) => setF({ ...f, address: v })} />
        <Input
          label="About your firm"
          value={f.about}
          onChangeText={(v) => setF({ ...f, about: v })}
          multiline
          placeholder="जैसे: Golf Course Road luxury resale specialist"
        />
        <Txt v="label" color="subtle">
          Expertise localities ({f.localityIds.length})
        </Txt>
        <Input value={q} onChangeText={setQ} placeholder="Sector खोजें…" />
        <Row wrap>
          {(locs.data ?? [])
            .filter((l) => f.localityIds.includes(l.id) || !q || l.name.toLowerCase().includes(q.toLowerCase()))
            .slice(0, 40)
            .map((l) => (
              <Chip key={l.id} label={l.name} active={f.localityIds.includes(l.id)} onPress={() => toggle(l.id)} />
            ))}
        </Row>
        <Button
          title="Start using BrokerIQ"
          size="lg"
          icon={<Rocket size={18} color="#fff" />}
          loading={busy}
          disabled={!f.firmName || f.phone.length < 10}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}
