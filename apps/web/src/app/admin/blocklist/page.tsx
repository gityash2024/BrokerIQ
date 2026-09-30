'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { del, post, useApiMutation } from '@/lib/hooks';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';
import { ApiErrorState } from '@/components/ui/api-error';

const KINDS = [
  ['EMAIL', 'Email', 'spammer@example.com'],
  ['DOMAIN', 'Email domain', 'tempmail.com'],
  ['PHONE', 'Phone', '98XXXXXXXX'],
  ['IP', 'IP address', '203.0.113.7'],
] as const;

/** Banned identities: they can't sign up, get an OTP, send enquiries or reveal contacts. */
export default function BlocklistPage() {
  const q = useQuery({ queryKey: ['admin-blocklist'], queryFn: () => api<any[]>('/admin/blocklist') });
  const [f, setF] = useState({ kind: 'EMAIL', value: '', reason: '' });
  const add = useApiMutation(() => post<any>('/admin/blocklist', { kind: f.kind, value: f.value, reason: f.reason || undefined }), {
    invalidate: [['admin-blocklist']],
    onSuccess: (r: any) => {
      setF({ ...f, value: '', reason: '' });
      toast.success(
        r.matchingUsers?.length ? `Block हो गया — ${r.matchingUsers.length} मौजूदा account इससे जुड़े हैं; उन्हें Users में block करें` : 'Block हो गया',
      );
    },
  });
  const remove = useApiMutation((id: string) => del(`/admin/blocklist/${id}`), { success: 'हटाया', invalidate: [['admin-blocklist']] });
  const placeholder = KINDS.find((k) => k[0] === f.kind)?.[2];
  return (
    <>
      <PageHeader title="Blocklist" subtitle="यहाँ डाले गए email, domain, phone या IP से signup, OTP, enquiry और contact देखना बंद हो जाता है" />
      <div className="card mb-5 grid gap-3 p-5 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end">
        <Field label="किसे block करें">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {KINDS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Value">
          <Input value={f.value} placeholder={placeholder} onChange={(e) => setF({ ...f, value: e.target.value })} data-no-i18n />
        </Field>
        <Field label="कारण (optional)">
          <Input value={f.reason} placeholder="Spam, fraud, harassment…" onChange={(e) => setF({ ...f, reason: e.target.value })} />
        </Field>
        <Button variant="danger" loading={add.isPending} disabled={f.value.trim().length < 3} onClick={() => add.mutate()}>
          <Ban className="size-4" /> Block
        </Button>
      </div>
      {q.isError ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-48" />
      ) : !q.data.length ? (
        <Empty icon={<Ban className="size-6" />} title="Blocklist खाली है" />
      ) : (
        <div className="card divide-y divide-line">
          {q.data.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <Badge tone="danger">{KINDS.find((k) => k[0] === b.kind)?.[1] ?? b.kind}</Badge>
              <span className="font-mono font-semibold" data-no-i18n>
                {b.value}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted">{b.reason ?? ''}</span>
              <span className="text-xs text-subtle">{formatDateTime(b.createdAt)}</span>
              <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => remove.mutate(b.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
