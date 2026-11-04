'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Search, Clock3 } from 'lucide-react';
import { defaultModulePolicies, moduleAllowed } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';
import { PageHeader } from '@/components/panel/shell';
import { Input } from '@/components/ui/field';
import { adminToolGroups } from '@/components/admin/admin-tools';

export default function SystemPage() {
  const [search, setSearch] = useState('');
  const { modules } = useConfig();
  const policies = { ...defaultModulePolicies(), ...modules };
  const filtered = adminToolGroups
    .map((group) => ({
      ...group,
      tools: group.tools.filter(
        (tool) =>
          (!tool.module || policies[tool.module]?.state !== 'HIDDEN') &&
          `${tool.title} ${tool.description} ${group.title}`.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((group) => group.tools.length);
  return (
    <div className="space-y-6">
      <PageHeader
        title="System workspace"
        subtitle="Every administrative tool, organized around the work. Core navigation stays focused; supporting controls remain discoverable here."
      />
      <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <Input
            aria-label="Search administrative tools"
            icon={<Search className="size-4" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tools, source review, users…"
          />
        </div>
        <p className="text-xs text-muted">{filtered.reduce((count, group) => count + group.tools.length, 0)} tools · Permission-aware access</p>
      </div>
      {filtered.map((group) => (
        <section key={group.title}>
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
            <group.icon className="size-5 text-brand-600" />
            {group.title}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.tools.map((tool) => {
              const available = !tool.module || moduleAllowed(policies, tool.module, 'SUPER_ADMIN');
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-bold">{tool.title}</h3>
                    {available ? <ArrowUpRight className="size-4 shrink-0 text-brand-600" /> : <Clock3 className="size-4 shrink-0 text-muted" />}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted">{tool.description}</p>
                  {!available && (
                    <span className="mt-3 inline-block rounded-md bg-surface-2 px-2 py-1 text-[10px] font-semibold text-muted">
                      {policies[tool.module!]?.state === 'COMING_SOON' ? 'Coming soon · Disabled' : 'Access restricted'}
                    </span>
                  )}
                </>
              );
              return available ? (
                <Link key={tool.href} href={tool.href} className="card p-5 transition hover:border-brand-300 hover:shadow-[var(--shadow-lift)]">
                  {content}
                </Link>
              ) : (
                <article key={tool.href} aria-disabled="true" className="rounded-2xl border border-dashed border-line bg-surface/60 p-5">
                  {content}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {!filtered.length && <p className="card p-12 text-center text-sm text-muted">No tools match this search.</p>}
    </div>
  );
}
