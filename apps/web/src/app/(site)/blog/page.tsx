import Link from 'next/link';
import type { Metadata } from 'next';
import { Newspaper } from 'lucide-react';
import { sget } from '@/lib/server';
import { formatDate, img } from '@/lib/utils';
import { PageShell } from '@/components/site/page-shell';
import { Empty } from '@/components/ui/misc';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Gurgaon real estate guides & news', description: 'Property buying guides, locality insights and real-estate news for Gurgaon.' };

export default async function BlogPage() {
  const data = await sget<any>('/public/blog', 300);
  const items = data?.items ?? [];
  const [first, ...rest] = items;
  return (
    <PageShell>
      <div className="container-x py-12">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Guides & news</h1>
        <p className="mt-2 text-muted">Gurgaon real estate की ताज़ा जानकारी</p>
        {!items.length ? (
          <Empty className="mt-10" icon={<Newspaper className="size-6" />} title="जल्द ही articles आएँगे" text="Super Admin → CMS → Blog से posts लिखें।" />
        ) : (
          <>
            <Link href={`/blog/${first.slug}`} className="group card mt-10 grid overflow-hidden md:grid-cols-2">
              <div className="aspect-[16/10] bg-gradient-to-br from-brand-100 to-saffron-100 dark:from-brand-950 dark:to-surface-2">
                {first.coverUrl && (
                   
                  <img src={img(first.coverUrl, 1000)} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex flex-col justify-center p-8">
                <p className="text-xs text-muted">{formatDate(first.publishedAt)}</p>
                <h2 className="mt-2 font-display text-2xl font-extrabold group-hover:text-brand-600">{first.title}</h2>
                {first.excerpt && <p className="mt-3 text-muted">{first.excerpt}</p>}
              </div>
            </Link>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {rest.map((p: any) => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="group card overflow-hidden">
                  <div className="aspect-[16/9] bg-surface-2">
                    {p.coverUrl && (
                       
                      <img src={img(p.coverUrl, 600)} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-muted">{formatDate(p.publishedAt)}</p>
                    <h3 className="mt-1 font-display font-bold group-hover:text-brand-600">{p.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
