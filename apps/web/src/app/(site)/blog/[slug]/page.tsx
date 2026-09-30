import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { sget } from '@/lib/server';
import { formatDate, img } from '@/lib/utils';
import { PageShell } from '@/components/site/page-shell';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await sget<any>(`/public/blog/${slug}`, 300);
  if (!p) return { title: 'Not found' };
  return { title: p.metaTitle ?? p.title, description: p.metaDescription ?? p.excerpt ?? undefined, openGraph: { images: p.coverUrl ? [p.coverUrl] : undefined, type: 'article' } };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const p = await sget<any>(`/public/blog/${slug}`, 300);
  if (!p) notFound();
  return (
    <PageShell>
      <article className="container-x max-w-3xl py-12">
        <p className="text-sm text-muted">
          {formatDate(p.publishedAt)} {p.author?.name ? `· ${p.author.name}` : ''}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight font-extrabold tracking-tight">{p.title}</h1>
        {p.coverUrl && (
           
          <img src={img(p.coverUrl, 1400)} alt="" className="mt-8 w-full rounded-3xl" />
        )}
        <div className="prose-cms mt-8" dangerouslySetInnerHTML={{ __html: p.content }} />
      </article>
    </PageShell>
  );
}
