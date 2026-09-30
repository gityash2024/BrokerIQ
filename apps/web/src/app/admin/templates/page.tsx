'use client';
import { AdminCrud } from '@/components/admin/crud';
import { Badge } from '@/components/ui/misc';
import { formatDate } from '@/lib/utils';

export default function Page() {
  return (
    <AdminCrud
      title="Message templates"
      subtitle="OTP, welcome, listing approved, invite, alerts — सारे emails / push messages यहाँ से edit करें। Variables: {{app.siteName}}, {{name}}, {{code}}, {{link}} …"
      endpoint="/admin/templates"
      canDelete={false}
      searchKeys={['key', 'name']}
      defaults={{ channel: 'EMAIL', isActive: true }}
      columns={[
        {
          key: 'name',
          label: 'Template',
          render: (r) => (
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="font-mono text-[11px] text-muted">{r.key}</p>
            </div>
          ),
        },
        {
          key: 'channel',
          label: 'Channel',
          render: (r) => <Badge tone={r.channel === 'EMAIL' ? 'info' : r.channel === 'WHATSAPP' ? 'success' : 'brand'}>{r.channel}</Badge>,
        },
        { key: 'subject', label: 'Subject', render: (r) => <span className="line-clamp-1 text-xs">{r.subject ?? '—'}</span> },
        { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? '✅' : 'Default') },
        { key: 'updatedAt', label: 'Updated', render: (r) => <span className="text-xs text-muted">{formatDate(r.updatedAt)}</span> },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'key', label: 'Key', required: true, createOnly: true, placeholder: 'custom.promo' },
        {
          key: 'channel',
          label: 'Channel',
          type: 'select',
          options: [
            { value: 'EMAIL', label: 'Email' },
            { value: 'WHATSAPP', label: 'WhatsApp' },
            { value: 'PUSH', label: 'Push' },
          ],
        },
        { key: 'isActive', label: 'Active (off = built-in default)', type: 'switch' },
        { key: 'subject', label: 'Subject', wide: true },
        { key: 'body', label: 'Body (HTML allowed for email)', type: 'richtext', required: true },
      ]}
      toBody={(f, isNew) => ({
        ...(isNew ? { key: f.key } : {}),
        name: f.name,
        channel: f.channel,
        subject: f.subject || null,
        body: f.body,
        isActive: !!f.isActive,
      })}
    />
  );
}
