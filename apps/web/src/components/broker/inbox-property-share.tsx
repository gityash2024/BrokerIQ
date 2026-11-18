'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { hasDelegatedAccess, clientPropertyShare, propertyGalleryDraft, shareablePropertyPhotoUrls, type LedgerItem } from '@brokeriq/shared';
import { VisitPropertyPicker } from './visit-property-picker';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/api';
import { toast } from 'sonner';

export function InboxPropertyShare({ onDraft }: { onDraft: (draft: string) => void }) {
  const { user } = useAuth();
  const canBrowse = hasDelegatedAccess(user, 'inventory', 'view');
  const [item, setItem] = useState<LedgerItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState(true);
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
  if (!canBrowse)
    return <p className="text-sm text-muted">Inventory access is required to choose a property. Ask your Broker Admin to enable Inventory view permission.</p>;
  return (
    <div className="space-y-3">
      <VisitPropertyPicker value={item} onChange={setItem} purpose="photos" />
      {item && (
        <>
          <p className="whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{clientPropertyShare(item)}</p>
          {locked ? (
            <p className="text-sm">
              Request full details from this property's page before sharing its photos.{' '}
              <a className="text-brand-600 underline" href={`/broker/inventory/${item.id}`}>
                Open property
              </a>
            </p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={photos} onChange={(event) => setPhotos(event.target.checked)} />
                Include all photos in one gallery link
              </label>
              {!item.photoUrls?.length && <p className="text-xs text-muted">No property photos recorded. Details can still be shared.</p>}
              <Button loading={busy} disabled={busy} onClick={() => void prepare()}>
                Add property to message
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
