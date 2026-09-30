import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CalendarCheck, Eye, MessageCircle, MessageSquare, Share2 } from 'lucide-react';
import { LISTING_STATUS_LABELS, formatINR, timeAgo, whatsappLink } from '@brokeriq/shared';
import { sget } from '@/lib/server';
import { img, formatDate } from '@/lib/utils';
import { Avatar, Badge, Logo } from '@/components/ui/misc';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Property report', robots: { index: false, follow: false } };

/** Read-only report a broker shares with a property owner: views, enquiries (names masked), visits, lease. */
export default async function OwnerReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await sget<any>(`/public/owner-report/${encodeURIComponent(token)}`, 0);
  if (!r) notFound();
  const totals = r.listings.reduce(
    (t: any, l: any) => ({ views: t.views + l.views, enquiries: t.enquiries + l.enquiries30d, visits: t.visits + l.visitsDone }),
    { views: 0, enquiries: 0, visits: 0 },
  );
  return (
    <main className="min-h-screen bg-surface-2 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="card flex items-center gap-4 p-5">
          <Avatar name={r.firm.name} src={r.firm.logoUrl} size={56} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Property report</p>
            <h1 className="font-display text-xl font-extrabold">
              नमस्ते <span data-no-i18n>{r.owner.name}</span> जी
            </h1>
            <p className="text-sm text-muted">
              <span data-no-i18n>{r.firm.name}</span> आपकी property को ऐसे promote कर रहा है · {formatDate(r.generatedAt)}
            </p>
          </div>
          {r.firm.phone && (
            <a
              href={whatsappLink(r.firm.phone, `नमस्ते, मैं ${r.owner.name} — मेरी property के बारे में बात करनी है।`)}
              target="_blank"
              rel="noopener"
              className="hidden items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white sm:flex"
            >
              <MessageCircle className="size-4" /> Broker से बात करें
            </a>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            ['Views', totals.views, Eye],
            ['Enquiries (30 दिन)', totals.enquiries, MessageSquare],
            ['Visits हुईं', totals.visits, CalendarCheck],
          ].map(([label, value, Icon]: any) => (
            <div key={label} className="card p-4 text-center">
              <Icon className="mx-auto size-5 text-brand-600" />
              <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>

        {r.listings.map((l: any) => (
          <div key={l.id} className="card overflow-hidden sm:flex">
            <div className="h-40 bg-surface-2 sm:h-auto sm:w-48 sm:shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.coverUrl && <img src={img(l.coverUrl, 480)} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/property/${l.slug}`} className="font-semibold hover:text-brand-600" data-no-i18n>
                  {l.title}
                </Link>
                <Badge tone={l.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {LISTING_STATUS_LABELS[l.status as keyof typeof LISTING_STATUS_LABELS] ?? l.status}
                </Badge>
              </div>
              <p className="text-sm text-muted">
                {formatINR(l.price)}/month · {l.locality}
                {l.publishedAt ? ` · ${timeAgo(l.publishedAt)} से live` : ''}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <span>
                  <b>{l.views}</b> views
                </span>
                <span>
                  <b>{l.enquiries30d}</b> enquiries
                </span>
                <span>
                  <b>{l.visitsDone}</b> visits{l.visitsUpcoming ? ` (+${l.visitsUpcoming})` : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Share2 className="size-3.5" /> <b>{l.shareOpens}</b> shares खुले
                </span>
              </div>
              {l.tenancy && (
                <p className="mt-3 rounded-xl bg-emerald-50 p-2.5 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                  किराये पर: {formatINR(l.tenancy.rent)}/month · {formatDate(l.tenancy.startDate)} → {formatDate(l.tenancy.endDate)}
                </p>
              )}
            </div>
          </div>
        ))}
        {!r.listings.length && <p className="card p-6 text-center text-sm text-muted">अभी कोई property नहीं जुड़ी है।</p>}

        {r.recentEnquiries.length > 0 && (
          <div className="card p-5">
            <p className="mb-3 font-display font-bold">हाल की enquiries</p>
            <ul className="divide-y divide-line text-sm">
              {r.recentEnquiries.map((e: any, i: number) => (
                <li key={i} className="flex justify-between py-2">
                  <span data-no-i18n>{e.name}</span>
                  <span className="text-muted">
                    {e.wantsVisit ? 'Visit चाहिए · ' : ''}
                    {timeAgo(e.at)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Privacy के लिए tenants के पूरे नाम और numbers नहीं दिखाए जाते।</p>
          </div>
        )}
        <Link href="/" className="flex items-center justify-center gap-2 text-xs text-muted">
          Powered by <Logo className="h-4" />
        </Link>
      </div>
    </main>
  );
}
