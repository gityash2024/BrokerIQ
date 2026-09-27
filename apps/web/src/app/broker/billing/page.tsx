'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Check, Crown, Download, FileText, Rocket, Sparkles, TicketPercent } from 'lucide-react';
import { formatINR } from '@brokeriq/shared';
import { ApiError, api, errorMessage } from '@/lib/api';
import { post, useApiMutation } from '@/lib/hooks';
import { payWithRazorpay } from '@/lib/razorpay';
import { cn, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, PageLoader } from '@/components/ui/misc';
import { ApiErrorState, IntegrationBanner } from '@/components/ui/api-error';

const METERS: { key: string; label: string }[] = [
  { key: 'leadsPerMonth', label: 'Leads इस महीने' },
  { key: 'activeListings', label: 'Active listings' },
  { key: 'agents', label: 'Team members' },
  { key: 'aiCredits', label: 'AI credits (इस महीने)' },
  { key: 'automations', label: 'Active automations' },
  { key: 'connectors', label: 'Portal connectors' },
];

const fmtLimit = (n: number) => (n >= 100000 ? 'Unlimited' : n.toLocaleString('en-IN'));

export default function BillingPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['billing'], queryFn: () => api<any>('/broker/billing') });
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<any[]>('/billing/plans', { auth: false }) });
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [coupon, setCoupon] = useState('');
  const [paying, setPaying] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState<ApiError | null>(null);
  const cancel = useApiMutation((v: boolean) => post('/broker/billing/cancel', { cancel: v }), { success: (r: any) => (r.cancelAtPeriodEnd ? 'Period end पर plan बंद होगा' : 'Auto-renew वापस चालू'), invalidate: [['billing']] });

  const buy = async (code: string) => {
    setPaying(code);
    setNotConfigured(null);
    try {
      const order = await post<any>('/broker/billing/checkout', { planCode: code, cycle, coupon: coupon || undefined });
      const ok = await payWithRazorpay(order);
      if (ok) {
        toast.success('Payment successful 🎉 Plan upgrade हो गया');
        qc.invalidateQueries({ queryKey: ['billing'] });
        qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
      }
    } catch (e) {
      if (e instanceof ApiError && e.isNotConfigured) setNotConfigured(e);
      else toast.error(errorMessage(e));
    } finally {
      setPaying(null);
    }
  };

  const invoice = async (id: string, number: string) => {
    try {
      const res = await api<Response>(`/billing/payments/${id}/invoice`, { raw: true });
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${number}.pdf`;
      a.click();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const sub = d.subscription;
  const current = sub?.plan?.code ?? d.limits.plan;

  return (
    <>
      <PageHeader title="Plan & billing" subtitle="Plan upgrade करें, usage देखें और GST invoices download करें" />
      {notConfigured?.body.integration && <div className="mb-5"><IntegrationBanner name={notConfigured.body.integration.name} message={notConfigured.body.message} /></div>}
      {!d.razorpayReady && !notConfigured && (
        <div className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Online payment अभी platform पर चालू नहीं है (Super Admin ने Razorpay नहीं जोड़ा)। Upgrade के लिए support से संपर्क करें।</div>
      )}

      <div className="mb-8 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-brand-950 to-brand-800 p-6 text-white">
          <div className="absolute -right-16 -bottom-16 size-56 rounded-full bg-saffron-400/20 blur-3xl" />
          <p className="text-sm text-white/70">Current plan</p>
          <p className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold"><Crown className="size-7 text-saffron-400" /> {sub?.plan?.name ?? 'Free'}</p>
          {sub && (
            <div className="mt-4 space-y-1 text-sm text-white/80">
              <p>Status: <b className="text-white">{sub.status}</b> · {sub.billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly'}</p>
              {sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date() && <p>Trial ends {formatDate(sub.trialEndsAt)}</p>}
              {sub.currentPeriodEnd && <p>{sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'} on {formatDate(sub.currentPeriodEnd)}</p>}
            </div>
          )}
          {sub && sub.plan?.priceMonthly > 0 && (
            <Button size="sm" variant="secondary" className="mt-5 border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => cancel.mutate(!sub.cancelAtPeriodEnd)} loading={cancel.isPending}>
              {sub.cancelAtPeriodEnd ? 'Auto-renew चालू करें' : 'Period end पर cancel करें'}
            </Button>
          )}
        </div>
        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          {METERS.map((m, i) => {
            const used = d.usage?.[m.key] ?? 0;
            const limit = d.limits.limits[m.key] ?? 0;
            const pct = limit >= 100000 ? 4 : Math.min(100, (used / Math.max(1, limit)) * 100);
            return (
              <div key={m.key}>
                <div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold">{m.label}</span><span className="text-muted">{used.toLocaleString('en-IN')} / {fmtLimit(limit)}</span></div>
                <div className="h-2 rounded-full bg-surface-2">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.05, duration: 0.6 }} className={cn('h-full rounded-full', pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-brand-600')} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold">Plans</h2>
        <div className="flex items-center gap-2">
          <Input icon={<TicketPercent className="size-4" />} value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" className="h-10 w-44" />
          <Segmented size="sm" value={cycle} onChange={setCycle} options={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'YEARLY', label: 'Yearly (बचत)' }]} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(plans.data ?? []).map((p, i) => {
          const price = cycle === 'YEARLY' ? p.priceYearly : p.priceMonthly;
          const isCurrent = p.code === current;
          const save = p.priceMonthly > 0 && p.priceYearly > 0 ? Math.round((1 - p.priceYearly / (p.priceMonthly * 12)) * 100) : 0;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className={cn('card relative flex flex-col p-5', p.isPopular && 'border-brand-400 ring-4 ring-brand-500/10')}>
              {p.isPopular && <Badge tone="brand" className="absolute -top-3 left-5 shadow"><Sparkles className="size-3" /> Most popular</Badge>}
              <p className="font-display text-lg font-bold">{p.name}</p>
              {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
              <p className="mt-4 font-display text-3xl font-extrabold">{price > 0 ? formatINR(price) : '₹0'}<span className="text-sm font-semibold text-muted">/{cycle === 'YEARLY' ? 'year' : 'month'}</span></p>
              {cycle === 'YEARLY' && save > 0 && <p className="text-xs font-semibold text-emerald-600">{save}% बचत</p>}
              {price > 0 && <p className="text-[11px] text-subtle">+ {d.gstPercent ?? 18}% GST</p>}
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {(p.features as string[]).map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /> {f}</li>)}
              </ul>
              <Button className="mt-5" variant={isCurrent ? 'secondary' : p.isPopular ? 'primary' : 'secondary'} disabled={isCurrent || price <= 0 || !!paying} loading={paying === p.code} onClick={() => buy(p.code)}>
                {isCurrent ? 'Current plan' : price <= 0 ? 'Free' : <><Rocket className="size-4" /> Upgrade</>}
              </Button>
            </motion.div>
          );
        })}
      </div>

      <h2 className="mt-10 mb-4 font-display text-xl font-extrabold">Payments & invoices</h2>
      {d.payments.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold text-subtle uppercase">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">For</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {d.payments.map((p: any) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{formatDate(p.paidAt ?? p.createdAt)}</td>
                  <td className="px-4 py-3">{p.purpose === 'BOOST' ? `Listing boost · ${p.meta?.weeks ?? 1} week` : `Subscription · ${p.billingCycle?.toLowerCase() ?? ''}`}</td>
                  <td className="px-4 py-3 font-semibold">{formatINR(p.amount / 100)}</td>
                  <td className="px-4 py-3"><Badge tone={p.status === 'PAID' ? 'success' : p.status === 'FAILED' ? 'danger' : 'neutral'}>{p.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {p.status === 'PAID' && p.invoiceNumber && (
                      <Button size="xs" variant="ghost" onClick={() => invoice(p.id, p.invoiceNumber)}><Download className="size-3.5" /> {p.invoiceNumber}</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card flex items-center gap-3 p-5 text-sm text-muted"><FileText className="size-5" /> अभी कोई payment नहीं</div>
      )}
    </>
  );
}
