import type { MetadataRoute } from 'next';
import { sget } from '@/lib/server';
import { SITE_URL } from '@/lib/utils';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await sget<any>('/public/sitemap', 3600);
  const statics = ['', '/rent', '/commercial', '/localities', '/brokers', '/tools', '/for-brokers', '/blog', '/help', '/contact', '/feedback'].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: 'daily' as const,
    priority: p === '' ? 1 : 0.8,
  }));
  if (!data) return statics;
  const map = (arr: any[], prefix: string, priority: number) =>
    arr.map((x) => ({ url: `${SITE_URL}${prefix}/${x.slug}`, lastModified: x.updatedAt, priority }));
  return [
    ...statics,
    ...map(data.localities, '/locality', 0.8),
    ...map(data.brokers, '/brokers', 0.6),
    ...map(data.posts, '/blog', 0.5),
    ...map(data.listings, '/property', 0.6),
    ...(data.seo ?? []).map((slug: string) => ({ url: `${SITE_URL}/rent/${slug}`, changeFrequency: 'daily' as const, priority: 0.7 })),
  ];
}
