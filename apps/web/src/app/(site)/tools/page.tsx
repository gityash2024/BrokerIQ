import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageShell } from '@/components/site/page-shell';
import { ToolsHub } from '@/components/site/tools-hub';

export const metadata: Metadata = { title: 'Property calculators — EMI, affordability, Haryana stamp duty, rent vs buy', description: 'Free home-loan EMI calculator, affordability checker, Haryana stamp duty & registration calculator and rent-vs-buy comparison for Gurgaon buyers.' };

export default function ToolsPage() {
  return (
    <PageShell>
      <section className="mesh-hero py-14 text-white">
        <div className="container-x">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Smart property tools</h1>
          <p className="mt-2 text-white/75">फ़ैसले से पहले हिसाब — बिल्कुल free।</p>
        </div>
      </section>
      <Suspense>
        <ToolsHub />
      </Suspense>
    </PageShell>
  );
}
