import type { Metadata } from 'next';
import { sget } from '@/lib/server';
import { PageShell } from '@/components/site/page-shell';
import { FaqList } from '@/components/site/faq-list';
import { Button } from '@/components/ui/button';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Help & FAQs' };

export default async function HelpPage() {
  const faqs = (await sget<any[]>('/public/faqs', 300)) ?? [];
  return (
    <PageShell>
      <div className="container-x max-w-3xl py-14">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">मदद चाहिए?</h1>
        <p className="mt-2 text-muted">अक्सर पूछे जाने वाले सवाल</p>
        <div className="mt-8">
          <FaqList faqs={faqs} />
        </div>
        <div className="card mt-10 flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-display text-lg font-bold">जवाब नहीं मिला?</p>
          <div className="flex gap-2">
            <Button href="/contact">Contact support</Button>
            <Button href="/feedback" variant="secondary">
              Feedback / feature request
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
