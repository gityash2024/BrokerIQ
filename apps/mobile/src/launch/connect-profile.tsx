import { lazy, Suspense, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, captureAccountContext, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { connectSurveyFieldsSchema, connectSurveyFieldTypes, formatConnectSurveyValue, hasDelegatedAccess,
  type ConnectActionDraft, type ConnectSurveyField, type ConnectSurveySuggestion } from '@brokeriq/shared';
import { toast } from '@/lib/toast';
import { Button, Chip, Input, Row, Sheet, Txt } from '@/ui';
import { NativeCard } from './screen';

const ConnectRecordingPlayer = lazy(() => import('./connect-recording-player'));

const firmOptions = { leads: 'Create leads and requirements', inventory: 'Create private property drafts', survey: 'Fill empty Survey fields' };
type AutomationRule = keyof typeof firmOptions;
type FirmPolicy = Record<AutomationRule, boolean> & { retentionDays?: number | null; surveyFields?: ConnectSurveyField[] };
type Profile = { policy?: FirmPolicy; downloadUrl: string | null; latestVersion: number; enabled: boolean;
  devices: { id: string; label: string; version: number; consentAt: string | null; lastSeenAt: string }[] };
type Event = { id: string; kind: string; status: string; capturedAt: string; recording: boolean; lastError?: string };
const surveyLabels: Record<string, string> = { bhk: 'BHK', floor: 'Floor', purpose: 'Purpose' };
type EventDetail = Event & { details: { proposal?: { summary?: string; nextSteps?: string[]; evidence?: string; recommendedAction?: ConnectActionDraft };
  survey?: ConnectSurveySuggestion[];
  transcript?: { segments: { start: number; text: string }[] } } | null };

export function NativeConnectProfile() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [surveyField, setSurveyField] = useState<ConnectSurveyField>({ label: '', type: 'TEXT', required: false });
  const data = useQuery({ queryKey: ['connect-profile', user?.organization?.id, user?.id], queryFn: () => api<Profile>('/connect/profile'), enabled: !!user && open });
  const surveyFields = data.data?.policy?.surveyFields ?? [];
  function revoke(id: string) {
    const ownerContext = captureAccountContext();
    Alert.alert('Revoke this device?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Revoke', style: 'destructive', onPress: async () => {
      try { await api('/connect/devices/' + id, { method: 'DELETE', ownerContext }); await data.refetch(); }
      catch (error) { toast.error(errorMessage(error)); }
    } }]);
  }
  async function updatePolicy(change: Partial<FirmPolicy>, ownerContext = captureAccountContext()) {
    const policy = data.data?.policy;
    if (!policy || policyBusy) return;
    setPolicyBusy(true);
    try {
      await api('/connect/firm-policy', { method: 'PATCH', ownerContext, body: change });
      await data.refetch();
      return true;
    } catch (error) { toast.error(errorMessage(error)); return false; }
    finally { setPolicyBusy(false); }
  }
  async function addSurveyField() {
    const fields = connectSurveyFieldsSchema.safeParse([...surveyFields, surveyField]);
    if (!fields.success) { toast.error(fields.error.issues[0].message); return; }
    if (await updatePolicy({ surveyFields: fields.data })) setSurveyField({ label: '', type: 'TEXT', required: false });
  }
  async function download() {
    try {
      const result = await data.refetch({ throwOnError: true });
      if (!result.data?.downloadUrl) throw new Error('Download is unavailable for this environment.');
      await Linking.openURL(result.data.downloadUrl);
    } catch (error) { toast.error(errorMessage(error)); }
  }
  if (!user) return null;
  return <>
    <Button title="BrokerIQ Connect" size="sm" variant="secondary" onPress={() => setOpen(true)} />
    <Sheet open={open} onClose={() => setOpen(false)} title="BrokerIQ Connect">
      <Txt>Automate your calls, leads and property inventory.</Txt>
      {data.isPending && <Txt>Loading device status…</Txt>}
      {data.error && <Txt color="danger">{errorMessage(data.error)}</Txt>}
      {data.data && <>
        <Txt>{data.data.enabled ? (data.data.devices.length ? 'Connected' : 'Not connected') : 'Device linking is paused'}</Txt>
        {data.data.downloadUrl ? <Button title="Download BrokerIQ Connect" disabled={data.isFetching} onPress={() => void download()} /> :
          <Txt v="caption">Download is unavailable for this environment.</Txt>}
        {data.data.devices.map((device) => <NativeCard key={device.id}>
          <Txt v="bodyStrong">{device.label}</Txt>
          <Txt>{device.consentAt ? 'Authorized' : 'Permissions required'}{device.version < data.data!.latestVersion ? ' · Update available' : ''}</Txt>
          <Button title="Revoke" size="sm" variant="secondary" onPress={() => revoke(device.id)} />
        </NativeCard>)}
        {data.data.policy && <NativeCard>
          <Txt v="bodyStrong">Firm automation rules</Txt>
          {(Object.keys(firmOptions) as AutomationRule[]).map((key) => <Button key={key} variant="secondary" size="sm" disabled={policyBusy}
            title={firmOptions[key] + (data.data!.policy![key] ? ' · Enabled' : ' · Review only')} onPress={() => void updatePolicy({ [key]: !data.data!.policy![key] })} />)}
          <Txt>Keep captures {data.data.policy.retentionDays ? 'for ' + data.data.policy.retentionDays + ' days' : 'until manually deleted'}</Txt>
          <Row wrap gap={6}>
            {[30, 90, 180, 365, null].map((days) => <Button key={days ?? 'manual'} size="sm" variant="secondary"
              title={days ? days + ' days' : 'Manual deletion'} disabled={policyBusy || (data.data!.policy!.retentionDays ?? null) === days}
              onPress={() => {
                const context = captureAccountContext();
                if (!days) { void updatePolicy({ retentionDays: null }, context); return; }
                Alert.alert('Save capture retention?', 'Older captures, recordings and transcripts will be deleted automatically.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Save policy', onPress: () => void updatePolicy({ retentionDays: days }, context) },
                ]);
              }} />)}
          </Row>
          <Txt v="bodyStrong">Custom Survey fields</Txt>
          {surveyFields.map((field, index) => <Row wrap gap={6} key={field.label}>
            <Txt>{field.label} · {connectSurveyFieldTypes[field.type]}{field.required ? ' · Required' : ''}</Txt>
            <Button title="Remove" accessibilityLabel={'Remove ' + field.label} size="sm" variant="ghost" disabled={policyBusy}
              onPress={() => void updatePolicy({ surveyFields: surveyFields.filter((_, i) => i !== index) })} />
          </Row>)}
          {surveyFields.length < 12 && <>
            <Input label="Survey field name" maxLength={48} value={surveyField.label}
              onChangeText={(label) => setSurveyField({ ...surveyField, label })} />
            <Row wrap gap={6}>
              {Object.entries(connectSurveyFieldTypes).map(([type, label]) => <Chip key={type} label={label} active={surveyField.type === type}
                onPress={() => setSurveyField({ ...surveyField, type: type as ConnectSurveyField['type'] })} />)}
              <Chip label="Required" active={surveyField.required} onPress={() => setSurveyField({ ...surveyField, required: !surveyField.required })} />
            </Row>
            <Button title="Add field" size="sm" variant="secondary" disabled={policyBusy || surveyField.label.trim().length < 2} onPress={() => void addSurveyField()} />
          </>}
        </NativeCard>}
        <NativeConnectLeadActivity enabled={data.data.enabled && ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role) && hasDelegatedAccess(user, 'automation', 'view')} />
      </>}
    </Sheet>
  </>;
}

