import type { Metadata } from 'next';
import { sget } from '@/lib/server';
import { PageShell } from '@/components/site/page-shell';
import { BrokerLanding } from '@/components/site/broker-landing';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'BrokerIQ for brokers — all portal leads + WhatsApp automation in one CRM',
  description:
    'Housing.com, 99acres, MagicBricks, Facebook और WhatsApp की सारी leads एक app में। Auto WhatsApp replies, follow-ups, team, AI scanner. Free plan से शुरू करें।',
};

export default async function ForBrokersPage() {
  const [plans, faqs] = await Promise.all([sget<any[]>('/billing/plans', 300), sget<any[]>('/public/faqs?category=brokers', 300)]);
  return (
    <PageShell transparentHeader>
      <BrokerLanding plans={plans ?? []} faqs={faqs ?? []} />
    </PageShell>
  );
}
