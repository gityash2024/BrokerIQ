import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { sget } from '@/lib/server';
import { PageShell } from '@/components/site/page-shell';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await sget<any>(`/public/pages/${slug}`, 300);
  return p ? { title: p.metaTitle ?? p.title, description: p.metaDescription ?? undefined } : { title: 'Not found' };
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const p = await sget<any>(`/public/pages/${slug}`, 300);
  if (!p) notFound();
  return (
    <PageShell>
      <article className="container-x max-w-3xl py-14">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{p.title}</h1>
        <div className="prose-cms mt-6" dangerouslySetInnerHTML={{ __html: p.content }} />
      </article>
    </PageShell>
  );
}
