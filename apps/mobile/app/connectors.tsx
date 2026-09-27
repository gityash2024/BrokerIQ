import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, Megaphone, Mail, MessageCircle, RefreshCw, Webhook } from 'lucide-react-native';
import { api, post } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, ErrorView, Header, Loader, PressableScale, Row, Screen, SectionTitle, Txt } from '@/ui';

const ICON: Record<string, any> = { whatsapp: MessageCircle, email_inbox: Mail, meta_leads: Megaphone };

function CopyRow({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={async () => (await Clipboard.setStringAsync(value), toast.success('Copied'))} style={{ padding: 10, borderRadius: 12, backgroundColor: c.surface2, gap: 2 }}>
      <Row style={{ justifyContent: 'space-between' }}><Txt v="caption" color="muted">{label}</Txt><Copy size={14} color={c.brand} /></Row>
      <Txt v="caption" numberOfLines={2} style={{ fontFamily: undefined }}>{value}</Txt>
    </PressableScale>
  );
}

/** Status + setup guide. Credentials are entered on the web CRM (long keys are easier on desktop). */
export default function Connectors() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['connectors'], queryFn: () => api<any>('/broker/connectors') });
  const sync = useApiMutation(() => post<any>('/broker/connectors/email_inbox/sync'), { success: (r: any) => `${r?.imported ?? 0} नई leads`, invalidate: [['connectors']] });
  if (q.isLoading) return <Loader />;
  if (q.isError) return <Screen><Header title="Lead connectors" /><ErrorView error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const d = q.data;
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Lead connectors" subtitle="सारी portal leads एक जगह" />
      <Card style={{ padding: 14, backgroundColor: c.brandSoft, borderColor: c.brand }}>
        <Txt v="small">Credentials (app passwords, API tokens) web CRM पर भरें — हर connector के साथ हिंदी में step-by-step guide है: <Txt v="small" color="brand">website → Broker → Lead connectors</Txt></Txt>
      </Card>
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
