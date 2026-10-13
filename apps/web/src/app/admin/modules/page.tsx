'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PLATFORM_MODULES, defaultModulePolicies, type ModulePolicies, type ModulePolicy } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { PageHeader } from '@/components/panel/shell';
import { toast } from 'sonner';
import { useState } from 'react';

export default function Modules() {
  const queryClient = useQueryClient();
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
  if (isLoading) return <p>Loading modules…</p>;
  if (error) return <p role="alert">{errorMessage(error)}</p>;
  const policies = data ?? defaultModulePolicies();
  return (
    <>
      <PageHeader title="Modules & permissions" subtitle="Active: usable · Coming soon: visible in roadmap · Hidden: absent. Switching off keeps all data." />
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {PLATFORM_MODULES.map((m) => {
          const p = policies[m.key];
          return (
            <div key={m.key} className="flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-48 flex-1">
                <h2 className="font-semibold">{m.name}</h2>
                <p className="text-sm text-muted">{m.description}</p>
              </div>
              <select
                aria-label={`${m.name} state`}
                className="rounded-lg border border-line bg-surface px-3 py-2"
                value={p.state}
                disabled={saving !== null}
                onChange={(e) => save(m.key, { ...p, state: e.target.value as ModulePolicy['state'] })}
              >
                <option value="ACTIVE">Active</option>
                <option value="COMING_SOON">Coming soon</option>
                <option value="HIDDEN">Hidden</option>
              </select>
              {(['SUPER_ADMIN', 'BROKER_ADMIN'] as const).map((role) => (
                <label key={role} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    disabled={saving !== null}
                    checked={p.roles.includes(role)}
                    onChange={(e) => save(m.key, { ...p, roles: e.target.checked ? [...p.roles, role] : p.roles.filter((r) => r !== role) })}
                  />
                  {role === 'SUPER_ADMIN' ? 'Super Admin' : 'Broker'}
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
