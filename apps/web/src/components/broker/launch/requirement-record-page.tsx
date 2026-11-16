'use client';
import { LoadingArtwork } from '@/components/ui/request-loader';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { offeredRequirement, type BrokerRequirementInput } from '@brokeriq/shared';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/panel/shell';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { PropertyForm } from './property-form';
import { RequirementForm } from './requirement-form';
import { RequirementRecordForm } from './requirement-record-form';

const base = '/broker/leads/requirements';
type Mode = 'new' | 'edit' | 'convert';
type Requirement = BrokerRequirementInput & { id: string; revision: number; convertedAt?: string | null };

export function RequirementRecordPage({ mode }: { mode: Mode }) {
  return (
    <Suspense>
      <RecordContent mode={mode} />
    </Suspense>
  );
}

function RecordContent({ mode }: { mode: Mode }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const leadId = mode === 'new' ? search.get('lead') : null;
  const client = useQueryClient();
  const { user } = useAuth();
  const [dirty, setDirty] = useState(false);
  const [converting, setConverting] = useState(false);
  const key = ['broker-requirements', user?.id, id];
  const record = useQuery({
    queryKey: key,
    queryFn: () => api<Requirement>(`/broker-requirements/${id}`),
    enabled: !!id && !!user,
  });
  const lead = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => api<{ name: string; phone: string }>(`/leads/${leadId}`),
    enabled: !!leadId && !!user,
  });
  const item = record.data;
  const back = leadId ? `/broker/leads/${encodeURIComponent(leadId)}` : base;
  const title = mode === 'new' ? 'New requirement' : mode === 'edit' ? 'Review requirement' : 'Review property before inventory conversion';

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  async function save(body: BrokerRequirementInput) {
    await api(id ? `/broker-requirements/${id}` : '/broker-requirements', {
      method: id ? 'PATCH' : 'POST',
      body: leadId ? { ...body, leadId } : body,
    });
    setDirty(false);
    await client.invalidateQueries({ queryKey: ['broker-requirements'] });
    router.replace(back);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        actions={
          <Button
            href={back}
            variant="secondary"
            onClick={(event) => {
              if (dirty && !window.confirm('Discard unsaved requirement changes?')) event.preventDefault();
            }}
          >
            {leadId ? 'Back to lead' : 'Back to requirements'}
          </Button>
        }
      />
      <section className="card mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        {record.error || lead.error ? (
          <ApiErrorState error={record.error || lead.error} />
        ) : (id && !item) || (leadId && !lead.data) ? (
          <LoadingArtwork className="h-16" label="Loading…" />
        ) : mode !== 'convert' ? (
          leadId && lead.data ? (
            <RequirementForm initial={{ leadId, contactName: lead.data.name, contactPhone: lead.data.phone }} onDirty={() => setDirty(true)} onSave={save} />
          ) : (
            <RequirementRecordForm key={item?.id ?? 'new'} initial={item} onDirty={() => setDirty(true)} onSave={save} />
          )
        ) : item?.intent !== 'OFFER' || item?.status !== 'OPEN' || item.convertedAt ? (
          <p>This record cannot be converted.</p>
        ) : (
          <>
            <p className="text-sm text-muted">Save any corrections before creating the inventory record. The original requirement and source stay available.</p>
            <PropertyForm
              initial={item.offerDetails ?? {}}
              onDirty={() => setDirty(true)}
              label="Save reviewed property details"
              onSave={async (input) => {
                const saved = await api<Requirement>(`/broker-requirements/${id}`, {
                  method: 'PATCH',
                  body: { ...offeredRequirement(input), leadId: item.leadId, expectedRevision: item.revision },
                });
                client.setQueryData(key, saved);
                setDirty(false);
                toast.success('Reviewed offer saved');
              }}
            />
            <Button
              loading={converting}
              disabled={dirty}
              onClick={async () => {
                setConverting(true);
                try {
                  await api(`/broker-requirements/${id}/convert`, { body: { expectedRevision: item.revision } });
                  await Promise.all(['broker-requirements', 'ledger', 'ledger-stats'].map((prefix) => client.invalidateQueries({ queryKey: [prefix] })));
                  toast.success('Independent inventory record created');
                  router.replace(base);
                } catch (error) {
                  toast.error(errorMessage(error));
                } finally {
                  setConverting(false);
                }
              }}
            >
              Confirm · add to inventory
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
