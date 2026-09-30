'use client';
import Link from 'next/link';
import { slugify } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { AdminCrud } from '@/components/admin/crud';
import { Badge } from '@/components/ui/misc';
import { formatDate, img } from '@/lib/utils';

export default function Page() {
  return (
    <AdminCrud
      title="Blog"
      subtitle="Guides और news — SEO traffic का सबसे बड़ा source"
      endpoint="/admin/blog"
      searchKeys={['title', 'slug']}
      loadItem={(id) => api(`/admin/blog/${id}`)}
      defaults={{ isPublished: false, tags: [], content: '' }}
      columns={[
        {
          key: 'title',
          label: 'Post',
          render: (r) => (
            <div className="flex items-center gap-3">
              {r.coverUrl ? (
                 
                <img src={img(r.coverUrl, 120)} alt="" className="size-10 rounded-lg object-cover" />
              ) : (
                <span className="size-10 rounded-lg bg-surface-2" />
              )}
              <div><p className="font-semibold">{r.title}</p><Link href={`/blog/${r.slug}`} target="_blank" className="font-mono text-[11px] text-brand-600">/blog/{r.slug}</Link></div>
            </div>
          ),
        },
        { key: 'isPublished', label: 'Status', render: (r) => <Badge tone={r.isPublished ? 'success' : 'warning'}>{r.isPublished ? 'Published' : 'Draft'}</Badge> },
        { key: 'views', label: 'Views' },
        { key: 'publishedAt', label: 'Published', render: (r) => <span className="text-xs text-muted">{r.publishedAt ? formatDate(r.publishedAt) : '—'}</span> },
      ]}
      fields={[
        { key: 'title', label: 'Title', required: true, wide: true },
        { key: 'slug', label: 'Slug', hint: 'खाली छोड़ें तो title से बनेगा' },
        { key: 'isPublished', label: 'Published', type: 'switch' },
        { key: 'coverUrl', label: 'Cover image', type: 'image' },
        { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
        { key: 'content', label: 'Content', type: 'richtext', required: true },
        { key: 'tags', label: 'Tags', type: 'tags' },
        { key: 'metaTitle', label: 'SEO title' },
        { key: 'metaDescription', label: 'SEO description' },
      ]}
      toBody={(f) => ({ slug: f.slug || slugify(f.title ?? ''), title: f.title, content: f.content, excerpt: f.excerpt || null, coverUrl: f.coverUrl || '', tags: f.tags ?? [], metaTitle: f.metaTitle || null, metaDescription: f.metaDescription || null, isPublished: !!f.isPublished })}
    />
  );
}
