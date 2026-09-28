import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageShell } from '@/components/site/page-shell';
import { ToolsHub } from '@/components/site/tools-hub';

export const metadata: Metadata = { title: 'Rent calculators — rent budget, move-in cost, rent split', description: 'Free rent tools for Gurgaon tenants: how much rent you can afford, total move-in cost with deposit and brokerage, and splitting rent between flatmates.' };

export default function ToolsPage() {
  return (
    <PageShell>
      <section className="mesh-hero py-14 text-white">
        <div className="container-x">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Smart rent tools</h1>
          <p className="mt-2 text-white/75">फ़ैसले से पहले हिसाब — बिल्कुल free।</p>
        </div>
      </section>
      <Suspense>
        <ToolsHub />
      </Suspense>
    </PageShell>
  );
}
