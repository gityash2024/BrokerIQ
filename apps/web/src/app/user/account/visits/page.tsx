'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, MessageCircle, Phone, Wallet } from 'lucide-react';
import { formatINR, whatsappLink } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { formatDate, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { VideoJoin } from '@/components/site/video-join';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';

const TOKEN_TONE: Record<string, any> = { CLAIMED: 'warning', RECEIVED: 'success', REFUNDED: 'info', CANCELLED: 'neutral' };
const TOKEN_LABEL: Record<string, string> = { CLAIMED: 'Broker की पुष्टि बाकी', RECEIVED: 'Broker ने पुष्टि की', REFUNDED: 'Refund', CANCELLED: 'Cancelled' };

export default function MyVisitsPage() {
  const visits = useQuery({ queryKey: ['my-visits'], queryFn: () => api<any[]>('/me/visits') });
  const tokens = useQuery({ queryKey: ['my-tokens'], queryFn: () => api<any[]>('/me/tokens'), enabled: false });
  const cancel = useApiMutation((id: string) => patch(`/me/visits/${id}/cancel`), { success: 'Visit cancel हुई', invalidate: [['my-visits']] });
  return (
    <>
      <PageHeader title="My site visits" subtitle="Your upcoming visits and booking history" />
      <h2 className="mb-3 font-display text-lg font-bold">Site visits</h2>
      {visits.isLoading ? (
        <Skeleton className="h-32" />
      ) : !visits.data?.length ? (
        <Empty
          icon={<CalendarCheck className="size-6" />}
          title="अभी कोई visit नहीं"
          text="किसी भी broker listing पर 'Visit book करें' दबाकर खाली समय चुनें।"
        />
      ) : (
        <div className="space-y-3">
          {visits.data.map((v) => {
            const upcoming = new Date(v.scheduledAt) > new Date() && ['SCHEDULED', 'CONFIRMED'].includes(v.status);
            const phone = v.organization?.whatsapp ?? v.organization?.phone;
            return (
              <div key={v.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={upcoming ? 'brand' : v.status === 'CANCELLED' ? 'neutral' : 'success'}>{upcoming ? 'Upcoming' : v.status}</Badge>
                    <span className="font-semibold">{formatDateTime(v.scheduledAt)}</span>
                    {v.mode === 'VIDEO' && <Badge tone="info">Video visit</Badge>}
                  </div>
                  {v.listing && (
                    <Link href={`/user/property/${v.listing.slug}`} className="mt-1 block truncate text-sm text-brand-600 hover:underline" data-no-i18n>
                      {v.listing.title}
                    </Link>
                  )}
                  <p className="text-xs text-muted">
                    <span data-no-i18n>{v.address}</span> · <span data-no-i18n>{v.organization?.name}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {upcoming && <VideoJoin visit={v} />}
                  {phone && (
                    <Button size="sm" variant="secondary" href={`tel:${phone}`}>
                      <Phone className="size-4" /> Call
                    </Button>
                  )}
                  {phone && (
                    <Button size="sm" variant="whatsapp" href={whatsappLink(phone, `नमस्ते, site visit ${formatDateTime(v.scheduledAt)} के बारे में`)} external>
                      <MessageCircle className="size-4" /> WhatsApp
                    </Button>
                  )}
                  {upcoming && (
                    <Button size="sm" variant="ghost" onClick={() => confirm('Visit cancel करें?') && cancel.mutate(v.id)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
