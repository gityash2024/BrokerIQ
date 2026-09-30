'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Download, MessageCircle } from 'lucide-react';
import { whatsappLink } from '@brokeriq/shared';
import { errorMessage } from '@/lib/api';
import { post } from '@/lib/hooks';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/misc';

/** Ready-to-post WhatsApp status / Instagram images + caption with a tracked link. */
export function ShareKitDialog({ listingId, leadId, onClose }: { listingId: string | null; leadId?: string; onClose: () => void }) {
  const [kit, setKit] = useState<any>(null);
  useEffect(() => {
    setKit(null);
    if (!listingId) return;
    post<any>(`/broker/share-kit/${listingId}`, { leadId })
      .then(setKit)
      .catch((e) => {
        toast.error(errorMessage(e));
        onClose();
      });
  }, [listingId, leadId]); // eslint-disable-line react-hooks/exhaustive-deps
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copy हो गया`);
  };
  return (
    <Dialog
      open={!!listingId}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="Share kit"
      description="WhatsApp status, Instagram post/story के लिए तैयार images — link से आने वाले हर visit की गिनती होती है।"
    >
      {!kit ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_0.56fr] gap-3">
            {(['post', 'story'] as const).map((f) => (
              <div key={f} className="space-y-2">
                {}
                <img src={kit.images[f]} alt={f} className="w-full rounded-xl border border-line" />
                <Button size="xs" variant="secondary" className="w-full" href={`${kit.images[f]}&download=1`} external>
                  <Download className="size-3.5" /> {f === 'post' ? 'Post (1:1)' : 'Story (9:16)'}
                </Button>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-semibold">Caption</p>
              <Button size="xs" variant="ghost" onClick={() => copy(kit.caption, 'Caption')}>
                <Copy className="size-3.5" /> Copy
              </Button>
            </div>
            <pre className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-sans text-sm" data-no-i18n>
              {kit.caption}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="whatsapp" href={whatsappLink('', kit.caption)} external>
              <MessageCircle className="size-4" /> WhatsApp पर भेजें
            </Button>
            <Button variant="secondary" onClick={() => copy(kit.link, 'Link')}>
              <Copy className="size-4" /> Tracking link
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
