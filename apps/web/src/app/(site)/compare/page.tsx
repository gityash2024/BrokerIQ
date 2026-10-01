import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageShell } from '@/components/site/page-shell';
import { CompareView } from '@/components/site/compare-view';

export const metadata: Metadata = { title: 'Compare homes', robots: { index: false } };

export default function ComparePage() {
  return (
    <PageShell>
      <div className="container-x py-10">
        <h1 className="mb-6 font-display text-3xl font-extrabold">घरों की तुलना</h1>
        <Suspense>
          <CompareView />
        </Suspense>
      </div>
    </PageShell>
  );
}
