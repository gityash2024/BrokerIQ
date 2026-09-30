'use client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { AdminCrud } from '@/components/admin/crud';
import { Badge } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { formatDate } from '@/lib/utils';

const copy = async (text: string) => {
  await navigator.clipboard.writeText(text);
  toast.success('Invite link copy हो गया');
};

export default function Page() {
  const { app } = useConfig();
  const plans = useQuery({ queryKey: ['plans-public'], queryFn: () => api<any[]>('/billing/plans', { auth: false }) });
  const planOptions = [{ value: '', label: 'Default (free plan)' }, ...(plans.data ?? []).map((p: any) => ({ value: p.code, label: `${p.name} (${p.code})` }))];
  return (
    <AdminCrud
      title="Broker invites"
      subtitle={`Invite codes से नए brokers जुड़ते हैं${app.auth.allowBrokerSignup ? ' — अभी open signup भी ON है' : ' — open signup OFF है, इसलिए सिर्फ़ invite से'} · App settings → "नए broker signups" से बदलें`}
      endpoint="/admin/broker-invites"
      canDelete
      deleteLabel="Disable"
      searchKeys={['code', 'note', 'email']}
      itemTitle={(i) => i?.code}
      defaults={{ isActive: true, grantPlanCode: 'BUSINESS', grantMonths: 12, maxUses: 1 }}
      columns={[
        {
          key: 'code',
          label: 'Code',
          render: (r) => (
            <button
              type="button"
              onClick={() => copy(r.link)}
              className="inline-flex items-center gap-1.5 font-mono font-bold hover:text-brand-600"
              title={r.link}
            >
              {r.code} <Copy className="size-3.5" />
            </button>
          ),
        },
        { key: 'by', label: 'By', render: (r) => r.createdByOrg?.name ?? 'Admin' },
        { key: 'grant', label: 'Free plan', render: (r) => (r.grantPlanCode ? `${r.grantPlanCode}${r.grantMonths ? ` · ${r.grantMonths} mo` : ''}` : '—') },
        { key: 'uses', label: 'Used', render: (r) => `${r.uses} / ${r.maxUses}` },
        { key: 'expiresAt', label: 'Expires', render: (r) => (r.expiresAt ? formatDate(r.expiresAt) : 'Never') },
        { key: 'isActive', label: 'Status', render: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Off'}</Badge> },
      ]}
      fields={[
        { key: 'code', label: 'Code', placeholder: 'खाली छोड़ें तो अपने-आप बनेगा', hint: 'CAPITAL letters / numbers', createOnly: true },
        { key: 'note', label: 'Note', placeholder: 'किसके लिए (नाम / firm)' },
        { key: 'email', label: 'Email (optional)' },
        { key: 'grantPlanCode', label: 'Free plan', type: 'select', options: planOptions },
        { key: 'grantMonths', label: 'कितने महीने free', type: 'number', hint: '0 = हमेशा' },
        { key: 'maxUses', label: 'Max uses', type: 'number' },
        { key: 'expiresAt', label: 'Expires on', type: 'date' },
        { key: 'isActive', label: 'Active', type: 'switch' },
      ]}
      toBody={(f, isNew) => ({
        ...(isNew && f.code ? { code: String(f.code).toUpperCase() } : {}),
        note: f.note || null,
        email: f.email || '',
        grantPlanCode: f.grantPlanCode || null,
        grantMonths: Number(f.grantMonths ?? 0),
        maxUses: Math.max(1, Number(f.maxUses ?? 1)),
        expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null,
        isActive: !!f.isActive,
      })}
    />
  );
}
