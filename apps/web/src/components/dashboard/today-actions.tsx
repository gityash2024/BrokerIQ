'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ShieldCheck, ShieldAlert, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ApiErrorState } from '@/components/ui/api-error';

export function TodayActions() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['broker-today'], queryFn: () => api<any>('/broker/today'), refetchInterval: 60000 });
  const kyc = useQuery({
    queryKey: ['agent-kyc-mine-today'],
    queryFn: () => api<any>('/broker/team/agent-kyc/mine'),
    refetchInterval: 60000,
    enabled: user?.role === 'BROKER_AGENT',
  });
  const kycStatus = kyc.data?.status;

  return (
    <>
      {user?.role === 'BROKER_AGENT' && kycStatus !== 'VERIFIED' && (
        <div className="card p-5 border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20 mb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
                {kycStatus === 'PENDING' ? <Clock className="size-5" /> : <ShieldAlert className="size-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-fg">Agent KYC Verification</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      kycStatus === 'PENDING'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        : kycStatus === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}
                  >
                    {kycStatus === 'PENDING' ? 'Under Review' : kycStatus === 'REJECTED' ? 'Rejected' : 'Action Required'}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  {kycStatus === 'PENDING'
                    ? 'Your Aadhaar, PAN and Face Liveliness check have been submitted and are under review by your Broker Admin.'
                    : kycStatus === 'REJECTED'
                      ? `Verification was rejected (${kyc.data?.rejectionNote || 'Needs updated documents'}). Please review and re-submit.`
                      : 'Please submit your 12-digit Aadhaar, 10-char PAN and complete the 3-step Face Liveliness camera check to verify your account.'}
                </p>
              </div>
            </div>
            <Link
              href="/broker/kyc"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition shrink-0 self-start sm:self-center"
            >
              {kycStatus === 'PENDING' ? 'View KYC Status' : 'Complete Verification'} <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}

      <h2 className="font-display text-lg font-bold">Today’s next actions</h2>
      {q.error && <ApiErrorState error={q.error} onRetry={() => q.refetch()} />}
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          ['Follow-ups', q.data?.followUps, '/broker/follow-ups'],
          ['Site visits', q.data?.visits, '/broker/visits'],
        ].map(([label, items, href]) => (
          <section key={String(label)} className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">{String(label)}</h3>
              <Link className="text-xs font-semibold text-brand-600" href={String(href)}>
                View all ↗
              </Link>
            </div>
            {items === undefined ? (
              <p className="text-xs text-muted">Loading…</p>
            ) : (items as any[]).length ? (
              (items as any[]).map((item) => (
                <Link key={item.id} href={`/broker/leads/${item.lead.id}`} className="mb-2 flex justify-between gap-3 rounded-xl bg-surface-2 p-3">
                  <div>
                    <p className="text-sm font-semibold">{item.lead.name}</p>
                    <p className="mt-1 text-xs text-muted">{item.note || item.status.replace(/_/g, ' ')}</p>
                  </div>
                  <time className="text-xs text-muted">
                    {new Date(item.dueAt || item.scheduledAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                  </time>
                </Link>
              ))
            ) : (
              <p className="rounded-xl bg-surface-2 p-5 text-sm text-muted">Nothing scheduled. Add the next action from a lead.</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
