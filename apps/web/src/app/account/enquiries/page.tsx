'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Phone, Send } from 'lucide-react';
import { formatPriceShort, whatsappLink } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { formatDateTime, img } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Badge, Empty } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';

function Inner() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<'sent' | 'received'>(sp.get('tab') === 'received' ? 'received' : 'sent');
  const q = useQuery({ queryKey: ['enquiries', tab], queryFn: () => api<any[]>(`/enquiries/${tab}`) });
  const status = useApiMutation((v: { id: string; status: string }) => patch(`/enquiries/${v.id}`, { status: v.status }), { invalidate: [['enquiries', 'received']] });
  return (
    <>
      <PageHeader title="Enquiries" actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'sent', label: 'मैंने भेजीं' }, { value: 'received', label: 'मेरी listings पर आईं' }]} />} />
      {!q.data?.length ? (
        <Empty icon={<Send className="size-6" />} title={tab === 'sent' ? 'अभी कोई enquiry नहीं भेजी' : 'अभी कोई enquiry नहीं आई'} />
      ) : (
        <div className="space-y-3">
          {q.data.map((e) => (
            <div key={e.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              {e.listing?.coverUrl && (
                 
                <img src={img(e.listing.coverUrl, 200)} alt="" className="h-20 w-28 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                {e.listing ? (
                  <Link href={`/property/${e.listing.slug}`} className="font-semibold hover:text-brand-600">{e.listing.title}</Link>
                ) : e.project ? (
                  <Link href={`/projects/${e.project.slug}`} className="font-semibold">{e.project.name}</Link>
                ) : (
                  <p className="font-semibold">{e.organization?.name}</p>
                )}
                {tab === 'received' ? (
                  <p className="text-sm text-muted">{e.name} · {e.phone}{e.message ? ` — ${e.message}` : ''}</p>
                ) : (
                  <p className="text-sm text-muted">{e.listing?.price ? `${formatPriceShort(e.listing.price)} · ` : ''}{e.organization?.name ?? 'Owner'}</p>
                )}
                <p className="mt-1 text-xs text-subtle">{formatDateTime(e.createdAt)}{e.wantsVisit ? ' · 🏠 Site visit requested' : ''}</p>
              </div>
              {tab === 'received' ? (
                <div className="flex items-center gap-2">
                  <Button size="icon-sm" variant="secondary" href={`tel:${e.phone}`}><Phone className="size-4" /></Button>
                  <Button size="icon-sm" variant="whatsapp" href={whatsappLink(e.phone, `Hi ${e.name}, आपकी enquiry "${e.listing?.title ?? ''}" के बारे में`)} external><MessageCircle className="size-4" /></Button>
                  <Select className="h-9 w-36 text-xs" value={e.status} onChange={(ev) => status.mutate({ id: e.id, status: ev.target.value })}>
                    <option value="NEW">New</option>
                    <option value="RESPONDED">Responded</option>
                    <option value="CLOSED">Closed</option>
                  </Select>
                </div>
              ) : (
                <Badge tone={e.status === 'NEW' ? 'info' : e.status === 'RESPONDED' ? 'success' : 'neutral'}>{e.status === 'NEW' ? 'Sent' : e.status === 'RESPONDED' ? 'Responded' : 'Closed'}</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
export default function EnquiriesPage() {
  return <Suspense><Inner /></Suspense>;
}
