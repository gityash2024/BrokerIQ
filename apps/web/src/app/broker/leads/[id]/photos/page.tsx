'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Share2 } from 'lucide-react';
import { hasDelegatedAccess, moduleAllowed, propertyPhotoDraft, visitInventoryTitle, type LedgerItem } from '@brokeriq/shared';
import { PropertyMedia } from '@/components/broker/launch/property-media';
import { VisitPropertyPicker } from '@/components/broker/visit-property-picker';
import { PageHeader } from '@/components/panel/shell';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { openLeadInbox } from '@/lib/inbox-composer';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const config = useConfig();
  const client = useQueryClient();
  const role = user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '');
  const allowed =
    ['leads', 'inventory', 'inbox'].every((key) => moduleAllowed(config.modules, key, role) && hasDelegatedAccess(user, key, 'view')) &&
    hasDelegatedAccess(user, 'inbox', 'edit', 'send');
  const canUpload = hasDelegatedAccess(user, 'inventory', 'edit');
  const lead = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api<{ stage: string; visits: { status: string }[] }>(`/leads/${id}`),
    enabled: !!user && allowed,
  });
  const [property, setProperty] = useState<LedgerItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);
  const title = property ? String(visitInventoryTitle(property)) : '';
  const draft = propertyPhotoDraft(title, property?.photoUrls);
  const beforeVisit =
    lead.data && ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT'].includes(lead.data.stage) && !lead.data.visits.some(({ status }) => status === 'COMPLETED');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Share property photos"
        actions={
          <Button variant="secondary" href={`/broker/leads/${id}`}>
            <ArrowLeft className="size-4" /> Lead details
          </Button>
        }
      />
      {!allowed ? (
        <p role="alert">This action is not assigned to your account.</p>
      ) : lead.error ? (
        <ApiErrorState error={lead.error} onRetry={() => lead.refetch()} />
      ) : !lead.data ? (
        <p role="status">Loading lead…</p>
      ) : !beforeVisit ? (
        <p>Property photos can be shared here before the site visit is completed.</p>
      ) : (
        <section className="card mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
          <VisitPropertyPicker
            purpose="photos"
            value={property}
            onChange={(next) => {
              if (!uploading) setProperty(next);
            }}
          />
          {property && (
            <>
              <PropertyMedia
                key={property.id}
                urls={property.photoUrls ?? []}
                disabled={!canUpload}
                onUploading={setUploading}
                onAdd={async (url) => {
                  const updated = await api<LedgerItem>(`/inventory/${property.id}/photos`, { method: 'PATCH', body: { url } });
                  setProperty(updated);
                  void client.invalidateQueries({ queryKey: ['visit-inventory-picker'] });
                  void client.invalidateQueries({ queryKey: ['ledger-item'] });
                  void client.invalidateQueries({ queryKey: ['ledger'] });
                }}
              />
              {draft === title && <p className="text-sm text-muted">This property has no shareable photos yet.</p>}
            </>
          )}
          <Button
            disabled={!property || draft === title || uploading}
            loading={opening}
            onClick={async () => {
              setOpening(true);
              try {
                await openLeadInbox(id, draft);
              } finally {
                setOpening(false);
              }
            }}
          >
            <Share2 className="size-4" /> Review in Inbox
          </Button>
        </section>
      )}
    </div>
  );
}
