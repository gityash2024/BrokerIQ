import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatINR } from '@brokeriq/shared';
import { API_URL } from '@/lib/utils';
import { PageShell } from '@/components/site/page-shell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Invoice', robots: { index: false, follow: false } };

/** Client-facing invoice: pay the broker directly by UPI (link / QR) or download the PDF. */
export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = process.env.API_INTERNAL_URL || API_URL;
  const res = await fetch(`${base}/api/public/invoices/${token}`, { cache: 'no-store' }).catch(() => null);
  if (!res?.ok) notFound();
  const inv = await res.json();
  const items = (inv.items ?? []) as { description: string; amount: number }[];
  const paid = inv.status === 'PAID';
  return (
    <PageShell>
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-brand-700 to-violet-600 p-6 text-white">
            <p className="text-sm text-white/80">Invoice {inv.number}</p>
            <p className="mt-1 font-display text-2xl font-extrabold" data-no-i18n>{inv.org.name}</p>
            <p className="mt-4 font-display text-4xl font-black">{formatINR(inv.total)}</p>
            {inv.dueDate && !paid && <p className="mt-1 text-sm text-white/80">Due {new Date(inv.dueDate).toLocaleDateString('en-IN')}</p>}
          </div>
          <div className="space-y-4 p-6">
            <p className="text-sm">
              Billed to <b data-no-i18n>{inv.clientName}</b>
            </p>
            <div className="divide-y divide-line rounded-xl border border-line text-sm">
              {items.map((i, idx) => (
                <div key={idx} className="flex justify-between gap-3 px-4 py-2.5">
                  <span data-no-i18n>{i.description}</span>
                  <span className="font-semibold">{formatINR(i.amount)}</span>
                </div>
              ))}
              {inv.gstPct > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-muted">
                  <span>GST {inv.gstPct}%</span>
                  <span>{formatINR(inv.total - inv.subtotal)}</span>
                </div>
              )}
            </div>
            {paid ? (
              <p className="rounded-xl bg-emerald-50 p-4 text-center font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">✓ Paid{inv.paidAt ? ` on ${new Date(inv.paidAt).toLocaleDateString('en-IN')}` : ''}</p>
            ) : inv.upi ? (
              <div className="space-y-3 text-center">
                <a href={inv.upi} className="block rounded-2xl bg-emerald-600 px-5 py-4 font-bold text-white shadow-lg hover:bg-emerald-700">UPI app से pay करें</a>
                { }
                <img src={`${API_URL}/api/public/invoices/${token}/qr`} alt="UPI QR" className="mx-auto size-52 rounded-xl border border-line bg-white p-2" />
                <p className="text-xs text-muted">किसी भी UPI app (GPay, PhonePe, Paytm) से QR scan करें · UPI ID: <span data-no-i18n>{inv.org.upiId}</span></p>
              </div>
            ) : (
              <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Payment के लिए broker से संपर्क करें{inv.org.phone ? `: ${inv.org.phone}` : ''}।</p>
            )}
            <a href={`${API_URL}/api/public/invoices/${token}/pdf`} target="_blank" rel="noreferrer" className="block text-center text-sm font-semibold text-brand-600 hover:underline">
              PDF download करें
            </a>
            <p className="text-center text-xs text-subtle">पैसा सीधे broker को जाता है — BrokerIQ payment नहीं रखता।</p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
