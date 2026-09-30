'use client';
import Link from 'next/link';
import { AdminCrud } from '@/components/admin/crud';
import { Badge } from '@/components/ui/misc';
import { formatDate } from '@/lib/utils';

export default function Page() {
  return (
    <AdminCrud
      title="Pages"
      subtitle="About, Terms, Privacy जैसे static pages — /p/<slug> पर दिखते हैं (Markdown / HTML)"
      endpoint="/admin/pages"
      searchKeys={['title', 'slug']}
      defaults={{ isPublished: true, content: '' }}
      columns={[
        { key: 'title', label: 'Title', render: (r) => <span className="font-semibold">{r.title}</span> },
        {
          key: 'slug',
          label: 'URL',
          render: (r) => (
            <Link href={`/p/${r.slug}`} target="_blank" className="font-mono text-xs text-brand-600">
              /p/{r.slug}
            </Link>
          ),
        },
        {
          key: 'isPublished',
          label: 'Status',
          render: (r) => <Badge tone={r.isPublished ? 'success' : 'warning'}>{r.isPublished ? 'Published' : 'Draft'}</Badge>,
        },
        { key: 'updatedAt', label: 'Updated', render: (r) => <span className="text-xs text-muted">{formatDate(r.updatedAt)}</span> },
      ]}
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'slug', label: 'Slug', required: true, placeholder: 'about-us', hint: 'lowercase, hyphens' },
        { key: 'content', label: 'Content', type: 'richtext', required: true },
        { key: 'metaTitle', label: 'SEO title' },
        { key: 'metaDescription', label: 'SEO description' },
        { key: 'isPublished', label: 'Published', type: 'switch' },
      ]}
      toBody={({ id, createdAt, updatedAt, ...f }) => (void id, void createdAt, void updatedAt, f)}
    />
  );
}
