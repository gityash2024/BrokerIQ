import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Contact, Lock, MapPin, RefreshCw } from 'lucide-react-native';
import { DATA_CONSENT_TEXT as T, plural, type ConsentKind } from '@brokeriq/shared';
import { showError } from '@/lib/hooks';
import { setConsent, syncContacts, usePrivacyStatus } from '@/lib/privacy';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { Button, Card, Header, Loader, Row, Screen, Txt } from '@/ui';
import { alert } from '@/lib/i18n';

/** Privacy & data sharing: turn location/contacts sharing on or off (off = data deleted). */
export default function PrivacyScreen() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const s = usePrivacyStatus();
  const [busy, setBusy] = useState<ConsentKind | 'sync' | null>(null);
  if (s.isLoading || !s.data) return <Loader />;
  const d = s.data;

  const toggle = (kind: ConsentKind, on: boolean) => {
    const apply = async () => {
      setBusy(kind);
      try {
        const ok = await setConsent(kind, on);
        if (!ok) toast.info('Phone settings में permission दें, फिर दोबारा चालू करें');
        else toast.success(on ? 'चालू हो गया' : 'बंद हो गया — यह data delete कर दिया गया');
        qc.invalidateQueries({ queryKey: ['privacy'] });
      } catch (e) {
        showError(e);
      } finally {
        setBusy(null);
      }
    };
    if (on) return apply();
    alert('Sharing बंद करें?', 'बंद करते ही BrokerIQ के पास मौजूद यह data हमेशा के लिए delete हो जाएगा।', [
      { text: 'रहने दें', style: 'cancel' },
      { text: 'बंद करें', style: 'destructive', onPress: apply },
    ]);
  };

  const Item = ({ kind, icon, title, what, on, extra }: { kind: ConsentKind; icon: React.ReactNode; title: string; what: string; on: boolean; extra?: React.ReactNode }) => (
    <Card style={{ padding: 16, gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10} style={{ flex: 1 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
          <Txt v="bodyStrong" style={{ flex: 1 }}>{title}</Txt>
        </Row>
        <Switch value={on} disabled={busy != null} onValueChange={(v) => toggle(kind, v)} trackColor={{ true: c.brand, false: c.line }} thumbColor="#fff" />
      </Row>
      <Txt v="small" color="muted">{what}</Txt>
      {extra}
    </Card>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Privacy & data sharing" subtitle="आपकी मर्ज़ी — कभी भी बदलें" />
      <View style={{ gap: 12, marginTop: 8 }}>
        <Item kind="LOCATION" icon={<MapPin size={20} color={c.brand} />} title={T.location.title} what={`${T.location.what} ${T.location.why}`} on={!!d.location?.granted} />
        <Item
          kind="CONTACTS"
          icon={<Contact size={20} color={c.brand} />}
          title={T.contacts.title}
          what={`${T.contacts.what} ${T.contacts.why}`}
          on={!!d.contacts?.granted}
          extra={
            d.contacts?.granted ? (
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="caption" color="muted">{plural(d.contactsCount, 'contact')} shared</Txt>
                <Button
                  title="अभी sync करें"
                  size="sm"
                  variant="secondary"
                  icon={<RefreshCw size={14} color={c.fg} />}
                  loading={busy === 'sync'}
                  onPress={async () => {
                    setBusy('sync');
                    try {
                      await syncContacts();
                      qc.invalidateQueries({ queryKey: ['privacy'] });
                      toast.success('Contacts sync हो गए');
                    } catch (e) {
                      showError(e);
                    } finally {
                      setBusy(null);
                    }
                  }}
                />
              </Row>
            ) : null
          }
        />
        <Card style={{ padding: 14, gap: 8, backgroundColor: c.surface2 }}>
          <Row gap={8} style={{ alignItems: 'flex-start' }}>
            <Lock size={16} color={c.success} style={{ marginTop: 2 }} />
            <Txt v="small" style={{ flex: 1 }}>{T.who}</Txt>
          </Row>
          <Txt v="small" color="muted">{T.security}</Txt>
        </Card>
      </View>
    </Screen>
  );
}
