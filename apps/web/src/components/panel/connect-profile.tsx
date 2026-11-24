'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiBlob, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { hasDelegatedAccess } from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

type Profile = { downloadUrl: string | null; latestVersion: number; enabled: boolean;
  devices: { id: string; label: string; version: number; consentAt: string | null; lastSeenAt: string }[] };
type Event = { id: string; kind: string; status: string; capturedAt: string; recording: boolean; lastError?: string };
type SurveySuggestion = { field: 'bhk' | 'floor' | 'purpose'; proposed: string | number; previous: string | number | null; conflict: boolean;
  applied: boolean; confidence: number; evidence: string };
const surveyLabels = { bhk: 'BHK', floor: 'Floor', purpose: 'Purpose' };
type EventDetail = Event & { details: { proposal?: { summary?: string; nextSteps?: string[]; evidence?: string; confidence?: number };
  survey?: SurveySuggestion[];
  transcript?: { language: string; segments: { start: number; end: number; text: string }[] } } | null };

export function ConnectProfile() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const data = useQuery({ queryKey: ['connect-profile', user?.id, user?.organization?.id], queryFn: () => api<Profile>('/connect/profile'), enabled: !!user && open });
  async function revoke(id: string) {
    if (!window.confirm('Revoke this connected device?')) return;
    try { await api('/connect/devices/' + id, { method: 'DELETE' }); await data.refetch(); }
    catch (error) { toast.error(errorMessage(error)); }
  }
  if (!user) return null;
  return <>
    <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>BrokerIQ Connect</Button>
    <Dialog open={open} onOpenChange={setOpen} title="BrokerIQ Connect" description="Automate your calls, leads and property inventory.">
      {data.isError && <ApiErrorState error={data.error} onRetry={() => data.refetch()} />}
      {data.isPending && <p role="status">Loading device status…</p>}
      {data.data && <div className="space-y-3">
        <p className="text-sm">{data.data.devices.length ? 'Connected' : 'Not connected'}</p>
        {data.data.downloadUrl ? <a className="font-semibold text-brand-700 underline" href={data.data.downloadUrl}>Download BrokerIQ Connect</a> :
          <p className="text-sm text-muted">Download is unavailable for this environment.</p>}
        {data.data.devices.map((device) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-2" key={device.id}>
          <div><p className="font-semibold">{device.label}</p><p className="text-xs text-muted">
            {device.consentAt ? 'Authorized' : 'Permissions required'}{device.version < data.data!.latestVersion ? ' · Update available' : ''}
            {' · Last seen ' + new Date(device.lastSeenAt).toLocaleString('en-IN')}
          </p></div>
          <Button size="sm" variant="secondary" onClick={() => void revoke(device.id)}>Revoke</Button>
        </div>)}
        <ConnectLeadActivity enabled={data.data.enabled && ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role) && hasDelegatedAccess(user, 'automation', 'view')} />
      </div>}
    </Dialog>
  </>;
}

export function ConnectLeadActivity({ leadId, enabled }: { leadId?: string; enabled: boolean }) {
  const { user } = useAuth();
  const [eventId, setEvent] = useState<string | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canReview = hasDelegatedAccess(user, 'automation', 'view', 'edit');
  const canDelete = ['BROKER_ADMIN', 'SUB_BROKER_ADMIN'].includes(user?.role ?? '') &&
    hasDelegatedAccess(user, 'automation', 'view', 'delete');
  const data = useQuery({
    queryKey: ['connect-events', user?.id, user?.organization?.id, leadId],
    queryFn: () => api<{ items: Event[] }>('/connect/events' + (leadId ? '?leadId=' + encodeURIComponent(leadId) : '')),
    enabled,
  });
  const detail = useQuery({ queryKey: ['connect-event', user?.id, user?.organization?.id, eventId],
    queryFn: () => api<EventDetail>('/connect/events/' + eventId), enabled: enabled && !!eventId });
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio); }, [audio]);

  if (!enabled || (leadId && !data.data?.items.length)) return null;
  async function getAudio(id: string) {
    try { setAudio(URL.createObjectURL(await apiBlob('/connect/events/' + id + '/recording'))); }
    catch (error) { toast.error(errorMessage(error)); }
  }
  async function update(id: string, remove: boolean) {
    if (remove && !window.confirm('Delete this Connect capture and its private recording and transcript?')) return;
    setBusy(true);
    try {
      await api('/connect/events/' + id + (remove ? '' : '/retry'), { method: remove ? 'DELETE' : 'POST' });
      if (remove) { setAudio(null); setEvent(null); }
      else await detail.refetch();
      await data.refetch();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return <section className="card space-y-2 p-4">
    <h3 className="font-semibold">{leadId ? 'BrokerIQ Connect' : 'Recent Connect activity'}</h3>
    {data.error && <ApiErrorState error={data.error} onRetry={() => data.refetch()} />}
    {data.data?.items.length === 0 && <p className="text-sm text-muted">No captured activity yet.</p>}
    {data.data?.items.map((entry) => <button key={entry.id} className="block text-left text-sm text-brand-700 underline" onClick={() => { setAudio(null); setEvent(entry.id); }}>
      {entry.kind} · {entry.status} · {new Date(entry.capturedAt).toLocaleString('en-IN')}
    </button>)}
    <Dialog open={!!eventId} onOpenChange={(open) => { if (!open) { setEvent(null); setAudio(null); } }} title="Connect activity" size="lg" footer={detail.data && <>
      {canReview && detail.data.status === 'FAILED' && <Button variant="secondary" disabled={busy} onClick={() => void update(detail.data!.id, false)}>Retry analysis</Button>}
      {canDelete && <Button variant="secondary" disabled={busy} onClick={() => void update(detail.data!.id, true)}>Delete capture</Button>}
    </>}>
      {detail.error && <ApiErrorState error={detail.error} onRetry={() => detail.refetch()} />}
      {detail.data && <div className="space-y-3 text-sm">
        <p>{detail.data.kind} · {detail.data.status}</p>
        {detail.data.lastError && <p>{detail.data.lastError}</p>}
        {detail.data.recording && (audio ? <audio controls src={audio} className="w-full" /> :
          <Button size="sm" variant="secondary" onClick={() => void getAudio(detail.data!.id)}>Load private recording</Button>)}
        {detail.data.details?.proposal?.summary && <p>{detail.data.details.proposal.summary}</p>}
        {detail.data.details?.proposal?.evidence && <blockquote className="border-l-2 border-line pl-3">{detail.data.details.proposal.evidence}</blockquote>}
        {detail.data.details?.proposal?.nextSteps?.map((item) => <p key={item}>{item}</p>)}
        {detail.data.details?.survey?.map((field) => <div key={field.field} className="rounded-lg border border-line p-2">
          <p><strong>{surveyLabels[field.field]}</strong> · {field.previous ?? 'Empty'} → {field.proposed}</p>
          <p className="text-xs text-muted">{field.applied ? 'Applied' : field.conflict ? 'Conflicts with current value' : 'Needs review'} · {field.confidence}% confidence</p>
          {field.evidence && <p className="text-xs">{field.evidence}</p>}
        </div>)}
        {detail.data.details?.transcript?.segments.map((segment) => <p key={segment.start}><strong>{Math.floor(segment.start)}s</strong> {segment.text}</p>)}
      </div>}
    </Dialog>
  </section>;
}