export function NativeConnectLeadActivity({ leadId, enabled, draftAction }: { leadId?: string; enabled: boolean; draftAction?: (action: ConnectActionDraft) => void }) {
  const { user } = useAuth();
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canReview = hasDelegatedAccess(user, 'automation', 'view', 'edit');
  const canDelete = ['BROKER_ADMIN', 'SUB_BROKER_ADMIN'].includes(user?.role ?? '') &&
    hasDelegatedAccess(user, 'automation', 'view', 'delete');
  const events = useQuery({ queryKey: ['connect-events', user?.id, user?.organization?.id, leadId],
    queryFn: () => api<{ items: Event[] }>('/connect/events' + (leadId ? '?leadId=' + encodeURIComponent(leadId) : '')), enabled });
  const detail = useQuery({ queryKey: ['connect-event', user?.id, user?.organization?.id, id],
    queryFn: () => api<EventDetail>('/connect/events/' + id), enabled: enabled && !!id });
  if (!enabled || (leadId && !events.data?.items.length)) return null;
  async function update(eventId: string, action: 'retry' | 'delete' | 'REVIEWED' | 'DISMISSED', ownerContext = captureAccountContext()) {
    setBusy(true);
    try {
      const path = '/connect/events/' + eventId;
      if (action === 'delete') await api(path, { method: 'DELETE', ownerContext });
      else if (action === 'retry') await api(path + '/retry', { method: 'POST', ownerContext });
      else await api(path + '/review', { method: 'PATCH', ownerContext, body: { decision: action } });
      if (action === 'delete') setId(null);
      else await detail.refetch();
      await events.refetch();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return <NativeCard>
    <Txt v="bodyStrong">{leadId ? 'BrokerIQ Connect' : 'Recent Connect activity'}</Txt>
    {events.error && <Txt color="danger">{errorMessage(events.error)}</Txt>}
    {events.data?.items.length === 0 && <Txt color="muted">No captured activity yet.</Txt>}
    {events.data?.items.map((event) => <Button key={event.id} title={event.kind + ' · ' + event.status} variant="secondary" size="sm"
      onPress={() => setId(event.id)} />)}
    <Sheet open={!!id} title="Connect activity" onClose={() => { if (!busy) setId(null); }} full footer={id && detail.data && <Row wrap gap={8}>
      {canReview && detail.data.status === 'REVIEW' && <>
        <Button title="Mark reviewed" size="sm" disabled={busy} onPress={() => void update(id, 'REVIEWED')} />
        <Button title="Dismiss suggestion" size="sm" variant="secondary" disabled={busy} onPress={() => void update(id, 'DISMISSED')} />
      </>}
      {canReview && detail.data.status === 'FAILED' && <Button title="Retry analysis" variant="secondary" disabled={busy} onPress={() => void update(id, 'retry')} />}
      {canDelete && <Button title="Delete capture" variant="secondary" disabled={busy} onPress={() => {
        const ownerContext = captureAccountContext();
        Alert.alert('Delete this Connect capture?', 'This deletes its recording and transcript.', [
          { text: 'Keep', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void update(id, 'delete', ownerContext) },
        ]);
      }} />}
    </Row>}>
      {detail.error && <Txt color="danger">{errorMessage(detail.error)}</Txt>}
      {detail.data && <>
        <Txt>{detail.data.kind} · {detail.data.status}</Txt>
        {detail.data.lastError && <Txt>{detail.data.lastError}</Txt>}
        {id && detail.data.recording && <Suspense fallback={<Txt>Loading private player…</Txt>}>
          <ConnectRecordingPlayer key={id} eventId={id} />
        </Suspense>}
        {detail.data.details?.proposal?.summary && <Txt>{detail.data.details.proposal.summary}</Txt>}
        {detail.data.details?.proposal?.evidence && <Txt v="caption" color="muted">{detail.data.details.proposal.evidence}</Txt>}
        {detail.data.details?.proposal?.nextSteps?.map((item) => <Txt key={item}>{item}</Txt>)}
        {detail.data.status !== 'DISMISSED' && detail.data.details?.proposal?.recommendedAction && (() => {
          const recommendation = detail.data.details.proposal.recommendedAction;
          return <NativeCard>
            <Txt>{recommendation.note}</Txt>
            <Txt v="caption" color="muted">{recommendation.evidence}</Txt>
            {draftAction && canReview && <Button size="sm" variant="secondary"
              title={recommendation.kind === 'SITE_VISIT' ? 'Review site visit draft' : 'Review follow-up draft'} onPress={() => {
                setId(null);
                draftAction(recommendation);
              }} />}
          </NativeCard>;
        })()}
        {detail.data.details?.survey?.map((field) => <NativeCard key={field.field}>
          <Txt v="bodyStrong">{field.label ?? surveyLabels[field.field] ?? field.field} · {formatConnectSurveyValue(field.previous)} → {field.required && field.proposed == null ? 'Required review' : formatConnectSurveyValue(field.proposed)}</Txt>
          <Txt v="caption" color="muted">{field.applied ? 'Applied' : field.conflict ? 'Conflicts with current value' : 'Needs review'} · {field.confidence}% confidence</Txt>
          {!!field.evidence && <Txt v="small">{field.evidence}</Txt>}
        </NativeCard>)}
        {detail.data.details?.transcript?.segments.map((segment) => <Txt key={segment.start}>{Math.floor(segment.start)}s · {segment.text}</Txt>)}
      </>}
    </Sheet>
  </NativeCard>;
}
