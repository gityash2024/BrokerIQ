import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { sget } from '@/lib/server';
import { PageShell } from '@/components/site/page-shell';
import { BrokerCard } from '@/components/site/cards';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/misc';

export const revalidate = 120;
export const metadata: Metadata = {
  title: 'Top real estate brokers in Gurgaon',
  description: 'Verified, highly-rated property brokers and agencies in Gurgaon with active listings and reviews.',
};

export default async function BrokersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const data = await sget<any>(`/brokers?${new URLSearchParams(sp).toString()}`, 60);
  const items = data?.items ?? [];
  return (
    <PageShell>
      <section className="mesh-hero py-16 text-white">
        <div className="container-x flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight">Gurgaon के भरोसेमंद brokers</h1>
            <p className="mt-2 text-white/75">Verified agencies, ratings और live listings — अपने इलाके का expert चुनें।</p>
          </div>
          <Button href="/for-brokers" variant="accent">
            Broker के रूप में जुड़ें
          </Button>
        </div>
      </section>
      <div className="container-x py-10">
        {items.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((b: any) => (
              <BrokerCard key={b.id} b={b} />
            ))}
          </div>
        ) : (
          <Empty icon={<Users className="size-6" />} title="जल्द ही brokers जुड़ेंगे" action={<Button href="/signup?type=broker">पहले broker बनें</Button>} />
        )}
      </div>
    </PageShell>
  );
}
