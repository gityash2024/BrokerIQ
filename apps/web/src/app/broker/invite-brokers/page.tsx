'use client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Gift, MessageCircle, Trophy, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Empty, PageLoader } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

export default function InviteBrokersPage() {
  const q = useQuery({ queryKey: ['referrals'], queryFn: () => api<any>('/broker/referrals') });
  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copy हो गया`);
  };
  const message = d.link
    ? `नमस्ते! मैं अपनी सारी leads (Housing, 99acres, Facebook) और WhatsApp follow-ups BrokerIQ पर manage करता हूँ। आप भी जुड़िए — मेरा invite link: ${d.link}`
    : '';
  return (
    <>
      <PageHeader
        title="Brokers को invite करें"
        subtitle="अपने जान-पहचान वाले brokers को BrokerIQ पर लाइए — co-broking network जितना बड़ा, सबको उतनी ज़्यादा inventory"
      />
      {!d.enabled || !d.link ? (
        <Empty icon={<UserPlus className="size-6" />} title="Broker referrals अभी बंद हैं" text="BrokerIQ team इसे जल्द चालू करेगी।" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 p-6 text-white">
              <div className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-3xl" />
              <Gift className="size-8" />
              <p className="mt-3 font-display text-2xl font-extrabold">आपका invite code</p>
              <p className="mt-1 font-mono text-3xl font-black tracking-widest" data-no-i18n>
                {d.code}
              </p>
              {d.grant && (
                <p className="mt-2 text-sm text-white/85">
                  आपके link से जुड़ने वाले broker को {d.grant.planCode} plan {d.grant.months ? `${d.grant.months} महीने` : 'हमेशा'} free मिलेगा।
                </p>
              )}
              <p className="mt-1 text-xs text-white/70">{d.usesLeft} invites बाकी</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" variant="accent" onClick={() => copy(d.link, 'Invite link')}>
                  <Copy className="size-4" /> Link copy करें
                </Button>
                <Button size="sm" variant="secondary" href={`https://wa.me/?text=${encodeURIComponent(message)}`} external>
                  <MessageCircle className="size-4" /> WhatsApp पर भेजें
                </Button>
              </div>
            </div>
            <div className="card p-5">
              <p className="font-display font-bold">आपके जोड़े हुए brokers ({d.joined.length})</p>
              {d.joined.length === 0 ? (
                <p className="mt-2 text-sm text-muted">अभी कोई नहीं — link share कीजिए।</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {d.joined.map((o: any) => (
                    <li key={o.id} className="flex items-center gap-3 py-2.5">
                      <Avatar name={o.name} src={o.logoUrl} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold" data-no-i18n>
                          {o.name}
                        </p>
                        <p className="text-xs text-muted">जुड़े {formatDate(o.createdAt)}</p>
                      </div>
                      {o.verification === 'VERIFIED' && <Badge tone="success">Verified</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="card h-fit p-5">
            <p className="flex items-center gap-2 font-display font-bold">
              <Trophy className="size-5 text-saffron-500" /> Top inviters
            </p>
            {d.leaderboard.length === 0 ? (
              <p className="mt-2 text-sm text-muted">पहले inviter बनिए!</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {d.leaderboard.map((r: any, i: number) => (
                  <li key={r.org.id} className="flex items-center gap-3">
                    <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-xs font-bold">{i + 1}</span>
                    <Avatar name={r.org.name} src={r.org.logoUrl} size={30} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold" data-no-i18n>
                      {r.org.name}
                    </span>
                    <Badge>{r.count}</Badge>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
