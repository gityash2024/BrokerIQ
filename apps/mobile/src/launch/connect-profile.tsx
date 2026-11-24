import { lazy, Suspense, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, captureAccountContext, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { hasDelegatedAccess } from '@brokeriq/shared';
import { toast } from '@/lib/toast';
import { Button, Row, Sheet, Txt } from '@/ui';
import { NativeCard } from './screen';

const ConnectRecordingPlayer = lazy(() => import('./connect-recording-player'));

type Profile = { downloadUrl: string | null; latestVersion: number; enabled: boolean;
  devices: { id: string; label: string; version: number; consentAt: string | null; lastSeenAt: string }[] };
type Event = { id: string; kind: string; status: string; capturedAt: string; recording: boolean; lastError?: string };
type SurveySuggestion = { field: 'bhk' | 'floor' | 'purpose'; proposed: string | number; previous: string | number | null; conflict: boolean;
  applied: boolean; confidence: number; evidence: string };
const surveyLabels = { bhk: 'BHK', floor: 'Floor', purpose: 'Purpose' };
type EventDetail = Event & { details: { proposal?: { summary?: string; nextSteps?: string[]; evidence?: string };
  survey?: SurveySuggestion[];
  transcript?: { segments: { start: number; text: string }[] } } | null };

export function NativeConnectProfile() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const data = useQuery({ queryKey: ['connect-profile', user?.organization?.id, user?.id], queryFn: () => api<Profile>('/connect/profile'), enabled: !!user && open });
  function revoke(id: string) {
    const ownerContext = captureAccountContext();
    Alert.alert('Revoke this device?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Revoke', style: 'destructive', onPress: async () => {
      try { await api('/connect/devices/' + id, { method: 'DELETE', ownerContext }); await data.refetch(); }
      catch (error) { toast.error(errorMessage(error)); }
    } }]);
  }
  if (!user) return null;
  return <>
    <Button title="BrokerIQ Connect" size="sm" variant="secondary" onPress={() => setOpen(true)} />
    <Sheet open={open} onClose={() => setOpen(false)} title="BrokerIQ Connect">
      <Txt>Automate your calls, leads and property inventory.</Txt>
      {data.isPending && <Txt>Loading device status…</Txt>}
      {data.error && <Txt color="danger">{errorMessage(data.error)}</Txt>}
      {data.data && <>
        <Txt>{data.data.devices.length ? 'Connected' : 'Not connected'}</Txt>
        {data.data.downloadUrl && <Button title="Download BrokerIQ Connect" onPress={() => void Linking.openURL(data.data!.downloadUrl!).catch(() => toast.error('Download link unavailable'))} />}
        {data.data.devices.map((device) => <NativeCard key={device.id}>
          <Txt v="bodyStrong">{device.label}</Txt>
          <Txt>{device.consentAt ? 'Authorized' : 'Permissions required'}{device.version < data.data!.latestVersion ? ' · Update available' : ''}</Txt>
          <Button title="Revoke" size="sm" variant="secondary" onPress={() => revoke(device.id)} />
        </NativeCard>)}
        <NativeConnectLeadActivity enabled={data.data.enabled && ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role) && hasDelegatedAccess(user, 'automation', 'view')} />
      </>}
    </Sheet>
  </>;
}

export function NativeConnectLeadActivity({ leadId, enabled }: { leadId?: string; enabled: boolean }) {
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
  async function update(eventId: string, remove: boolean, ownerContext = captureAccountContext()) {
    setBusy(true);
    try {
      await api('/connect/events/' + eventId + (remove ? '' : '/retry'), { method: remove ? 'DELETE' : 'POST', ownerContext });
      if (remove) setId(null);
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
      {canReview && detail.data.status === 'FAILED' && <Button title="Retry analysis" variant="secondary" disabled={busy} onPress={() => void update(id, false)} />}
      {canDelete && <Button title="Delete capture" variant="secondary" disabled={busy} onPress={() => {
        const ownerContext = captureAccountContext();
        Alert.alert('Delete this Connect capture?', 'This deletes its recording and transcript.', [
          { text: 'Keep', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void update(id, true, ownerContext) },
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
        {detail.data.details?.survey?.map((field) => <NativeCard key={field.field}>
          <Txt v="bodyStrong">{surveyLabels[field.field]} · {field.previous ?? 'Empty'} → {field.proposed}</Txt>
          <Txt v="caption" color="muted">{field.applied ? 'Applied' : field.conflict ? 'Conflicts with current value' : 'Needs review'} · {field.confidence}% confidence</Txt>
          {!!field.evidence && <Txt v="small">{field.evidence}</Txt>}
        </NativeCard>)}
        {detail.data.details?.transcript?.segments.map((segment) => <Txt key={segment.start}>{Math.floor(segment.start)}s · {segment.text}</Txt>)}
      </>}
    </Sheet>
  </NativeCard>;
}
