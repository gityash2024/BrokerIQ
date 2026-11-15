import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasDelegatedAccess, moduleAllowed, propertyPhotoDraft, visitInventoryTitle, type LedgerItem } from '@brokeriq/shared';
import { VisitPropertyPicker } from '@/components/visit-property-picker';
import { NativePropertyMedia } from '@/launch/property-media';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { openLeadInbox } from '@/lib/inbox-composer';
import { Button, ErrorView, Loader, Txt } from '@/ui';

export default function LeadSharePhotos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const config = useConfig();
  const client = useQueryClient();
  const role = user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '');
  const allowed =
    ['leads', 'inventory', 'inbox'].every((key) => moduleAllowed(config.modules, key, role) && hasDelegatedAccess(user, key, 'view')) &&
    hasDelegatedAccess(user, 'inbox', 'edit', 'send');
  const lead = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api<{ stage: string; visits: { status: string }[] }>(`/leads/${id}`),
    enabled: !!id && !!user && allowed,
  });
  const [property, setProperty] = useState<LedgerItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);
  const title = property ? String(visitInventoryTitle(property)) : '';
  const draft = propertyPhotoDraft(title, property?.photoUrls);
  const canUpload = hasDelegatedAccess(user, 'inventory', 'edit');
  const beforeVisit =
    lead.data && ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT'].includes(lead.data.stage) && !lead.data.visits.some(({ status }) => status === 'COMPLETED');

  return (
    <BrokerScreen title="Share property photos" back>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
        <NativeCard style={{ gap: 14 }}>
          {!id || !allowed ? (
            <Txt>This action is not assigned to your account.</Txt>
          ) : lead.error ? (
            <ErrorView error={lead.error} onRetry={() => lead.refetch()} />
          ) : !lead.data ? (
            <Loader />
          ) : !beforeVisit ? (
            <Txt>Property photos can be shared here before the site visit is completed.</Txt>
          ) : (
            <>
              <VisitPropertyPicker
                open
                purpose="photos"
                value={property}
                onChange={(next) => {
                  if (!uploading) setProperty(next);
                }}
              />
              {property && (
                <>
                  <NativePropertyMedia
                    key={property.id}
                    photos={property.photoUrls ?? []}
                    onlyPhotos
                    onUploading={setUploading}
                    onAdd={
                      canUpload
                        ? async (_, url) => {
                            const updated = await api<LedgerItem>(`/inventory/${property.id}/photos`, { method: 'PATCH', body: { url } });
                            setProperty(updated);
                            void client.invalidateQueries({ queryKey: ['visit-inventory-picker'] });
                            void client.invalidateQueries({ queryKey: ['ledger-item'] });
                            void client.invalidateQueries({ queryKey: ['ledger'] });
                          }
                        : undefined
                    }
                  />
                  {draft === title && <Txt color="muted">This property has no shareable photos yet.</Txt>}
                </>
              )}
              <Button
                title="Review in Inbox"
                disabled={!property || draft === title || uploading}
                loading={opening}
                onPress={async () => {
                  setOpening(true);
                  try {
                    await openLeadInbox(id, draft);
                  } finally {
                    setOpening(false);
                  }
                }}
              />
            </>
          )}
        </NativeCard>
      </ScrollView>
    </BrokerScreen>
  );
}
