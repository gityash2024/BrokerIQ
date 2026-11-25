'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiBlob, captureAccountContext, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { connectSurveyFieldsSchema, connectSurveyFieldTypes, formatConnectCall, formatConnectSurveyValue, hasDelegatedAccess,
  type ConnectActionDraft, type ConnectCallMetadata, type ConnectSurveyField, type ConnectSurveySuggestion } from '@brokeriq/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

const firmOptions = { leads: 'Create leads and requirements', inventory: 'Create private property drafts', survey: 'Fill empty Survey fields' };
type AutomationRule = keyof typeof firmOptions;
type FirmPolicy = Record<AutomationRule, boolean> & { retentionDays?: number | null; surveyFields?: ConnectSurveyField[] };
type Profile = { policy?: FirmPolicy; downloadUrl: string | null; latestVersion: number; enabled: boolean;
  devices: { id: string; label: string; version: number; consentAt: string | null; lastSeenAt: string }[] };
type Event = { id: string; kind: string; status: string; capturedAt: string; recording: boolean; lastError?: string };
const surveyLabels: Record<string, string> = { bhk: 'BHK', floor: 'Floor', purpose: 'Purpose' };
type EventDetail = Event & { details: { proposal?: { summary?: string; nextSteps?: string[]; evidence?: string; confidence?: number; recommendedAction?: ConnectActionDraft };
  survey?: ConnectSurveySuggestion[];
  call?: ConnectCallMetadata;
  transcript?: { language: string; segments: { start: number; end: number; text: string }[] } } | null };

export function ConnectProfile() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [surveyField, setSurveyField] = useState<ConnectSurveyField>({ label: '', type: 'TEXT', required: false });
  const data = useQuery({ queryKey: ['connect-profile', user?.id, user?.organization?.id], queryFn: () => api<Profile>('/connect/profile'), enabled: !!user && open });
  const surveyFields = data.data?.policy?.surveyFields ?? [];
  async function revoke(id: string) {
    if (!window.confirm('Revoke this connected device?')) return;
    try { await api('/connect/devices/' + id, { method: 'DELETE' }); await data.refetch(); }
    catch (error) { toast.error(errorMessage(error)); }
  }
  async function updatePolicy(change: Partial<FirmPolicy>) {
    const policy = data.data?.policy;
    if (!policy || policyBusy) return;
    const ownerContext = captureAccountContext();
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
      window.location.assign(result.data.downloadUrl);
    } catch (error) { toast.error(errorMessage(error)); }
  }
  if (!user) return null;
  return <>
    <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>BrokerIQ Connect</Button>
    <Dialog open={open} onOpenChange={setOpen} title="BrokerIQ Connect" description="Automate your calls, leads and property inventory.">
      {data.isError && <ApiErrorState error={data.error} onRetry={() => data.refetch()} />}
      {data.isPending && <p role="status">Loading device status…</p>}
      {data.data && <div className="space-y-3">
        <p className="text-sm">{data.data.enabled ? (data.data.devices.length ? 'Connected' : 'Not connected') : 'Device linking is paused'}</p>
        {data.data.downloadUrl ? <a className="font-semibold text-brand-700 underline" href={data.data.downloadUrl} referrerPolicy="no-referrer"
          onClick={(event) => { event.preventDefault(); void download(); }}>Download BrokerIQ Connect</a> :
          <p className="text-sm text-muted">Download is unavailable for this environment.</p>}
        {data.data.devices.map((device) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-2" key={device.id}>
          <div><p className="font-semibold">{device.label}</p><p className="text-xs text-muted">
            {device.consentAt ? 'Authorized' : 'Permissions required'}{device.version < data.data!.latestVersion ? ' · Update available' : ''}
            {' · Last seen ' + new Date(device.lastSeenAt).toLocaleString('en-IN')}
          </p></div>
          <Button size="sm" variant="secondary" onClick={() => void revoke(device.id)}>Revoke</Button>
        </div>)}
        {data.data.policy && <fieldset className="space-y-2 rounded-xl border border-line p-3" disabled={policyBusy}>
          <legend className="text-sm font-semibold">Firm automation rules</legend>
          {(Object.keys(firmOptions) as AutomationRule[]).map((key) => <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={data.data!.policy![key]} onChange={() => void updatePolicy({ [key]: !data.data!.policy![key] })} />{firmOptions[key]}
          </label>)}
          <label className="flex flex-wrap items-center gap-2 text-sm">
            Keep captures
            <select className="rounded-lg border border-line bg-surface p-2" value={data.data.policy.retentionDays ?? ''}
              onChange={(event) => {
                const days = Number(event.target.value) || null;
                if (days === null || window.confirm('Older Connect captures, recordings and transcripts will be deleted automatically. Save this retention policy?')) {
                  void updatePolicy({ retentionDays: days });
                }
              }}>
              <option value="">Until manually deleted</option>
              {(data.data.policy.retentionDays === 30 ? [30, 90, 180, 365] : [90, 180, 365]).map((days) => <option key={days} value={days}>{days} days</option>)}
            </select>
          </label>
          <div className="space-y-2 border-t border-line pt-2">
            <p className="font-semibold">Custom Survey fields</p>
            {surveyFields.map((field, index) => <div key={field.label} className="flex flex-wrap items-center gap-2 text-sm">
              <span>{field.label} · {connectSurveyFieldTypes[field.type]}{field.required ? ' · Required' : ''}</span>
              <Button size="sm" variant="ghost" aria-label={'Remove ' + field.label}
                onClick={() => void updatePolicy({ surveyFields: surveyFields.filter((_, i) => i !== index) })}>Remove</Button>
            </div>)}
            {surveyFields.length < 12 && <div className="flex flex-wrap items-center gap-2 text-sm">
              <input aria-label="Survey field name" placeholder="Field name" maxLength={48} className="rounded-lg border border-line bg-surface p-2"
                value={surveyField.label} onChange={(event) => setSurveyField({ ...surveyField, label: event.target.value })} />
              <select aria-label="Survey field type" className="rounded-lg border border-line bg-surface p-2" value={surveyField.type}
                onChange={(event) => setSurveyField({ ...surveyField, type: event.target.value as ConnectSurveyField['type'] })}>
                {Object.entries(connectSurveyFieldTypes).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
              </select>
              <label className="flex items-center gap-1"><input type="checkbox" checked={surveyField.required}
                onChange={(event) => setSurveyField({ ...surveyField, required: event.target.checked })} />Required</label>
              <Button size="sm" variant="secondary" disabled={surveyField.label.trim().length < 2} onClick={() => void addSurveyField()}>Add field</Button>
            </div>}
          </div>
        </fieldset>}
        <ConnectLeadActivity enabled={data.data.enabled && ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role) && hasDelegatedAccess(user, 'automation', 'view')} />
      </div>}
    </Dialog>
  </>;
}

