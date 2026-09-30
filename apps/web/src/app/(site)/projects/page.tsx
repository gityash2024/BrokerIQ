import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { requireSaleListings, sget } from '@/lib/server';
import { PageShell } from '@/components/site/page-shell';
import { ProjectCard } from '@/components/site/cards';
import { Empty } from '@/components/ui/misc';

export const revalidate = 300;
export const metadata: Metadata = { title: 'New projects in Gurgaon — RERA registered launches', description: 'New launch and under-construction residential & commercial projects in Gurgaon with prices, configurations, RERA details and brochures.' };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireSaleListings();
  const sp = await searchParams;
  const qs = new URLSearchParams(sp).toString();
  const projects = (await sget<any[]>(`/public/projects${qs ? `?${qs}` : ''}`, 120)) ?? [];
  return (
    <PageShell>
      <section className="mesh-hero py-16 text-white">
        <div className="container-x">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">New projects in Gurgaon</h1>
          <p className="mt-2 text-white/75">RERA registered launches — prices, configurations, possession और brochures।</p>
        </div>
      </section>
      <div className="container-x py-10">
        {projects.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <Empty icon={<Building2 className="size-6" />} title="Projects जल्द आ रहे हैं" text="Super Admin → Master Data → Projects से नए projects जोड़े जा सकते हैं।" />
        )}
      </div>
    </PageShell>
  );
}
