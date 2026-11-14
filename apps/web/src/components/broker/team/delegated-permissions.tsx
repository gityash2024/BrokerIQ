'use client';
import { delegableModules, delegatedGrant } from '@brokeriq/shared';
import { useConfig, useConfigStatus } from '@/lib/config';

export function DelegatedPermissions({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const { modules } = useConfig();
  const { loaded } = useConfigStatus();
  if (!loaded) return <p className="text-sm text-muted">Loading available permissions…</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Choose individual actions. Unchecked actions remain restricted.</p>
      {delegableModules(modules).map((module) => (
        <fieldset key={module.key} className="rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-semibold">{module.name}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {module.actions.map((action) => {
              const grant = delegatedGrant(module.key, action);
              return (
                <label key={grant} className="flex items-center gap-2 text-sm capitalize">
                  <input type="checkbox" checked={value.includes(grant)}
                    onChange={(e) => onChange(e.target.checked ? [...value, grant] : value.filter((item) => item !== grant))} />
                  {action}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
