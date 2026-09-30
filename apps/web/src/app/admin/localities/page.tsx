'use client';
import Link from 'next/link';
import { formatPriceShort } from '@brokeriq/shared';
import { AdminCrud } from '@/components/admin/crud';
import { Badge } from '@/components/ui/misc';

export default function Page() {
  return (
    <AdminCrud
      title="Localities"
      subtitle="Gurgaon के sectors / इलाके — search filters, locality guides, map और price trends इन्हीं से बनते हैं"
      endpoint="/admin/localities"
      serverSearch
      canDelete
      defaults={{ isActive: true, isPopular: false, highlights: [] }}
      columns={[
        {
          key: 'name',
          label: 'Locality',
          render: (r) => (
            <div>
              <Link href={`/locality/${r.slug}`} target="_blank" className="font-semibold hover:text-brand-600">
                {r.name}
              </Link>
              <p className="text-xs text-muted">
                {r.zone ?? '—'} · {r.pincode ?? ''}
              </p>
            </div>
          ),
        },
        { key: 'avgPriceSale', label: 'Avg ₹/sqft', render: (r) => (r.avgPriceSale ? `₹${Math.round(r.avgPriceSale).toLocaleString('en-IN')}` : '—') },
        { key: 'avgRent2Bhk', label: '2BHK rent', render: (r) => (r.avgRent2Bhk ? formatPriceShort(r.avgRent2Bhk) : '—') },
        { key: '_count', label: 'Live listings', render: (r) => `${r._count?.listings ?? 0} · ${r._count?.projects ?? 0} projects` },
        {
          key: 'flags',
          label: '',
          render: (r) => (
            <>
              {r.isPopular && <Badge tone="warning">Popular</Badge>} {!r.isActive && <Badge>Inactive</Badge>}
            </>
          ),
        },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true, placeholder: 'Sector 65' },
        { key: 'zone', label: 'Zone', placeholder: 'Golf Course Extension Road' },
        { key: 'latitude', label: 'Latitude', type: 'number', required: true },
        { key: 'longitude', label: 'Longitude', type: 'number', required: true },
        { key: 'pincode', label: 'Pincode' },
        { key: 'slug', label: 'Slug', hint: 'खाली = auto' },
        { key: 'avgPriceSale', label: 'Avg sale price ₹/sqft', type: 'number' },
        { key: 'avgRent2Bhk', label: 'Avg 2BHK rent ₹', type: 'number' },
        { key: 'coverUrl', label: 'Cover photo', type: 'image' },
        { key: 'description', label: 'Locality guide', type: 'richtext' },
        { key: 'highlights', label: 'Highlights', type: 'tags', placeholder: 'Metro 2km, Golf course view …' },
        { key: 'isPopular', label: 'Popular (homepage)', type: 'switch' },
        { key: 'isActive', label: 'Active', type: 'switch' },
      ]}
      toBody={(f) => ({
        name: f.name,
        zone: f.zone || null,
        latitude: Number(f.latitude),
        longitude: Number(f.longitude),
        pincode: f.pincode || null,
        ...(f.slug ? { slug: f.slug } : {}),
        avgPriceSale: f.avgPriceSale ?? null,
        avgRent2Bhk: f.avgRent2Bhk ?? null,
        coverUrl: f.coverUrl || '',
        description: f.description || null,
        highlights: f.highlights ?? [],
        isPopular: !!f.isPopular,
        isActive: !!f.isActive,
      })}
    />
  );
}
