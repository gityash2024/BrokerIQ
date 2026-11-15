import { useState } from 'react';

import { ScrollView } from '@/components/keyboard-scroll-view';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasDelegatedAccess, moduleAllowed, propertyPhotoDraft, shareablePropertyPhotoUrls, visitInventoryTitle, type LedgerItem } from '@brokeriq/shared';
import { SharePhotoFilesButton } from '@/components/share-photo-files-button';
import { VisitPropertyPicker } from '@/components/visit-property-picker';
import { NativePropertyMedia } from '@/launch/property-media';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { openLeadInbox } from '@/lib/inbox-composer';
import { Button, ErrorView, Loader, Sheet, Txt } from '@/ui';

export default function LeadSharePhotos() {
  const { id, propertyId } = useLocalSearchParams<{ id: string; propertyId?: string }>();
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
  const [selected, setProperty] = useState<LedgerItem | null>();
  const [shareOpen, setShareOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);
  const canUpload = hasDelegatedAccess(user, 'inventory', 'edit');
  const beforeVisit =
    lead.data && ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT'].includes(lead.data.stage) && !lead.data.visits.some(({ status }) => status === 'COMPLETED');
  const initialProperty = useQuery({
    queryKey: ['ledger-item', user?.id, propertyId],
    queryFn: () => api<LedgerItem>(`/inventory/${encodeURIComponent(propertyId!)}`),
    enabled: !!beforeVisit && !!propertyId && /^[A-Za-z0-9_-]+$/.test(propertyId),
  });
  const preselected = initialProperty.data?.deletedAt ? null : initialProperty.data;
  const property = selected === undefined ? (preselected ?? null) : selected;
  const title = property ? String(visitInventoryTitle(property)) : '';
  const photos = shareablePropertyPhotoUrls(property?.photoUrls);
  const draft = propertyPhotoDraft(title, photos);

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
                  {!photos.length && <Txt color="muted">This property has no shareable photos yet.</Txt>}
                </>
              )}
              <Button title="Share photos" disabled={!photos.length || uploading} onPress={() => setShareOpen(true)} />
              {shareOpen && (
                <Sheet
                  open
                  title="Share property photos"
                  onClose={() => {
                    if (!opening) setShareOpen(false);
                  }}
                >
                  <Button
                    title="Share as links in BrokerIQ"
                    loading={opening}
                    disabled={draft === title}
                    onPress={async () => {
                      setOpening(true);
                      try {
                        await openLeadInbox(id, draft);
                        setShareOpen(false);
                      } finally {
                        setOpening(false);
                      }
                    }}
                  />
                  <Txt v="caption" color="muted">
                    Review the WhatsApp message in Inbox before sending.
                  </Txt>
                  <SharePhotoFilesButton urls={photos} disabled={opening} />
                </Sheet>
              )}
            </>
          )}
        </NativeCard>
      </ScrollView>
    </BrokerScreen>
  );
}
