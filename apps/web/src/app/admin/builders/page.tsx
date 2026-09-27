'use client';
import { AdminCrud } from '@/components/admin/crud';
import { Avatar } from '@/components/ui/misc';

export default function Page() {
  return (
    <AdminCrud
      title="Builders"
      subtitle="Developers — project pages पर दिखते हैं"
      endpoint="/admin/builders"
      canDelete={false}
      columns={[
        { key: 'name', label: 'Builder', render: (r) => <span className="flex items-center gap-3 font-semibold"><Avatar name={r.name} src={r.logoUrl} size={32} /> {r.name}</span> },
        { key: 'website', label: 'Website', render: (r) => (r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="text-xs text-brand-600">{r.website}</a> : '—') },
        { key: '_count', label: 'Projects', render: (r) => r._count?.projects ?? 0 },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'website', label: 'Website', placeholder: 'https://' },
        { key: 'logoUrl', label: 'Logo', type: 'image' },
        { key: 'description', label: 'About', type: 'textarea' },
      ]}
      toBody={({ name, website, logoUrl, description }) => ({ name, website: website || '', logoUrl: logoUrl || '', description: description || null })}
    />
  );
}
