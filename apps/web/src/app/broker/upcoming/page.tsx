'use client';
import { PLATFORM_MODULES, defaultModulePolicies } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';
import { PageHeader } from '@/components/panel/shell';
export default function Upcoming() {
  const { modules = defaultModulePolicies() } = useConfig();
  return (
    <>
      <PageHeader title="Upcoming features • आने वाली सुविधाएँ" subtitle="आज के काम के लिए पाँच focused modules। बाकी workflows अगले releases में।" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PLATFORM_MODULES.filter((m) => modules[m.key]?.state === 'COMING_SOON' && m.key !== 'legacy').map((m) => (
          <div key={m.key} aria-disabled="true" className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-muted">COMING SOON</p>
            <h2 className="mt-2 font-bold">{m.name}</h2>
            <p className="mt-2 text-sm text-muted">{m.description}</p>
          </div>
        ))}
      </div>
    </>
  );
}
