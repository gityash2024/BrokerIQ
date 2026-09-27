'use client';
import { AdminCrud } from '@/components/admin/crud';
import { Badge } from '@/components/ui/misc';

export default function Page() {
  return (
    <AdminCrud
      title="Amenities"
      subtitle="Listing form और search filters में दिखने वाली amenities"
      endpoint="/admin/amenities"
      canDelete={false}
      searchKeys={['label', 'key']}
      itemTitle={(i) => i?.label}
      defaults={{ category: 'society', sortOrder: 0, isActive: true }}
      columns={[
        { key: 'label', label: 'Amenity', render: (r) => <div><p className="font-semibold">{r.label}</p><p className="font-mono text-[11px] text-muted">{r.key}</p></div> },
        { key: 'category', label: 'Category', render: (r) => <Badge>{r.category}</Badge> },
        { key: 'icon', label: 'Icon' },
        { key: 'sortOrder', label: 'Order' },
        { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? '✅' : '—') },
      ]}
      fields={[
        { key: 'label', label: 'Label', required: true },
        { key: 'key', label: 'Key', required: true, placeholder: 'swimming_pool' },
        { key: 'category', label: 'Category', type: 'select', options: [{ value: 'society', label: 'Society' }, { value: 'flat', label: 'Flat' }, { value: 'commercial', label: 'Commercial' }] },
        { key: 'icon', label: 'Icon (lucide name)', placeholder: 'waves' },
        { key: 'sortOrder', label: 'Sort order', type: 'number' },
        { key: 'isActive', label: 'Active', type: 'switch' },
      ]}
      toBody={({ key, label, category, icon, sortOrder, isActive }) => ({ key, label, category: category || 'society', icon: icon || null, sortOrder: sortOrder ?? 0, isActive: !!isActive })}
    />
  );
}
