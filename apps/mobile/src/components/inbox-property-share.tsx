import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { router } from 'expo-router';
import { hasDelegatedAccess, clientPropertyShare, propertyGalleryDraft, shareablePropertyPhotoUrls, type LedgerItem } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button, Chip, Txt } from '@/ui';
import { VisitPropertyPicker } from './visit-property-picker';

export function InboxPropertyShare({ onDraft }: { onDraft: (draft: string) => void }) {
  const { user } = useAuth();
  const canBrowse = hasDelegatedAccess(user, 'inventory', 'view');
  const [item, setItem] = useState<LedgerItem | null>(null);
  const [photos, setPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const locked = !!item && !['OWN', 'APPROVED'].includes(item.detailAccess ?? 'OWN');
  async function prepare() {
    if (!item || busy || locked) return;
    setBusy(true);
    try {
      let text = clientPropertyShare(item);
      if (photos && shareablePropertyPhotoUrls(item.photoUrls).length) {
        const gallery = await api<{ url: string }>(`/inventory/${item.id}/photo-gallery`, { method: 'POST' });
        text = propertyGalleryDraft(text, gallery.url);
      }
      onDraft(text);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (!canBrowse) return <Txt color="muted">Inventory access is required to choose a property. Ask your Broker Admin to enable Inventory view permission.</Txt>;
  return (
    <>
      <VisitPropertyPicker open value={item} onChange={setItem} purpose="photos" />
      {item && (
        <>
          <Txt>{clientPropertyShare(item)}</Txt>
          {locked ? (
            <Button title="Request access from property page" variant="secondary" onPress={() => router.push(`/inventory/${item.id}`)} />
          ) : (
            <>
              <Chip label="Include photo gallery link" active={photos} onPress={() => setPhotos(!photos)} />
              {!item.photoUrls?.length && <Txt color="muted">No photos recorded. Property details can still be shared.</Txt>}
              <Button title="Add property to message" loading={busy} onPress={() => void prepare()} />
            </>
          )}
        </>
      )}
    </>
  );
}
