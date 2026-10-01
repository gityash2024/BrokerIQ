'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Columns3, Heart, Share2, Unlink } from 'lucide-react';
import { api } from '@/lib/api';
import { useFlag } from '@/lib/config';
import { del, post, useApiMutation } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { ListingCard, ListingCardSkeleton } from '@/components/site/listing-card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Empty } from '@/components/ui/misc';
import { CopyField } from '@/components/panel/integration-card';

export default function SavedPage() {
  const router = useRouter();
  const q = useQuery({ queryKey: ['saved'], queryFn: () => api<any[]>('/listings/saved') });
  const tools = useFlag('compare_shortlist');
  const [picking, setPicking] = useState<string[] | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const share = useApiMutation(() => post<{ url: string }>('/me/shortlist/share'), { onSuccess: (r) => setShareUrl(r.url) });
  const unshare = useApiMutation(() => del('/me/shortlist/share'), { success: 'Share link बंद कर दिया', onSuccess: () => setShareUrl(null) });
  const toggle = (id: string) =>
    setPicking((p) => (!p ? p : p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? (toast.error('ज़्यादा से ज़्यादा 4 घर'), p) : [...p, id]));
  return (
    <>
      <PageHeader
        title="Saved properties"
        subtitle="आपकी shortlist"
        actions={
          tools && (q.data?.length ?? 0) > 0 ? (
            picking ? (
              <>
                <Button disabled={picking.length < 2} onClick={() => router.push(`/compare?ids=${picking.join(',')}`)}>
                  <Columns3 className="size-4" /> Compare ({picking.length})
                </Button>
                <Button variant="ghost" onClick={() => setPicking(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {(q.data?.length ?? 0) > 1 && (
                  <Button variant="secondary" onClick={() => setPicking([])}>
                    <Columns3 className="size-4" /> Compare करें
                  </Button>
                )}
                <Button variant="secondary" loading={share.isPending} onClick={() => share.mutate(undefined)}>
                  <Share2 className="size-4" /> Family के साथ share
                </Button>
              </>
            )
          ) : null
        }
      />
      {picking && <p className="mb-4 text-sm text-muted">2–4 घर चुनें (card पर tap करें), फिर Compare दबाएँ।</p>}
      {q.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : !q.data?.length ? (
        <Empty
          icon={<Heart className="size-6" />}
          title="अभी कुछ saved नहीं"
          text="Property card पर ❤️ दबाकर shortlist बनाएँ।"
          action={<Button href="/rent">Properties देखें</Button>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((l) =>
            picking ? (
              <div
                key={l.id}
                role="button"
                tabIndex={0}
                aria-pressed={picking.includes(l.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(l.id))}
                onClickCapture={(e) => (e.preventDefault(), e.stopPropagation(), toggle(l.id))}
                className={cn('rounded-3xl text-left transition', picking.includes(l.id) ? 'ring-4 ring-brand-500' : 'opacity-90 hover:opacity-100')}
              >
                <ListingCard l={l} />
              </div>
            ) : (
              <ListingCard key={l.id} l={l} />
            ),
          )}
        </div>
      )}
      <Dialog
        open={!!shareUrl}
        onOpenChange={(v) => !v && setShareUrl(null)}
        title="Shortlist share करें"
        description="इस link पर आपके saved घर दिखेंगे (सिर्फ़ properties — आपका phone/email नहीं)। नए घर save करेंगे तो वो भी दिखेंगे।"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button variant="whatsapp" external href={`https://wa.me/?text=${encodeURIComponent(`मेरी shortlist के घर देखो: ${shareUrl}`)}`}>
              WhatsApp पर भेजें
            </Button>
            <Button variant="ghost" loading={unshare.isPending} onClick={() => unshare.mutate(undefined)}>
              <Unlink className="size-4" /> Link बंद करें
            </Button>
          </div>
        }
      >
        {shareUrl && <CopyField label="Link" value={shareUrl} />}
      </Dialog>
    </>
  );
}
