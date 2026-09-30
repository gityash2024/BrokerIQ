'use client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Download, ExternalLink, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { img } from '@/lib/utils';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/misc';

/** Copy-ready listing text + photos for posting the same property on Housing / 99acres / MagicBricks. */
export function PortalPackDialog({ listingId, onClose }: { listingId: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['portal-pack', listingId], queryFn: () => api<any>(`/broker/portal-pack/${listingId}`), enabled: !!listingId });
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copy हो गया`);
  };
  const d = q.data;
  return (
    <Dialog
      open={!!listingId}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="Portal pack"
      description="यही listing Housing / 99acres / MagicBricks पर डालने के लिए सब कुछ तैयार — copy करें और portal पर paste करें।"
    >
      {q.isLoading || !d ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-5">
          <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
            <Info className="mt-0.5 size-3.5 shrink-0" /> Portals listing post करने का public API नहीं देते, इसलिए listing वहाँ अपने-आप post नहीं होती। वहाँ से
            आने वाली leads Connectors से अपने-आप BrokerIQ में आती हैं।
          </p>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-semibold">Title</p>
              <Button size="xs" variant="ghost" onClick={() => copy(d.title, 'Title')}>
                <Copy className="size-3.5" /> Copy
              </Button>
            </div>
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">{d.title}</p>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-semibold">Details</p>
              <Button size="xs" variant="ghost" onClick={() => copy(d.text, 'पूरी details')}>
                <Copy className="size-3.5" /> सब copy करें
              </Button>
            </div>
            <dl className="grid gap-x-4 gap-y-1.5 rounded-xl bg-surface-2 p-3 text-sm sm:grid-cols-2">
              {d.facts.map((f: any) => (
                <div key={f.label} className="flex justify-between gap-3">
                  <dt className="text-muted">{f.label}</dt>
                  <dd className="text-right font-medium" data-no-i18n>
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          {d.photos.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold">Photos ({d.photos.length})</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {d.photos.map((u: string, i: number) => (
                  <a
                    key={u}
                    href={u}
                    download={`photo-${i + 1}.jpg`}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-lg bg-surface-2"
                  >
                    {}
                    <img src={img(u, 200)} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-slate-950/40 text-white opacity-0 transition group-hover:opacity-100">
                      <Download className="size-4" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {d.portals.map((p: any) => (
              <Button key={p.key} size="sm" variant="secondary" href={p.url} external>
                {p.name} खोलें <ExternalLink className="size-3.5" />
              </Button>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}
