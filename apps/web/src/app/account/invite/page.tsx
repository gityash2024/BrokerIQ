'use client';
import { useQuery } from '@tanstack/react-query';
import { Award, Gift, Home, MessageCircle, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { CopyField } from '@/components/panel/integration-card';
import { Button } from '@/components/ui/button';
import { Badge, Skeleton, Stat } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

const BADGE_TEXT: Record<string, string> = { Helper: 'Helper — पहला दोस्त जुड़ा', Connector: 'Connector — 5+ दोस्त', Champion: 'Champion — 20+ दोस्त' };

/** "दोस्तों को बुलाएँ": personal invite link and a thank-you badge (no money involved). */
export default function InvitePage() {
  const q = useQuery({ queryKey: ['my-referral'], queryFn: () => api<any>('/me/referral') });
  const r = q.data;
  const msg = r ? `मैं घर ढूँढने के लिए BrokerIQ इस्तेमाल करता/करती हूँ — verified listings, broker से सीधी बात, सब free। तुम भी देखो: ${r.url}` : '';
  return (
    <>
      <PageHeader title="दोस्तों को बुलाएँ" subtitle="घर ढूँढ रहे दोस्तों, colleagues और family को BrokerIQ भेजें" />
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !r ? (
        <Skeleton className="h-48 max-w-3xl" />
      ) : (
        <div className="grid max-w-4xl gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="card space-y-4 p-6">
            <p className="flex items-center gap-2 font-display font-bold">
              <Gift className="size-5 text-brand-600" /> आपका invite link
            </p>
            <CopyField label="Link" value={r.url} />
            <div className="flex flex-wrap gap-2">
              <Button variant="whatsapp" external href={`https://wa.me/?text=${encodeURIComponent(msg)}`}>
                <MessageCircle className="size-4" /> WhatsApp पर भेजें
              </Button>
            </div>
            <p className="text-xs text-muted">
              Invite code: <b className="font-mono">{r.code}</b> · कोई पैसा या reward नहीं — बस धन्यवाद और profile पर badge 🙏
            </p>
          </div>
          <div className="space-y-3">
            <Stat label="दोस्त जुड़े" value={r.signups} icon={<UserPlus className="size-5" />} />
            <Stat label="Visit की" value={r.visited} icon={<Home className="size-5" />} tone="info" />
            <Stat label="घर मिला (move-in)" value={r.movedIn} icon={<Home className="size-5" />} tone="success" />
            {r.badge && (
              <div className="card flex items-center gap-3 p-4">
                <Award className="size-6 text-amber-500" />
                <Badge tone="warning">{BADGE_TEXT[r.badge] ?? r.badge}</Badge>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
