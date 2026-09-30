import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react-native';
import { api, patch, post } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Header, Input, Loader, Row, Screen, Txt } from '@/ui';

/** "Verified tenant" via office email OTP — brokers see a badge and prioritise the enquiry. */
export default function VerifyTenant() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['tenant-profile'], queryFn: () => api<any>('/me/tenant-profile') });
  const [f, setF] = useState({ occupation: '', employer: '', email: '', code: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.data) setF((x) => ({ ...x, occupation: q.data.occupation ?? '', employer: q.data.employer ?? '', email: x.email || q.data.workEmail || '' }));
  }, [q.data]);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      q.refetch();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  if (q.isLoading) return <Loader />;
  const d = q.data;
  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title="Verified tenant"
        right={d?.tenantVerifiedAt ? <Badge label="Verified" color={c.success} icon={<BadgeCheck size={11} color={c.success} />} /> : undefined}
      />
      <Txt v="small" color="muted">
        Verified tenants की enquiries brokers को badge के साथ दिखती हैं और जल्दी जवाब मिलता है।
      </Txt>
      <Card style={{ padding: 14, gap: 10, marginTop: 12 }}>
        <Input label="Occupation" value={f.occupation} onChangeText={(v) => setF({ ...f, occupation: v })} />
        <Input label="Company" value={f.employer} onChangeText={(v) => setF({ ...f, employer: v })} />
        <Button
          title="Save"
          size="sm"
          variant="secondary"
          loading={busy}
          onPress={() => run(() => patch('/me/tenant-profile', { occupation: f.occupation || null, employer: f.employer || null }), 'Saved')}
        />
      </Card>
      {d?.workEmailVerifiedAt ? (
        <Txt v="small" color="success" style={{ marginTop: 12 }}>{`Office email verified: ${d.workEmail}`}</Txt>
      ) : (
        <Card style={{ padding: 14, gap: 10, marginTop: 12 }}>
          <Input
            label="Office email"
            value={f.email}
            onChangeText={(v) => setF({ ...f, email: v.trim() })}
            keyboardType="email-address"
            autoCapitalize="none"
            hint="Gmail / Yahoo नहीं — company का email"
          />
          <Button
            title="Code भेजें"
            loading={busy}
            disabled={!f.email}
            onPress={() =>
              run(async () => {
                await post('/me/work-email', { email: f.email });
                setSent(true);
              }, 'Code भेजा गया')
            }
          />
          {sent && (
            <Row>
              <Input
                containerStyle={{ flex: 1 }}
                label="6-digit code"
                value={f.code}
                onChangeText={(v) => setF({ ...f, code: v.replace(/\D/g, '').slice(0, 6) })}
                keyboardType="number-pad"
              />
              <Button
                title="Verify"
                loading={busy}
                disabled={f.code.length !== 6}
                onPress={() => run(() => post('/me/work-email/verify', { code: f.code }), 'Verified ✓')}
                style={{ alignSelf: 'flex-end' }}
              />
            </Row>
          )}
        </Card>
      )}
    </Screen>
  );
}
