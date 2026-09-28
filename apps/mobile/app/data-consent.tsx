import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Contact, Lock, MapPin, ShieldCheck } from 'lucide-react-native';
import { DATA_CONSENT_TEXT as T } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';
import { showError } from '@/lib/hooks';
import { markAsked, setConsent } from '@/lib/privacy';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { Button, Card, PressableScale, Row, Txt } from '@/ui';

/** One-time disclosure + opt-in. Nothing is pre-selected; declining keeps the full app. */
export default function DataConsent() {
  const { c } = useTheme();
  const { app } = useConfig();
  const qc = useQueryClient();
  const [loc, setLoc] = useState(false);
  const [contacts, setContacts] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = async () => {
    await markAsked();
    qc.invalidateQueries({ queryKey: ['privacy'] });
    if (router.canGoBack()) router.back();
  };
  const allow = async () => {
    setBusy(true);
    try {
      const results: string[] = [];
      if (loc && !(await setConsent('LOCATION', true))) results.push('location');
      if (contacts && !(await setConsent('CONTACTS', true))) results.push('contacts');
      if (results.length) toast.info(`Phone settings में ${results.join(' और ')} permission नहीं मिली — Profile → Privacy से बाद में चालू कर सकते हैं`);
      else toast.success('धन्यवाद 🙏 — आप Profile → Privacy से कभी भी बदल सकते हैं');
      await close();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const Option = ({ on, set, icon, title, what, why }: { on: boolean; set: (v: boolean) => void; icon: React.ReactNode; title: string; what: string; why: string }) => (
    <PressableScale onPress={() => set(!on)}>
      <Card style={{ padding: 14, gap: 6, borderWidth: 2, borderColor: on ? c.brand : c.line }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={10} style={{ flex: 1 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
            <Txt v="bodyStrong" style={{ flex: 1 }}>{title}</Txt>
          </Row>
          <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: on ? c.brand : c.line, backgroundColor: on ? c.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on && <Check size={16} color="#fff" />}</View>
        </Row>
        <Txt v="small" color="muted"><Txt v="small" style={{ fontWeight: '700' }}>क्या: </Txt>{what}</Txt>
        <Txt v="small" color="muted"><Txt v="small" style={{ fontWeight: '700' }}>क्यों: </Txt>{why}</Txt>
      </Card>
    </PressableScale>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={28} color="#fff" />
        </View>
        <Txt v="h1">{T.title}</Txt>
        <Txt color="muted">{T.intro}</Txt>
        <Option on={loc} set={setLoc} icon={<MapPin size={20} color={c.brand} />} title={T.location.title} what={T.location.what} why={T.location.why} />
        <Option on={contacts} set={setContacts} icon={<Contact size={20} color={c.brand} />} title={T.contacts.title} what={T.contacts.what} why={T.contacts.why} />
        <Card style={{ padding: 14, gap: 8, backgroundColor: c.surface2 }}>
          <Row gap={8} style={{ alignItems: 'flex-start' }}>
            <Lock size={16} color={c.success} style={{ marginTop: 2 }} />
            <Txt v="small" style={{ flex: 1 }}>{T.who}</Txt>
          </Row>
          <Row gap={8} style={{ alignItems: 'flex-start' }}>
            <ShieldCheck size={16} color={c.success} style={{ marginTop: 2 }} />
            <Txt v="small" style={{ flex: 1 }}>{T.security}</Txt>
          </Row>
          <Txt v="small" color="muted">{T.optional}</Txt>
        </Card>
        <Txt v="small" color="brand" onPress={() => Linking.openURL(`${app.siteUrl}/p/privacy`)}>Privacy policy पढ़ें →</Txt>
      </ScrollView>
      <View style={{ padding: 16, gap: 10, borderTopWidth: 1, borderColor: c.line }}>
        <Button title={T.allow} disabled={!loc && !contacts} loading={busy} onPress={allow} />
        <Button title={T.notNow} variant="secondary" disabled={busy} onPress={close} />
      </View>
    </SafeAreaView>
  );
}
