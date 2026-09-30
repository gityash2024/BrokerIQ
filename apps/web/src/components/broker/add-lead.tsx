'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LEAD_SOURCE_LABELS, PROPERTY_TYPE_LABELS } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { post, useApiMutation } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Chip, Field, Input, Select, Textarea } from '../ui/field';
import { useTeam } from './bits';

const MANUAL_SOURCES = ['MANUAL', 'CALL', 'WALK_IN', 'REFERRAL', 'HOUSING', 'ACRES99', 'MAGICBRICKS', 'NOBROKER', 'FACEBOOK', 'INSTAGRAM', 'WHATSAPP'] as const;

export function AddLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const team = useTeam();
  const { data: locs } = useQuery({
    queryKey: ['localities-all'],
    queryFn: () => api<any[]>('/public/localities', { auth: false }),
    staleTime: 600_000,
    enabled: open,
  });
  const [f, setF] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'MANUAL',
    assignedToId: '',
    notes: '',
    purpose: 'RENT',
    types: [] as string[],
    localityIds: [] as string[],
    minBudget: '',
    maxBudget: '',
    bedrooms: [] as number[],
  });
  const m = useApiMutation(
    () =>
      post<any>('/leads', {
        name: f.name,
        phone: f.phone,
        email: f.email || null,
        source: f.source,
        notes: f.notes || null,
        assignedToId: f.assignedToId || null,
        requirement: {
          purpose: f.purpose,
          propertyTypes: f.types,
          localityIds: f.localityIds,
          minBudget: f.minBudget ? Number(f.minBudget) : null,
          maxBudget: f.maxBudget ? Number(f.maxBudget) : null,
          bedrooms: f.bedrooms,
        },
      }),
    {
      success: 'Lead add हो गई',
      invalidate: [['leads'], ['broker-dashboard'], ['kanban']],
      onSuccess: (l) => {
        onOpenChange(false);
        setF({ ...f, name: '', phone: '', email: '', notes: '' });
        router.push(`/broker/leads/${l.id}`);
      },
    },
  );
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="नई lead"
      size="lg"
      footer={
        <Button onClick={() => m.mutate(undefined)} loading={m.isPending} disabled={!f.name || !f.phone}>
          Save lead
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="नाम" required>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Mobile" required>
          <Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Source">
          <Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
            {MANUAL_SOURCES.map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        {user?.role === 'BROKER_ADMIN' && (
          <Field label="Assign to" className="sm:col-span-2">
            <Select value={f.assignedToId} onChange={(e) => setF({ ...f, assignedToId: e.target.value })}>
              <option value="">Unassigned (automation decide करेगा)</option>
              {team.data?.members
                .filter((m: any) => m.status === 'ACTIVE')
                .map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="mt-6 space-y-4 rounded-2xl bg-surface-2 p-4">
        <p className="text-sm font-bold">Requirement</p>
        <div className="flex flex-wrap gap-2">
          {['APARTMENT', 'BUILDER_FLOOR', 'VILLA', 'PG', 'OFFICE', 'SHOP'].map((t) => (
            <Chip key={t} active={f.types.includes(t)} onClick={() => setF({ ...f, types: toggle(f.types, t) })}>
              {PROPERTY_TYPE_LABELS[t as keyof typeof PROPERTY_TYPE_LABELS]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((b) => (
            <Chip key={b} active={f.bedrooms.includes(b)} onClick={() => setF({ ...f, bedrooms: toggle(f.bedrooms, b) })}>
              {b} BHK
            </Chip>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            inputMode="numeric"
            placeholder="Min budget (₹)"
            value={f.minBudget}
            onChange={(e) => setF({ ...f, minBudget: e.target.value.replace(/\D/g, '') })}
          />
          <Input
            inputMode="numeric"
            placeholder="Max budget (₹)"
            value={f.maxBudget}
            onChange={(e) => setF({ ...f, maxBudget: e.target.value.replace(/\D/g, '') })}
          />
        </div>
        <Select value="" onChange={(e) => e.target.value && setF({ ...f, localityIds: toggle(f.localityIds, e.target.value) })}>
          <option value="">+ Preferred locality जोड़ें</option>
          {locs?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        {f.localityIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {f.localityIds.map((id) => (
              <Chip key={id} active onClick={() => setF({ ...f, localityIds: toggle(f.localityIds, id) })}>
                {locs?.find((l) => l.id === id)?.name} ✕
              </Chip>
            ))}
          </div>
        )}
        <Textarea placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
    </Dialog>
  );
}
