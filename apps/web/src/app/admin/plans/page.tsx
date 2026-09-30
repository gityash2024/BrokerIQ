'use client';
import { formatINR } from '@brokeriq/shared';
import { AdminCrud } from '@/components/admin/crud';
import { Badge } from '@/components/ui/misc';

const LIMITS = [
  ['agents', 'Team members'],
  ['activeListings', 'Active listings'],
  ['leadsPerMonth', 'Leads / month'],
  ['aiCredits', 'AI credits / month'],
  ['automations', 'Automations'],
  ['connectors', 'Portal connectors'],
] as const;

export default function Page() {
  return (
    <AdminCrud
      title="Plans & pricing"
      subtitle="Broker subscription plans — /for-brokers pricing page और billing पर तुरंत लागू। 100000+ limit = Unlimited"
      endpoint="/admin/plans"
      canDelete={false}
      defaults={{
        isActive: true,
        isPopular: false,
        sortOrder: 0,
        trialDays: 0,
        features: [],
        priceMonthly: 0,
        priceYearly: 0,
        limits: { agents: 1, activeListings: 10, leadsPerMonth: 100, aiCredits: 20, automations: 1, connectors: 1 },
      }}
      columns={[
        {
          key: 'name',
          label: 'Plan',
          render: (r) => (
            <div>
              <p className="font-semibold">
                {r.name} {r.isPopular && <Badge tone="brand">Popular</Badge>}
              </p>
              <p className="font-mono text-[11px] text-muted">{r.code}</p>
            </div>
          ),
        },
        { key: 'priceMonthly', label: 'Monthly', render: (r) => formatINR(r.priceMonthly) },
        { key: 'priceYearly', label: 'Yearly', render: (r) => formatINR(r.priceYearly) },
        {
          key: 'limits',
          label: 'Limits',
          render: (r) => (
            <span className="text-xs text-muted">
              {r.limits.agents} agents · {r.limits.activeListings} listings · {r.limits.aiCredits} AI
            </span>
          ),
        },
        { key: '_count', label: 'Subscribers', render: (r) => r._count?.subscriptions ?? 0 },
        { key: 'isActive', label: 'Status', render: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Hidden'}</Badge> },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'code', label: 'Code', required: true, createOnly: true, placeholder: 'PRO', hint: 'CAPITAL letters' },
        { key: 'description', label: 'Short description', wide: true },
        { key: 'priceMonthly', label: 'Price / month ₹', type: 'number', required: true },
        { key: 'priceYearly', label: 'Price / year ₹', type: 'number', required: true },
        ...LIMITS.map(([k, label]) => ({ key: `limits.${k}`, label, type: 'number' as const })),
        { key: 'features', label: 'Feature bullets', type: 'tags' },
        { key: 'trialDays', label: 'Trial days', type: 'number' },
        { key: 'sortOrder', label: 'Sort order', type: 'number' },
        { key: 'isPopular', label: 'Most popular badge', type: 'switch' },
        { key: 'isActive', label: 'Visible', type: 'switch' },
      ]}
      toBody={(f, isNew) => ({
        ...(isNew ? { code: String(f.code ?? '').toUpperCase() } : {}),
        name: f.name,
        description: f.description || null,
        priceMonthly: Number(f.priceMonthly ?? 0),
        priceYearly: Number(f.priceYearly ?? 0),
        limits: Object.fromEntries(LIMITS.map(([k]) => [k, Number(f.limits?.[k] ?? 0)])),
        features: f.features ?? [],
        trialDays: f.trialDays ?? 0,
        sortOrder: f.sortOrder ?? 0,
        isPopular: !!f.isPopular,
        isActive: !!f.isActive,
      })}
    />
  );
}