export function ConnectLeadActivity({ leadId, enabled, draftAction }: { leadId?: string; enabled: boolean; draftAction?: (action: ConnectActionDraft) => void }) {
  const { user } = useAuth();
  const [eventId, setEvent] = useState<string | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canReview = hasDelegatedAccess(user, 'automation', 'view', 'edit');
  const canDelete = user?.role === 'BROKER_ADMIN';
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
  async function update(id: string, action: 'retry' | 'delete' | 'REVIEWED' | 'DISMISSED') {
    if (action === 'delete' && !window.confirm('Delete this Connect capture and its private recording and transcript?')) return;
    setBusy(true);
    try {
      const path = '/connect/events/' + id;
      if (action === 'delete') await api(path, { method: 'DELETE' });
      else if (action === 'retry') await api(path + '/retry', { method: 'POST' });
      else await api(path + '/review', { method: 'PATCH', body: { decision: action } });
      if (action === 'delete') { setAudio(null); setEvent(null); }
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
      {entry.kind === 'UNMATCHED_CALL' ? 'Unmatched call' : entry.kind} · {entry.status} · {new Date(entry.capturedAt).toLocaleString('en-IN')}
    </button>)}
    <Dialog open={!!eventId} onOpenChange={(open) => { if (!open) { setEvent(null); setAudio(null); } }} title="Connect activity" size="lg" footer={detail.data && <>
      {canReview && detail.data.status === 'REVIEW' && <>
        <Button size="sm" disabled={busy} onClick={() => void update(detail.data!.id, 'REVIEWED')}>Mark reviewed</Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void update(detail.data!.id, 'DISMISSED')}>Dismiss suggestion</Button>
      </>}
      {canReview && detail.data.status === 'FAILED' && <Button variant="secondary" disabled={busy} onClick={() => void update(detail.data!.id, 'retry')}>Retry analysis</Button>}
      {canDelete && <Button variant="secondary" disabled={busy} onClick={() => void update(detail.data!.id, 'delete')}>Delete capture</Button>}
    </>}>
      {detail.error && <ApiErrorState error={detail.error} onRetry={() => detail.refetch()} />}
      {detail.data && <div className="space-y-3 text-sm">
        <p>{detail.data.kind === 'UNMATCHED_CALL' ? 'Unmatched call' : detail.data.kind} · {detail.data.status}</p>
        {detail.data.details?.call && <p>{formatConnectCall(detail.data.details.call)}</p>}
        {detail.data.lastError && <p>{detail.data.lastError}</p>}
        {detail.data.recording && (audio ? <audio controls src={audio} className="w-full" /> :
          <Button size="sm" variant="secondary" onClick={() => void getAudio(detail.data!.id)}>Load private recording</Button>)}
        {detail.data.details?.proposal?.summary && <p>{detail.data.details.proposal.summary}</p>}
        {detail.data.details?.proposal?.evidence && <blockquote className="border-l-2 border-line pl-3">{detail.data.details.proposal.evidence}</blockquote>}
        {detail.data.details?.proposal?.nextSteps?.map((item) => <p key={item}>{item}</p>)}
        {detail.data.status !== 'DISMISSED' && detail.data.details?.proposal?.recommendedAction && (() => {
          const recommendation = detail.data.details.proposal.recommendedAction;
          return <div className="space-y-2 rounded-lg border border-line p-2">
            <p>{recommendation.note}</p>
            <blockquote className="text-xs text-muted">{recommendation.evidence}</blockquote>
            {draftAction && canReview && <Button size="sm" variant="secondary" onClick={() => {
              setEvent(null);
              setAudio(null);
              draftAction(recommendation);
            }}>{recommendation.kind === 'SITE_VISIT' ? 'Review site visit draft' : 'Review follow-up draft'}</Button>}
          </div>;
        })()}
        {detail.data.details?.survey?.map((field) => <div key={field.field} className="rounded-lg border border-line p-2">
          <p><strong>{field.label ?? surveyLabels[field.field] ?? field.field}</strong> · {formatConnectSurveyValue(field.previous)} → {field.required && field.proposed == null ? 'Required review' : formatConnectSurveyValue(field.proposed)}</p>
          <p className="text-xs text-muted">{field.applied ? 'Applied' : field.conflict ? 'Conflicts with current value' : 'Needs review'} · {field.confidence}% confidence</p>
          {field.evidence && <p className="text-xs">{field.evidence}</p>}
        </div>)}
        {detail.data.details?.transcript?.segments.map((segment) => <p key={segment.start}><strong>{Math.floor(segment.start)}s</strong> {segment.text}</p>)}
      </div>}
    </Dialog>
  </section>;
}
