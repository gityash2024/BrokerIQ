'use client';
import { useQuery } from '@tanstack/react-query';
import { AdminCrud } from '@/components/admin/crud';
import { Badge } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { SERVICE_LABELS } from '@/components/site/services';

/** Move-in service partners shown to tenants (only real partners — nothing is shown while empty). */
export default function Page() {
  const reqs = useQuery({ queryKey: ['service-requests'], queryFn: () => api<any[]>('/admin/service-requests') });
  return (
    <>
      <AdminCrud
        title="Move-in services"
        subtitle="Packers, furniture rental, broadband, cleaning — tenants callback माँगते हैं, partner को email जाता है"
        endpoint="/admin/services"
        deleteLabel="Disable"
        searchKeys={['name', 'category']}
        defaults={{ isActive: true, category: 'PACKERS', sortOrder: 0 }}
        columns={[
          { key: 'name', label: 'Partner' },
          { key: 'category', label: 'Category', render: (r) => SERVICE_LABELS[r.category] ?? r.category },
          { key: 'offer', label: 'Offer' },
          { key: 'req', label: 'Requests', render: (r) => r._count?.requests ?? 0 },
          { key: 'isActive', label: 'Status', render: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Off'}</Badge> },
        ]}
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'category', label: 'Category', type: 'select', options: Object.entries(SERVICE_LABELS).map(([value, label]) => ({ value, label })) },
          { key: 'logoUrl', label: 'Logo', type: 'image' },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'offer', label: 'Offer (जैसे 10% off)' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email (requests यहाँ जाती हैं)' },
          { key: 'website', label: 'Website' },
          { key: 'sortOrder', label: 'Order', type: 'number' },
          { key: 'isActive', label: 'Active', type: 'switch' },
        ]}
        toBody={(f) => ({
          name: f.name,
          category: f.category,
          logoUrl: f.logoUrl || '',
          description: f.description || null,
          offer: f.offer || null,
          phone: f.phone || null,
          email: f.email || '',
          website: f.website || '',
          sortOrder: Number(f.sortOrder ?? 0),
          isActive: !!f.isActive,
          localityIds: f.localityIds ?? [],
        })}
      />
      <div className="card mt-8 p-5">
        <p className="mb-3 font-display font-bold">Recent requests</p>
        {!reqs.data?.length ? (
          <p className="text-sm text-muted">अभी कोई request नहीं।</p>
        ) : (
          <div className="divide-y divide-line text-sm">
            {reqs.data.slice(0, 50).map((r) => (
              <div key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {r.name} · {r.phone}
                </span>
                <span className="text-muted">
                  {r.partner.name} · {formatDateTime(r.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
