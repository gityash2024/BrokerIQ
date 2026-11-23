'use client';
import { BackButton } from '@/components/ui/back-button';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseVisitLocalDateTime, visitInventoryTitle, hasDelegatedAccess, moduleAllowed, type LedgerItem } from '@brokeriq/shared';
import { submitTask } from '@/lib/task-submissions';
import { api } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useConfig, useFlag } from '@/lib/config';
import { toLocalInput } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { LeadPicker } from './lead-picker';
import { VisitProperties } from './visit-properties';
import { Button } from '@/components/ui/button';
import { ApiErrorState } from '@/components/ui/api-error';
import { Field, Input, Select, Textarea } from '@/components/ui/field';

export function VisitSchedulePage() {
  return (
    <Suspense>
      <VisitScheduleForm />
    </Suspense>
  );
}

function VisitScheduleForm() {
  const search = useSearchParams();
  const leadId = search.get('lead');
  const router = useRouter();
  const client = useQueryClient();
  const { user } = useAuth();
  const config = useConfig();
  const policyRole = user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '');
  const canViewInventory = moduleAllowed(config.modules, 'inventory', policyRole) && hasDelegatedAccess(user, 'inventory', 'view');
  const allowed = hasDelegatedAccess(user, 'leads', 'create');
  const videoOn = useFlag('video_visits');
  const back = leadId ? `/broker/leads/${encodeURIComponent(leadId)}?tab=tasks` : '/broker/visits';
  const [lead, setLead] = useState<any>(null);
  const [properties, setProperties] = useState<LedgerItem[]>([]);
  const [at, setAt] = useState(() => {
    const d = new Date(Date.now() + 86400_000);
    d.setHours(11, 0, 0, 0);
    return toLocalInput(d);
  });
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'IN_PERSON' | 'VIDEO'>('IN_PERSON');
  const fixedLead = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => api<{ id: string; name: string }>(`/leads/${encodeURIComponent(leadId!)}`),
    enabled: !!leadId && allowed,
  });
  const selectedLead = leadId ? fixedLead.data : lead;
  const create = useApiMutation(
    (retry?: boolean) => {
      if (!selectedLead) throw new Error('Choose a lead first');
      if (retry) return submitTask('/visits', selectedLead.id);
      const date = parseVisitLocalDateTime(at);
      if (!date) throw new Error('Enter a valid date and time');
      const payload = {
        leadId: selectedLead.id,
        inventoryIds: properties.length ? properties.map((item) => item.id) : undefined,
        mode,
        scheduledAt: date.toISOString(),
        address: address || null,
        note: note || null,
      };
      return submitTask('/visits', selectedLead.id, payload);
    },
    {
      success: 'Visit scheduled — lead stage "Site visit" पर गया',
      invalidate: [['visits'], ['broker-dashboard'], ['kanban'], ['leads']],
      onSuccess: async () => {
        await client.invalidateQueries({ queryKey: ['lead', selectedLead?.id] });
        router.replace(back);
      },
    },
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Schedule site visit"
        actions={
          <BackButton variant="secondary" href={back}>
            {leadId ? 'Back to lead' : 'Back to visits'}
          </BackButton>
        }
      />
      {!allowed ? (
        <p role="alert">This action is not assigned to your account.</p>
      ) : fixedLead.error ? (
        <ApiErrorState error={fixedLead.error} onRetry={() => fixedLead.refetch()} />
      ) : (
        <section className="card mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
          {leadId ? (
            <p className="font-semibold">{fixedLead.data?.name ?? 'Loading lead…'}</p>
          ) : (
            <Field label="Lead" required>
              <LeadPicker value={lead} onChange={setLead} />
            </Field>
          )}
          {videoOn && !!leadId && (
            <Field label="Visit type">
              <Select value={mode} onChange={(event) => setMode(event.target.value === 'VIDEO' ? 'VIDEO' : 'IN_PERSON')}>
                <option value="IN_PERSON">At the property</option>
                <option value="VIDEO">Video call</option>
              </Select>
            </Field>
          )}
          {canViewInventory ? (
            <VisitProperties
              items={properties}
              onChange={(next) => {
                const first = properties[0];
                const suggested = first ? first.address || visitInventoryTitle(first) : '';
                if (address === suggested || (!address && !first)) setAddress(next[0] ? next[0].address || visitInventoryTitle(next[0]) : '');
                setProperties(next);
              }}
            />
          ) : (
            <p className="text-sm text-muted">Property selection · Ask your Broker Admin for inventory view access.</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date & time" required>
              <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
            </Field>
            <Field label="Meeting point">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="जैसे: Society main gate" />
            </Field>
          </div>
          <Field label="Note">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!selectedLead || !parseVisitLocalDateTime(at)} loading={create.isPending} onClick={() => create.mutate(undefined)}>
              Schedule visit
            </Button>
            <Button variant="secondary" disabled={!selectedLead || create.isPending} onClick={() => create.mutate(true)}>
              Retry saved
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
