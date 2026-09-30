'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { img } from '@/lib/utils';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Field, Input, Textarea } from '../ui/field';
import { Avatar } from '../ui/misc';
import { useFlag } from '@/lib/config';

export const SERVICE_LABELS: Record<string, string> = { PACKERS: 'Packers & movers', FURNITURE: 'Furniture rental', BROADBAND: 'Broadband', CLEANING: 'Deep cleaning', PAINTING: 'Painting', OTHER: 'Other' };

/** Hidden while Super Admin has "move_in_services" switched off. */
export function MoveInServices(props: { localityId?: string; listingId?: string; title?: string }) {
  return useFlag('move_in_services') ? <MoveInServicesInner {...props} /> : null;
}

/** Move-in partners (added by BrokerIQ) — request a callback; hidden when there are none. */
function MoveInServicesInner({ localityId, listingId, title = 'Move-in services' }: { localityId?: string; listingId?: string; title?: string }) {
  const q = useQuery({ queryKey: ['services', localityId ?? ''], queryFn: () => api<any[]>(`/public/services${localityId ? `?localityId=${localityId}` : ''}`, { auth: false }) });
  const [pick, setPick] = useState<any>(null);
  if (!q.data?.length) return null;
  return (
    <section>
      <h2 className="flex items-center gap-2 font-display text-xl font-bold"><Truck className="size-5 text-brand-600" /> {title}</h2>
      <p className="mt-1 text-sm text-muted">Shifting, furniture, internet — BrokerIQ के भरोसेमंद partners से callback लें।</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {q.data.map((p) => (
          <button key={p.id} onClick={() => setPick(p)} className="card flex items-center gap-3 p-4 text-left transition hover:border-brand-300">
            {p.logoUrl ? (
               
              <img src={img(p.logoUrl, 96)} alt="" className="size-11 rounded-xl object-cover" />
            ) : (
              <Avatar name={p.name} size={44} />
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold" data-no-i18n>{p.name}</p>
              <p className="text-xs text-muted">{SERVICE_LABELS[p.category] ?? p.category}{p.offer ? <> · <span className="font-semibold text-emerald-600" data-no-i18n>{p.offer}</span></> : null}</p>
            </div>
          </button>
        ))}
      </div>
      <RequestDialog partner={pick} listingId={listingId} onClose={() => setPick(null)} />
    </section>
  );
}

function RequestDialog({ partner, listingId, onClose }: { partner: any; listingId?: string; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', preferredDate: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    setBusy(true);
    try {
      await api('/services/requests', { method: 'POST', body: { partnerId: partner.id, listingId, name: f.name, phone: f.phone, preferredDate: f.preferredDate || undefined, notes: f.notes || undefined } });
      toast.success(`${partner.name} जल्द आपको call करेंगे`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!partner} onOpenChange={(v) => !v && onClose()} title={partner?.name} description={partner?.description} footer={<Button onClick={send} loading={busy} disabled={!f.name || !f.phone}>Callback माँगें</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="नाम"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Mobile"><Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="कब चाहिए"><Input type="date" value={f.preferredDate} onChange={(e) => setF({ ...f, preferredDate: e.target.value })} /></Field>
        <div />
        <Field label="Details"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="जैसे: 2 BHK का सामान, lift है" /></Field>
      </div>
    </Dialog>
  );
}
