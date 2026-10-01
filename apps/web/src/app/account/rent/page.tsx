'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Home, MessageCircle, Receipt, Smartphone } from 'lucide-react';
import { formatINR, whatsappLink } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { formatDate, img } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "मेरा किराया": the tenant's active lease(s) — due date, owner's UPI, rent receipts (for HRA). */
export default function MyRentPage() {
  const q = useQuery({ queryKey: ['my-rent'], queryFn: () => api<any[]>('/me/rent') });
  return (
    <>
      <PageHeader title="मेरा किराया" subtitle="Due date, सीधे owner को UPI payment और हर महीने की rent receipt (HRA के लिए)" />
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-48" />
      ) : !q.data.length ? (
        <Empty
          icon={<Home className="size-6" />}
          title="अभी कोई lease नहीं जुड़ा"
          text="आपके broker ने आपका lease BrokerIQ पर जोड़ा है तो वो यहाँ अपने-आप दिखेगा (आपके mobile number या email से)।"
        />
      ) : (
        <div className="space-y-5">
          {q.data.map((t) => (
            <div key={t.id} className="card overflow-hidden">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                {t.listing?.coverUrl && <img src={img(t.listing.coverUrl, 240)} alt="" className="h-20 w-28 rounded-xl object-cover" />}
                <div className="min-w-0 flex-1">
                  {t.listing ? (
                    <Link href={`/property/${t.listing.slug}`} className="font-semibold hover:text-brand-600" data-no-i18n>
                      {t.listing.title}
                    </Link>
                  ) : (
                    <p className="font-semibold">Lease</p>
                  )}
                  <p className="text-sm text-muted">
                    {formatINR(t.rent)}/month{t.rentDueDay ? ` · हर महीने ${t.rentDueDay} तारीख` : ''} · {formatDate(t.startDate)} → {formatDate(t.endDate)}
                  </p>
                  <p className="text-xs text-muted">
                    Broker: <span data-no-i18n>{t.broker.name}</span>
                    {t.owner ? (
                      <>
                        {' '}
                        · Owner: <span data-no-i18n>{t.owner.name}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <Badge tone={t.paidThisMonth ? 'success' : 'warning'}>
                  {monthLabel(t.currentMonth)}: {t.paidThisMonth ? 'Paid ✓' : 'Due'}
                </Badge>
              </div>
              {!t.paidThisMonth && t.upiId && (
                <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/60 px-5 py-3 text-sm">
                  <Smartphone className="size-4 text-brand-600" />
                  <span>
                    Owner का UPI: <b data-no-i18n>{t.upiId}</b>
                  </span>
                  <Button size="xs" variant="ghost" onClick={() => (navigator.clipboard?.writeText(t.upiId), toast.success('UPI ID copy हुआ'))}>
                    <Copy className="size-3.5" /> Copy
                  </Button>
                  {t.upiLink && (
                    <Button size="xs" href={t.upiLink} className="sm:hidden">
                      UPI app से pay करें
                    </Button>
                  )}
                  {t.broker.phone && (
                    <Button
                      size="xs"
                      variant="whatsapp"
                      external
                      href={whatsappLink(t.broker.phone, `नमस्ते, ${monthLabel(t.currentMonth)} का किराया भेज दिया है।`)}
                      className="ml-auto"
                    >
                      <MessageCircle className="size-3.5" /> Pay करके broker को बताएँ
                    </Button>
                  )}
                </div>
              )}
              <div className="border-t border-line px-5 py-3">
                <p className="mb-2 text-sm font-semibold">Rent receipts</p>
                {!t.payments.length ? (
                  <p className="text-sm text-muted">अभी कोई receipt नहीं — किराया मिलने पर broker/owner &ldquo;paid&rdquo; mark करते ही receipt यहाँ आएगी।</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {t.payments.map((p: any) => (
                      <Button key={p.id} size="sm" variant="secondary" href={p.receiptUrl} external>
                        <Receipt className="size-4" /> {monthLabel(p.month)} · {formatINR(p.amount)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
