'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PLATFORM_MODULES, defaultModulePolicies, type ModulePolicies, type ModulePolicy } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { ApiErrorState } from '@/components/ui/api-error';
import { Input } from '@/components/ui/field';
import { Skeleton, Badge } from '@/components/ui/misc';
import { Search, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/panel/shell';
import { toast } from 'sonner';
import { useState } from 'react';

export default function Modules() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [state, setState] = useState('ALL');
  const [saving, setSaving] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['modules'], queryFn: () => api<ModulePolicies>('/admin/modules') });
  async function save(key: string, policy: ModulePolicy) {
    setSaving(key);
    try {
      await api(`/admin/modules/${key}`, { method: 'PATCH', body: policy });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['modules'] }), queryClient.invalidateQueries({ queryKey: ['public-config'] })]);
      toast.success('Module updated');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(null);
    }
  }
  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ApiErrorState error={error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['modules'] })} />;
  const policies = { ...defaultModulePolicies(), ...data };
  const visible = PLATFORM_MODULES.filter(
    (m) => `${m.name} ${m.description}`.toLowerCase().includes(search.toLowerCase()) && (state === 'ALL' || policies[m.key]?.state === state),
  );
  return (
    <>
      <PageHeader title="Modules & permissions" subtitle="Active: usable · Coming soon: visible in roadmap · Hidden: absent. Switching off keeps all data." />
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="min-w-0 flex-1">
          <Input
            icon={<Search className="size-4" />}
            aria-label="Search modules"
            placeholder="Search modules & permissions…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          aria-label="Filter module state"
          value={state}
          onChange={(event) => setState(event.target.value)}
          className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm"
        >
          <option value="ALL">All states</option>
          <option value="ACTIVE">Active</option>
          <option value="COMING_SOON">Coming soon</option>
          <option value="HIDDEN">Hidden</option>
        </select>
        <Badge>{visible.length} modules</Badge>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((m) => {
          const p = policies[m.key];
          return (
            <section key={m.key} className="card flex flex-col gap-4 p-5">
              <div className="min-w-0 flex-1">
                <h2 className="flex items-start gap-2 font-display font-bold">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" />
                  {m.name}
                </h2>
                <p className="text-sm text-muted">{m.description}</p>
              </div>
              <select
                aria-label={`${m.name} state`}
                className="min-h-11 rounded-xl border border-line bg-surface px-3 py-2 text-sm"
                value={p.state}
                disabled={saving !== null}
                onChange={(e) => save(m.key, { ...p, state: e.target.value as ModulePolicy['state'] })}
              >
                <option value="ACTIVE">Active</option>
                <option value="COMING_SOON">Coming soon</option>
                <option value="HIDDEN">Hidden</option>
              </select>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                {(['SUPER_ADMIN', 'BROKER_ADMIN', 'BROKER_AGENT', 'USER', 'MODERATOR', 'SUPPORT'] as const).map((role) => (
                  <label key={role} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-surface-2 px-3 text-xs">
                    <input
                      type="checkbox"
                      disabled={saving !== null}
                      checked={p.roles.includes(role)}
                      onChange={(e) => save(m.key, { ...p, roles: e.target.checked ? [...p.roles, role] : p.roles.filter((r) => r !== role) })}
                    />
                    {
                      {
                        SUPER_ADMIN: 'Super Admin',
                        BROKER_ADMIN: 'Broker Admin',
                        BROKER_AGENT: 'Broker Agent',
                        USER: 'Customer',
                        MODERATOR: 'Moderator',
                        SUPPORT: 'Support',
                      }[role]
                    }
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
