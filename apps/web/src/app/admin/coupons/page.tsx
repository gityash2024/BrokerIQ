'use client';
import { AdminCrud } from '@/components/admin/crud';
import { Badge } from '@/components/ui/misc';
import { formatDate } from '@/lib/utils';

export default function Page() {
  return (
    <AdminCrud
      title="Coupons"
      subtitle="Launch offers, broker referrals — plan checkout पर लागू होते हैं"
      endpoint="/admin/coupons"
      canDelete={false}
      searchKeys={['code']}
      itemTitle={(i) => i?.code}
      defaults={{ isActive: true }}
      columns={[
        { key: 'code', label: 'Code', render: (r) => <span className="font-mono font-bold">{r.code}</span> },
        { key: 'off', label: 'Discount', render: (r) => (r.percentOff ? `${r.percentOff}%` : r.amountOff ? `₹${r.amountOff}` : '—') },
        { key: 'redeemed', label: 'Used', render: (r) => `${r.redeemed}${r.maxRedemptions ? ` / ${r.maxRedemptions}` : ''}` },
        { key: 'validUntil', label: 'Valid till', render: (r) => (r.validUntil ? formatDate(r.validUntil) : 'No expiry') },
        { key: 'isActive', label: 'Status', render: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Off'}</Badge> },
      ]}
      fields={[
        { key: 'code', label: 'Code', required: true, placeholder: 'LAUNCH50', hint: 'CAPITAL letters, numbers, - _' },
        { key: 'percentOff', label: '% off', type: 'number' },
        { key: 'amountOff', label: '₹ off (flat)', type: 'number' },
        { key: 'maxRedemptions', label: 'Max uses', type: 'number' },
        { key: 'validUntil', label: 'Valid until', type: 'date' },
        { key: 'isActive', label: 'Active', type: 'switch' },
      ]}
      toBody={(f) => ({ code: String(f.code ?? '').toUpperCase(), percentOff: f.percentOff ?? null, amountOff: f.amountOff ?? null, maxRedemptions: f.maxRedemptions ?? null, validUntil: f.validUntil ? new Date(f.validUntil).toISOString() : null, isActive: !!f.isActive })}
    />
  );
}
