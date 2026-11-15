import { useState } from 'react';
import { router } from 'expo-router';
import { Linking, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FileSignature, Plus } from 'lucide-react-native';
import { formatINR } from '@brokeriq/shared';
import { api, post } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Empty, Header, Input, Loader, Row, Screen, Sheet, Txt } from '@/ui';
import { useFlag } from '@/lib/config';

/** Draft 11-month rent agreement PDF (opens in the browser via a short-lived link). */
export default function AgreementsScreen() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['agreements'], queryFn: () => api<any[]>('/agreements') });
  const [sign, setSign] = useState<any>(null);
  const esignOn = useFlag('agreement_esign');
  const pdf = (id: string) =>
    post<{ url: string }>(`/agreements/${id}/link`)
      .then((r) => Linking.openURL(r.url))
      .catch(showError);
  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title="Rent agreement"
        subtitle="Draft PDF · e-stamp: egrashry.nic.in"
        right={<Button title="नया" size="sm" icon={<Plus size={15} color="#fff" />} onPress={() => router.push('/agreements/new')} />}
      />
      <Txt v="caption" color="muted">
        Standard template है, legal सलाह नहीं। e-stamp paper पर print करके sign करें; police verification: harsamay.gov.in
      </Txt>
      {q.isLoading ? (
        <Loader />
      ) : !q.data?.length ? (
        <Empty
          icon={<FileSignature size={26} color={c.brand} />}
          title="अभी कोई agreement नहीं"
          action={<Button title="Agreement बनाएँ" onPress={() => router.push('/agreements/new')} />}
        />
      ) : (
        q.data.map((a) => (
          <Card key={a.id} style={{ padding: 14, gap: 4, marginTop: 10 }}>
            <Txt v="bodyStrong">{`${a.landlordName} → ${a.tenantName}`}</Txt>
            <Txt v="caption" color="muted" numberOfLines={1}>{`${a.propertyAddress} · ${formatINR(a.rent)}/month`}</Txt>
            {a.signStatus !== 'DRAFT' && (
              <Row wrap gap={6}>
                {(a.signatures ?? []).map((s: any) => (
                  <Badge
                    key={s.party}
                    label={`${s.party === 'LANDLORD' ? 'Landlord' : 'Tenant'} ${s.signedAt ? '✓' : 'pending'}`}
                    color={s.signedAt ? c.success : c.warning}
                  />
                ))}
              </Row>
            )}
            <Row wrap>
              <Button title="PDF खोलें" size="sm" variant="secondary" onPress={() => pdf(a.id)} />
              {esignOn && a.signStatus !== 'SIGNED' && (
                <Button title={a.signStatus === 'SIGNING' ? 'दोबारा भेजें' : 'OTP से sign करवाएँ'} size="sm" onPress={() => setSign(a)} />
              )}
            </Row>
          </Card>
        ))
      )}
      <SignSheet agreement={sign} onClose={() => setSign(null)} onSent={() => q.refetch()} />
    </Screen>
  );
}

/** Both parties get a link (email, or the firm's own WhatsApp when there is no email) to read the agreement and confirm it with an OTP. */
function SignSheet({ agreement, onClose, onSent }: { agreement: any | null; onClose: () => void; onSent: () => void }) {
  const [f, setF] = useState({ landlordEmail: '', tenantEmail: '' });
  const [busy, setBusy] = useState(false);
  const reachable = (email: string, phone?: string | null) => !!email || !!phone;
  // Parties the firm's WhatsApp couldn't reach (24h window): forwarded from the broker's own WhatsApp.
  const [manual, setManual] = useState<{ party: string; name: string; waLink: string }[]>([]);
  const close = () => (setManual([]), onClose());
  const send = async () => {
    setBusy(true);
    try {
      const r = await post<{ manual?: { party: string; name: string; waLink: string }[] }>(`/agreements/${agreement.id}/sign`, f);
      onSent();
      if (r.manual?.length) {
        setManual(r.manual);
        toast.success('Link तैयार — नीचे के button से अपने WhatsApp से भेजें');
        return;
      }
      toast.success('दोनों को sign link भेज दिया');
      close();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={!!agreement} onClose={close} title="OTP से sign करवाएँ">
      {manual.length > 0 && (
        <View style={{ gap: 8, marginBottom: 12 }}>
          <Txt v="small">इन्होंने पिछले 24 घंटे में आपके business WhatsApp पर message नहीं किया, इसलिए link अपने WhatsApp से भेजें:</Txt>
          {manual.map((m) => (
            <Button key={m.party} title={`WhatsApp: ${m.name}`} variant="secondary" onPress={() => Linking.openURL(m.waLink)} />
          ))}
        </View>
      )}
      <Input
        label={`Landlord email${agreement ? ` (${agreement.landlordName})` : ''}${agreement?.landlordPhone ? ' — optional' : ''}`}
        value={f.landlordEmail}
        onChangeText={(v) => setF({ ...f, landlordEmail: v.trim() })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label={`Tenant email${agreement ? ` (${agreement.tenantName})` : ''}${agreement?.tenantPhone ? ' — optional' : ''}`}
        value={f.tenantEmail}
        onChangeText={(v) => setF({ ...f, tenantEmail: v.trim() })}
        keyboardType="email-address"
        autoCapitalize="none"
        containerStyle={{ marginTop: 10 }}
      />
      <Txt v="caption" color="muted" style={{ marginTop: 8 }}>
        Email न हो तो link और OTP आपकी firm के अपने WhatsApp से जाएँगे। Final PDF में confirmation certificate (समय, IP, SHA-256) जुड़ता है। यह stamp duty /
        registration की जगह नहीं लेता।
      </Txt>
      <Button
        title="Link भेजें"
        full
        loading={busy}
        disabled={!agreement || !reachable(f.landlordEmail, agreement.landlordPhone) || !reachable(f.tenantEmail, agreement.tenantPhone)}
        onPress={send}
        style={{ marginTop: 12 }}
      />
    </Sheet>
  );
}
