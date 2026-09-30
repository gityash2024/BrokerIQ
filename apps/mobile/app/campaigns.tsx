import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ban, Megaphone, Plus, Send } from 'lucide-react-native';
import { LEAD_STAGES, LEAD_STAGE_LABELS, timeAgo, type LeadStage } from '@brokeriq/shared';
import { api, del, post } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { tr } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Chip, Empty, ErrorView, Header, Input, Loader, Row, Screen, Segmented, Sheet, Txt } from '@/ui';

const TONE: Record<string, string> = { DRAFT: '#64748B', RUNNING: '#F59E0B', DONE: '#10B981', CANCELLED: '#94A3B8' };
const CHANNEL: Record<string, string> = { WHATSAPP: 'WhatsApp', EMAIL: 'Email', BOTH: 'WhatsApp + Email' };

/** WhatsApp / email broadcasts to the firm's own leads (from the firm's own WhatsApp number). */
export default function Campaigns() {
  const { c } = useTheme();
  const [create, setCreate] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api<any[]>('/broker/campaigns'),
    refetchInterval: (q) => ((q.state.data as any[] | undefined)?.some((x) => x.status === 'RUNNING') ? 5000 : false),
  });
  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title="Campaigns"
        subtitle="चुने हुए leads को एक साथ WhatsApp template या email"
        right={<Button title="नया" size="sm" icon={<Plus size={15} color="#fff" />} onPress={() => setCreate(true)} />}
      />
      {list.isError ? (
        <ErrorView error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data ? (
        <Loader />
      ) : !list.data.length ? (
        <Empty
          icon={<Megaphone size={26} color={c.brand} />}
          title="अभी कोई campaign नहीं"
          text="नई listing या offer — सही leads को एक tap में भेजें। STOP लिखने वाले leads अपने-आप हट जाते हैं।"
          action={<Button title="पहला campaign बनाएँ" onPress={() => setCreate(true)} />}
        />
      ) : (
        list.data.map((x) => (
          <Card key={x.id} style={{ padding: 14, gap: 4, marginTop: 10 }} onPress={() => setOpen(x.id)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="bodyStrong" style={{ flex: 1 }}>
                {x.name}
              </Txt>
              <Badge label={x.status} color={TONE[x.status]} />
            </Row>
            <Txt
              v="caption"
              color="muted"
            >{`${CHANNEL[x.channel]} · ${timeAgo(x.createdAt)}${x.status !== 'DRAFT' ? ` · ${x.sent}/${x.total} भेजे` : ''}`}</Txt>
          </Card>
        ))
      )}
      <CreateSheet open={create} onClose={() => setCreate(false)} onCreated={(id) => (setCreate(false), setOpen(id))} />
      <DetailSheet id={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

function CreateSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ name: '', channel: 'WHATSAPP', template: '', emailSubject: '', emailBody: '' });
  const [stages, setStages] = useState<LeadStage[]>(['NEW', 'CONTACTED', 'INTERESTED']);
  const preview = useQuery({
    queryKey: ['campaign-preview', stages],
    queryFn: () => post<any>('/broker/campaigns/preview', { segment: { stages } }),
    enabled: open,
  });
  const templates = useQuery({ queryKey: ['wa-templates'], queryFn: () => api<any[]>('/whatsapp/templates'), enabled: open && f.channel !== 'EMAIL' });
  const approved = (templates.data ?? []).filter((t) => !t.status || t.status === 'APPROVED');
  const save = useApiMutation(
    () => {
      const [templateName, templateLanguage] = f.template.split('|');
      return post<any>('/broker/campaigns', {
        name: f.name,
        channel: f.channel,
        segment: { stages },
        templateName: f.channel === 'EMAIL' ? null : templateName || null,
        templateLanguage: f.channel === 'EMAIL' ? null : templateLanguage || null,
        params: ['{name}'],
        emailSubject: f.emailSubject,
        emailBody: f.emailBody,
      });
    },
    { success: 'Draft बन गया', invalidate: [['campaigns']], onSuccess: (r) => onCreated(r.id) },
  );
  return (
    <Sheet open={open} onClose={onClose} title="नया campaign" full>
      <View style={{ gap: 12 }}>
        <Input label="नाम" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder="जैसे: Sector 65 नई listings" />
        <Segmented
          value={f.channel}
          onChange={(v) => setF({ ...f, channel: v })}
          options={[
            { value: 'WHATSAPP', label: 'WhatsApp' },
            { value: 'EMAIL', label: 'Email' },
            { value: 'BOTH', label: 'दोनों' },
          ]}
        />
        <Txt v="caption" color="muted">
          किन leads को (stage)
        </Txt>
        <Row wrap>
          {LEAD_STAGES.map((s) => (
            <Chip
              key={s}
              label={LEAD_STAGE_LABELS[s]}
              active={stages.includes(s)}
              onPress={() => setStages(stages.includes(s) ? stages.filter((x) => x !== s) : [...stages, s])}
            />
          ))}
        </Row>
        <Txt v="small">{preview.data ? `${preview.data.total} leads${f.channel !== 'WHATSAPP' ? ` · ${preview.data.withEmail} के पास email` : ''}` : '…'}</Txt>
        {f.channel !== 'EMAIL' &&
          (preview.data && !preview.data.whatsappConnected ? (
            <Txt v="small" color="warning" onPress={() => router.push('/connectors')}>
              पहले Connectors में अपना WhatsApp Business number जोड़ें →
            </Txt>
          ) : (
            <>
              <Txt v="caption" color="muted">
                Approved WhatsApp template ({'{{1}}'} = lead का नाम)
              </Txt>
              <Row wrap>
                {approved.map((t) => (
                  <Chip
                    key={`${t.name}|${t.language}`}
                    label={`${t.name} (${t.language})`}
                    active={f.template === `${t.name}|${t.language}`}
                    onPress={() => setF({ ...f, template: `${t.name}|${t.language}` })}
                  />
                ))}
              </Row>
              {templates.data && !approved.length && (
                <Txt v="caption" color="muted">
                  कोई approved template नहीं — website पर Inbox → Templates में Sync करें।
                </Txt>
              )}
            </>
          ))}
        {f.channel !== 'WHATSAPP' && (
          <>
            <Input label="Email subject" value={f.emailSubject} onChangeText={(v) => setF({ ...f, emailSubject: v })} />
            <Input
              label="Email message ({name} = नाम)"
              value={f.emailBody}
              onChangeText={(v) => setF({ ...f, emailBody: v })}
              multiline
              style={{ minHeight: 110 }}
            />
          </>
        )}
        <Button title="Draft save करें" full loading={save.isPending} disabled={f.name.trim().length < 2} onPress={() => save.mutate(undefined)} />
      </View>
    </Sheet>
  );
}

function DetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api<any>(`/broker/campaigns/${id}`),
    enabled: !!id,
    refetchInterval: (x) => ((x.state.data as any)?.status === 'RUNNING' ? 4000 : false),
  });
  const start = useApiMutation(() => post(`/broker/campaigns/${id}/start`), { success: 'Campaign शुरू', invalidate: [['campaigns'], ['campaign', id]] });
  const cancel = useApiMutation(() => post(`/broker/campaigns/${id}/cancel`), { success: 'रोक दिया', invalidate: [['campaigns'], ['campaign', id]] });
  const remove = useApiMutation(() => del(`/broker/campaigns/${id}`), { success: 'Draft हटाया', invalidate: [['campaigns']], onSuccess: onClose });
  const x = q.data;
  return (
    <Sheet open={!!id} onClose={onClose} title={x?.name ?? 'Campaign'} full>
      {!x ? (
        <Loader />
      ) : (
        <View style={{ gap: 12 }}>
          <Row>
            <Badge label={x.status} color={TONE[x.status]} />
            <Txt v="caption" color="muted">
              {CHANNEL[x.channel]}
            </Txt>
          </Row>
          {x.status === 'DRAFT' ? (
            <>
              <Button
                title="अभी भेजें"
                full
                icon={<Send size={16} color="#fff" />}
                loading={start.isPending}
                onPress={() =>
                  Alert.alert(tr('अभी भेजें?'), tr('भेजने के बाद रोक सकते हैं, वापस नहीं ले सकते।'), [
                    { text: tr('Cancel'), style: 'cancel' },
                    { text: tr('भेजें'), onPress: () => start.mutate(undefined) },
                  ])
                }
              />
              <Button title="Draft हटाएँ" variant="ghost" full loading={remove.isPending} onPress={() => remove.mutate(undefined)} />
            </>
          ) : (
            <>
              <Txt v="h3">{`${x.sent} / ${x.total} भेजे`}</Txt>
              <Txt v="small" color="muted">{`${x.failed} failed · ${x.skipped} skipped`}</Txt>
              {x.status === 'RUNNING' && (
                <Button
                  title="बाकी रोकें"
                  variant="danger"
                  icon={<Ban size={16} color="#fff" />}
                  loading={cancel.isPending}
                  onPress={() => cancel.mutate(undefined)}
                />
              )}
              {x.recipients.items.slice(0, 50).map((r: any) => (
                <Row key={r.id} style={{ justifyContent: 'space-between' }}>
                  <Txt v="small" style={{ flex: 1 }}>
                    {r.name}
                  </Txt>
                  <Badge label={r.status} color={r.status === 'SENT' ? '#10B981' : r.status === 'FAILED' ? '#EF4444' : '#94A3B8'} />
                </Row>
              ))}
            </>
          )}
        </View>
      )}
    </Sheet>
  );
}
