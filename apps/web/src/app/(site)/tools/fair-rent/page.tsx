import type { Metadata } from 'next';
import { PageShell } from '@/components/site/page-shell';
import { FairRentTool } from '@/components/site/fair-rent';

export const metadata: Metadata = {
  title: 'Fair rent in Gurgaon — check rent by sector and BHK',
  description: 'Is the rent fair? See the median and typical rent range for any Gurgaon sector and BHK, from real listings of the last 12 months.',
};

export default function FairRentPage() {
  return (
    <PageShell>
      <section className="mesh-hero py-14 text-white">
        <div className="container-x">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Fair rent checker</h1>
          <p className="mt-2 text-white/75">Sector और BHK चुनें — असली listings से आम किराया देखें।</p>
        </div>
      </section>
      <div className="container-x py-10">
        <FairRentTool />
      </div>
    </PageShell>
  );
}
