import { useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, CheckCircle2, Copy, ExternalLink, Megaphone, Mail, MessageCircle, RefreshCw, Webhook } from 'lucide-react-native';
import { api, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LEAD_SOURCE_LABELS, type LeadSource } from '@brokeriq/shared';
import { useApiMutation } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Chip, ErrorView, Header, Input, Loader, PressableScale, Row, Screen, SectionTitle, Txt } from '@/ui';

const ICON: Record<string, any> = { whatsapp: MessageCircle, email_inbox: Mail, meta_leads: Megaphone, housing_api: Building2 };

function CopyRow({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={async () => (await Clipboard.setStringAsync(value), toast.success('Copied'))} style={{ padding: 10, borderRadius: 12, backgroundColor: c.surface2, gap: 2 }}>
      <Row style={{ justifyContent: 'space-between' }}><Txt v="caption" color="muted">{label}</Txt><Copy size={14} color={c.brand} /></Row>
      <Txt v="caption" numberOfLines={2} style={{ fontFamily: undefined }}>{value}</Txt>
    </PressableScale>
  );
}

/** Housing needs just two short values, so brokers can connect it right from the app. */
function HousingForm({ configured }: { configured: boolean }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(!configured);
  const [f, setF] = useState({ profileId: '', encryptionKey: '', accountType: 'broker' });
  const save = useApiMutation(() => patch('/broker/connectors/housing_api', { enabled: true, fields: f }), { success: 'Housing connect हो गया — leads आने लगेंगी', invalidate: [['connectors']], onSuccess: () => setOpen(false) });
  const test = useApiMutation(() => post<any>('/broker/connectors/housing_api/test'), { success: (r: any) => r?.message ?? 'Tested', invalidate: [['connectors']] });
  if (!open)
    return (
      <Row>
        {configured && <Button title="Test" size="sm" variant="secondary" loading={test.isPending} onPress={() => test.mutate(undefined)} />}
        <Button title={configured ? 'Key बदलें' : 'Connect करें'} size="sm" variant="ghost" color={c.brand} onPress={() => setOpen(true)} />
      </Row>
    );
  return (
    <View style={{ gap: 10 }}>
      <Input label="Profile ID" value={f.profileId} onChangeText={(v) => setF({ ...f, profileId: v.trim() })} autoCapitalize="none" keyboardType="number-pad" />
      <Input label="Encryption Key" value={f.encryptionKey} onChangeText={(v) => setF({ ...f, encryptionKey: v.trim() })} autoCapitalize="none" secureTextEntry hint="Housing से मिली key — किसी से share न करें" />
      <Row>
        <Chip label="Broker" active={f.accountType === 'broker'} onPress={() => setF({ ...f, accountType: 'broker' })} />
        <Chip label="Builder" active={f.accountType === 'builder'} onPress={() => setF({ ...f, accountType: 'builder' })} />
      </Row>
      <Button title="Save & connect" size="sm" loading={save.isPending} disabled={!f.profileId || !f.encryptionKey} onPress={() => save.mutate(undefined)} />
    </View>
  );
}

/** Status + setup guide. Credentials are entered on the web CRM (long keys are easier on desktop). */
export default function Connectors() {
  const { c } = useTheme();
  const { user } = useAuth();
  const admin = user?.role === 'BROKER_ADMIN';
  const q = useQuery({ queryKey: ['connectors'], queryFn: () => api<any>('/broker/connectors') });
  const sync = useApiMutation(() => post<any>('/broker/connectors/email_inbox/sync'), { success: (r: any) => `${r?.imported ?? 0} नई leads`, invalidate: [['connectors']] });
  const syncHousing = useApiMutation(() => post<any>('/broker/connectors/housing_api/sync'), { success: (r: any) => `${r?.imported ?? 0} नई leads`, invalidate: [['connectors']] });
  if (q.isLoading) return <Loader />;
  if (q.isError) return <Screen><Header title="Lead connectors" /><ErrorView error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const d = q.data;
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Lead connectors" subtitle="सारी portal leads एक जगह" />
      <Card style={{ padding: 14, backgroundColor: c.brandSoft, borderColor: c.brand }}>
        <Txt v="small">Credentials (app passwords, API tokens) web CRM पर भरें — हर connector के साथ हिंदी में step-by-step guide है: <Txt v="small" color="brand">website → Broker → Lead connectors</Txt></Txt>
      </Card>
      {d.portalStats?.length > 0 && (
        <Row gap={10} style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {d.portalStats.slice(0, 6).map((p: any) => (
            <Card key={p.source} style={{ padding: 12, minWidth: 100, flexGrow: 1 }}>
              <Txt v="caption" color="muted" numberOfLines={1}>{LEAD_SOURCE_LABELS[p.source as LeadSource] ?? p.source}</Txt>
              <Txt v="h3">{p.week}</Txt>
              <Txt v="caption" color="muted">7 दिन · आज {p.today}</Txt>
            </Card>
          ))}
        </Row>
      )}
      {d.connectors.map((cn: any) => {
        const Icon = ICON[cn.key] ?? Webhook;
        const on = cn.config?.configured;
        return (
          <Card key={cn.key} style={{ padding: 14, gap: 10, marginTop: 12 }}>
            <Row gap={12}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: on ? `${c.success}1f` : c.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={on ? c.success : c.muted} /></View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">{cn.name}</Txt>
                <Txt v="caption" color="muted" numberOfLines={2}>{cn.description}</Txt>
              </View>
              {on ? <Badge label="Connected" color={c.success} icon={<CheckCircle2 size={11} color={c.success} />} /> : <Badge label="Not set" color={c.warning} />}
            </Row>
            {cn.state && <Txt v="caption" color="muted">{cn.state.leadsImported} leads imported{cn.state.lastSyncAt ? ` · last sync ${new Date(cn.state.lastSyncAt).toLocaleString('en-IN')}` : ''}</Txt>}
            {cn.state?.lastError && <Row><AlertTriangle size={14} color={c.danger} /><Txt v="caption" color="danger" style={{ flex: 1 }}>{cn.state.lastError}</Txt></Row>}
            {cn.extra?.webhookUrl && <CopyRow label="Callback URL" value={cn.extra.webhookUrl} />}
            {cn.extra?.verifyToken && <CopyRow label="Verify token" value={cn.extra.verifyToken} />}
            {cn.key === 'email_inbox' && on && <Button title="अभी inbox check करें" size="sm" variant="secondary" icon={<RefreshCw size={15} color={c.fg} />} loading={sync.isPending} onPress={() => sync.mutate(undefined)} />}
            {cn.key === 'housing_api' && on && <Button title="अभी Housing sync करें" size="sm" variant="secondary" icon={<RefreshCw size={15} color={c.fg} />} loading={syncHousing.isPending} onPress={() => syncHousing.mutate(undefined)} />}
            {cn.key === 'housing_api' && admin && <HousingForm configured={!!on} />}
            {!on && <Button title="Setup guide" size="sm" variant="ghost" icon={<ExternalLink size={15} color={c.brand} />} color={c.brand} onPress={() => Linking.openURL(cn.docsUrl)} />}
          </Card>
        );
      })}
      {d.webhook?.url && (
        <>
          <SectionTitle title="Universal webhook" subtitle="Website forms, Zapier, Google Ads lead forms" />
          <Card style={{ padding: 14, gap: 8 }}>
            <CopyRow label="Webhook URL (POST)" value={d.webhook.url} />
            <Txt v="caption" color="muted">Fields: name, phone, email, source, property, message</Txt>
          </Card>
        </>
      )}
    </Screen>
  );
}
