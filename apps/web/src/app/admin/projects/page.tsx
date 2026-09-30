'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { POSSESSION_LABELS, formatPriceShort } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { AdminCrud } from '@/components/admin/crud';
import { Badge } from '@/components/ui/misc';

export default function Page() {
  const locs = useQuery({ queryKey: ['localities-all'], queryFn: () => api<any[]>('/public/localities', { auth: false }), staleTime: 600_000 });
  const tax = useQuery({ queryKey: ['taxonomies'], queryFn: () => api<any>('/public/taxonomies', { auth: false }), staleTime: 600_000 });
  return (
    <AdminCrud
      title="Projects"
      subtitle="New launches & RERA projects — builders से sponsored placement (Featured) बेचें"
      endpoint="/admin/projects"
      serverSearch
      deleteLabel="Deactivate"
      loadItem={(id) => api(`/admin/projects/${id}`)}
      defaults={{ isActive: true, isFeatured: false, configurations: [], amenities: [], photos: [] }}
      fromItem={(p) => ({ ...p, builderName: p.builder?.name ?? '', possessionDate: p.possessionDate ?? null })}
      columns={[
        {
          key: 'name',
          label: 'Project',
          render: (r) => (
            <div>
              <Link href={`/projects/${r.slug}`} target="_blank" className="font-semibold hover:text-brand-600">
                {r.name}
              </Link>
              <p className="text-xs text-muted">
                {r.builder?.name} · {r.locality?.name}
              </p>
            </div>
          ),
        },
        {
          key: 'price',
          label: 'Price',
          render: (r) => (r.minPrice ? `${formatPriceShort(r.minPrice)}${r.maxPrice ? ` – ${formatPriceShort(r.maxPrice)}` : ''}` : '—'),
        },
        { key: 'possession', label: 'Possession', render: (r) => (r.possession ? POSSESSION_LABELS[r.possession as keyof typeof POSSESSION_LABELS] : '—') },
        { key: '_count', label: 'Enquiries', render: (r) => r._count?.enquiries ?? 0 },
        {
          key: 'flags',
          label: '',
          render: (r) => (
            <>
              {r.isFeatured && <Badge tone="warning">Featured</Badge>} {!r.isActive && <Badge>Inactive</Badge>}
            </>
          ),
        },
      ]}
      fields={[
        { key: 'name', label: 'Project name', required: true },
        { key: 'builderName', label: 'Builder', required: true, hint: 'नया नाम डालने पर builder अपने-आप बनेगा' },
        { key: 'localityId', label: 'Locality', type: 'select', required: true, options: (locs.data ?? []).map((l) => ({ value: l.id, label: l.name })) },
        { key: 'reraNumber', label: 'RERA number' },
        { key: 'possession', label: 'Possession', type: 'select', options: Object.entries(POSSESSION_LABELS).map(([value, label]) => ({ value, label })) },
        { key: 'possessionDate', label: 'Possession date', type: 'date' },
        { key: 'minPrice', label: 'Min price ₹', type: 'number' },
        { key: 'maxPrice', label: 'Max price ₹', type: 'number' },
        { key: 'totalUnits', label: 'Total units', type: 'number' },
        { key: 'landArea', label: 'Land area', placeholder: '12 acres' },
        { key: 'latitude', label: 'Latitude', type: 'number' },
        { key: 'longitude', label: 'Longitude', type: 'number' },
        { key: 'photos', label: 'Photos', type: 'images' },
        { key: 'description', label: 'Description', type: 'richtext' },
        { key: 'configurations', label: 'Configurations (JSON)', type: 'json', hint: '[{"label":"3 BHK","area":1850,"price":24500000}]' },
        {
          key: 'amenities',
          label: 'Amenities (keys)',
          type: 'tags',
          placeholder: (tax.data?.amenities ?? [])
            .slice(0, 4)
            .map((a: any) => a.key)
            .join(', '),
        },
        { key: 'brochureUrl', label: 'Brochure PDF URL', wide: true },
        { key: 'isFeatured', label: 'Featured / sponsored', type: 'switch' },
        { key: 'isActive', label: 'Active', type: 'switch' },
      ]}
      toBody={(f) => ({
        name: f.name,
        builderName: f.builderName,
        localityId: f.localityId,
        reraNumber: f.reraNumber || null,
        description: f.description || null,
        possession: f.possession || null,
        possessionDate: f.possessionDate ? new Date(f.possessionDate).toISOString() : null,
        minPrice: f.minPrice ?? null,
        maxPrice: f.maxPrice ?? null,
        configurations: Array.isArray(f.configurations) ? f.configurations : [],
        amenities: f.amenities ?? [],
        photos: f.photos ?? [],
        brochureUrl: f.brochureUrl || '',
        latitude: f.latitude ?? null,
        longitude: f.longitude ?? null,
        totalUnits: f.totalUnits ?? null,
        landArea: f.landArea || null,
        isFeatured: !!f.isFeatured,
        isActive: !!f.isActive,
      })}
    />
  );
}
