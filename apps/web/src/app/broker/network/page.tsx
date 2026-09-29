'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Handshake, MessageCircle, Phone, Search } from 'lucide-react';
import { formatPriceShort, whatsappLink } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { patch, post, useApiMutation } from '@/lib/hooks';
import { formatDateTime, img } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Avatar, Badge, Empty, Skeleton } from '@/components/ui/misc';

const STATUS_TONE: Record<string, any> = { PENDING: 'warning', ACCEPTED: 'success', REJECTED: 'danger', CANCELLED: 'neutral', CLOSED: 'info' };

function NetworkInner() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<'network' | 'incoming' | 'outgoing'>((sp.get('tab') as any) || 'network');
  return (
    <>
      <PageHeader title="Co-broking network" subtitle="दूसरे BrokerIQ brokers की co-broking listings अपने clients के लिए इस्तेमाल करें — commission बाँटें, inventory बढ़ाएँ" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'network', label: 'Network listings' }, { value: 'incoming', label: 'मेरी listings पर requests' }, { value: 'outgoing', label: 'मेरी भेजी requests' }]} />
      <div className="mt-5">{tab === 'network' ? <Network /> : <Requests box={tab} />}</div>
    </>
  );
}

function Network() {
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['cobroke-network', q], queryFn: () => api<any>(`/cobroking/network${q ? `?q=${encodeURIComponent(q)}` : ''}`) });
  const request = useApiMutation((listingId: string) => post('/cobroking/requests', { listingId }), { success: 'Request भेजी — accept होने पर contact मिलेगा', invalidate: [['cobroke-network'], ['cobroke', 'outgoing']] });
  return (
    <>
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <Input className="pl-9" placeholder="Sector, society या title…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : !list.data?.items.length ? (
        <Empty icon={<Handshake className="size-6" />} title="अभी network में कोई listing नहीं" text="अपनी listings में 'Co-broking के लिए खुला' चालू करें और brokers को invite करें — network बढ़ेगा।" action={<Button href="/broker/invite-brokers" variant="secondary">Brokers invite करें</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.data.items.map((l: any) => (
            <div key={l.id} className="card overflow-hidden">
              <Link href={`/property/${l.slug}`} target="_blank" className="block aspect-[16/10] bg-surface-2">
                {l.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img(l.coverUrl, 480)} alt="" className="h-full w-full object-cover" />
                )}
              </Link>
              <div className="space-y-2 p-4">
                <p className="line-clamp-1 font-semibold" data-no-i18n>{l.title}</p>
                <p className="text-sm"><b>{formatPriceShort(l.price)}/mo</b> · <span data-no-i18n>{l.locality.name}</span></p>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Avatar name={l.organization?.name} src={l.organization?.logoUrl} size={22} />
                  <span className="truncate" data-no-i18n>{l.organization?.name}</span>
                  {l.organization?.verification === 'VERIFIED' && <BadgeCheck className="size-3.5 text-emerald-500" />}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <Badge tone="brand">{l.coBrokingSharePct ?? 50}% share</Badge>
                  {l.myRequest ? (
                    <Badge tone={STATUS_TONE[l.myRequest.status]}>{l.myRequest.status}</Badge>
                  ) : (
                    <Button size="sm" onClick={() => request.mutate(l.id)} loading={request.isPending && request.variables === l.id}><Handshake className="size-4" /> Request</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Requests({ box }: { box: 'incoming' | 'outgoing' }) {
  const q = useQuery({ queryKey: ['cobroke', box], queryFn: () => api<any[]>(`/cobroking/requests?box=${box}`) });
  const act = async (id: string, action: string) => {
    try {
      await patch(`/cobroking/requests/${id}`, { action });
      toast.success('Updated');
      q.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  if (q.isLoading) return <Skeleton className="h-40" />;
  if (!q.data?.length) return <Empty icon={<Handshake className="size-6" />} title="कोई request नहीं" text={box === 'incoming' ? 'जब कोई broker आपकी co-broking listing के लिए request करेगा, यहाँ दिखेगी।' : 'Network से listings पर request भेजें।'} />;
  return (
    <div className="space-y-3">
      {q.data.map((r) => {
        const other = box === 'incoming' ? r.requester : r.ownerOrg;
        const phone = other.whatsapp ?? other.phone;
        return (
          <div key={r.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                <span className="text-xs text-muted">{formatDateTime(r.updatedAt)}</span>
              </div>
              <Link href={`/property/${r.listing.slug}`} target="_blank" className="mt-1 block truncate font-semibold hover:text-brand-600" data-no-i18n>{r.listing.title}</Link>
              <p className="text-sm text-muted"><span data-no-i18n>{other.name}</span> · {r.sharePct}% share{r.lead ? <> · lead: <Link className="text-brand-600" href={`/broker/leads/${r.lead.id}`} data-no-i18n>{r.lead.name}</Link></> : null}</p>
              {r.message && <p className="mt-1 text-sm" data-no-i18n>“{r.message}”</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {phone && (r.status === 'ACCEPTED' || r.status === 'CLOSED') && (
                <>
                  <Button size="sm" variant="secondary" href={`tel:${phone}`}><Phone className="size-4" /> Call</Button>
                  <Button size="sm" variant="whatsapp" href={whatsappLink(phone, `नमस्ते, BrokerIQ co-broking: ${r.listing.title}`)} external><MessageCircle className="size-4" /> WhatsApp</Button>
                </>
              )}
              {box === 'incoming' && r.status === 'PENDING' && (
                <>
                  <Button size="sm" onClick={() => act(r.id, 'accept')}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(r.id, 'reject')}>Reject</Button>
                </>
              )}
              {box === 'outgoing' && ['PENDING', 'ACCEPTED'].includes(r.status) && <Button size="sm" variant="ghost" onClick={() => act(r.id, 'cancel')}>वापस लें</Button>}
              {r.status === 'ACCEPTED' && <Button size="sm" variant="secondary" onClick={() => act(r.id, 'close')}>Deal बंद</Button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function NetworkPage() {
  return (
    <Suspense>
      <NetworkInner />
    </Suspense>
  );
}
