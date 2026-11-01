'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Pop from '@radix-ui/react-popover';
import { Search } from 'lucide-react';
import { inventoryTitle, moduleAllowed, type LedgerItem } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig, useConfigStatus } from '@/lib/config';
import { useDebounced } from '@/lib/hooks';

interface Result {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}
export function QuickLeadSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q.trim(), 250);
  const { user } = useAuth();
  const { modules } = useConfig();
  const { loaded } = useConfigStatus();
  const leadsAllowed = loaded && !!user && moduleAllowed(modules, 'leads', user.role);
  const inventoryAllowed = loaded && !!user && moduleAllowed(modules, 'inventory', user.role);
  const searches = [
    {
      key: 'leads',
      label: 'Contacts & leads',
      allowed: leadsAllowed,
      path: `/leads?q=${encodeURIComponent(dq)}&pageSize=5`,
      map: (item: any): Result => ({ id: item.id, title: item.name, subtitle: item.phone, href: `/broker/leads/${item.id}` }),
    },
    {
      key: 'inventory',
      label: 'Inventory',
      allowed: inventoryAllowed,
      path: `/inventory?search=${encodeURIComponent(dq)}&pageSize=5`,
      map: (item: LedgerItem): Result => ({
        id: item.id,
        title: inventoryTitle(item),
        subtitle: item.sector ?? undefined,
        href: `/broker/inventory?item=${item.id}`,
      }),
    },
    {
      key: 'requirements',
      label: 'Requirements',
      allowed: leadsAllowed,
      path: `/broker-requirements?search=${encodeURIComponent(dq)}&pageSize=5`,
      map: (item: any): Result => ({
        id: item.id,
        title: item.title || item.contactName || 'Requirement',
        subtitle: item.intent,
        href: `/broker/leads/requirements?record=${item.id}`,
      }),
    },
  ].filter((search) => search.allowed);
  const query = useQuery({
    queryKey: ['workspace-search', user?.id, dq, leadsAllowed, inventoryAllowed],
    enabled: open && dq.length >= 2 && searches.length > 0,
    queryFn: async () =>
      Promise.all(
        searches.map(async (search) => {
          try {
            const data = await api<{ items: any[] }>(search.path);
            return { key: search.key, label: search.label, items: data.items.slice(0, 5).map(search.map), error: false };
          } catch {
            return { key: search.key, label: search.label, items: [] as Result[], error: true };
          }
        }),
      ),
  });
  return (
    <Pop.Root open={open && dq.length >= 2} onOpenChange={setOpen}>
      <Pop.Anchor asChild>
        <div className="relative w-full max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            aria-label="Search your workspace"
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            placeholder="Search leads, inventory, requirements…"
            className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:bg-surface"
          />
        </div>
      </Pop.Anchor>
      <Pop.Portal>
        <Pop.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={() => setOpen(false)}
          className="z-50 max-h-[70vh] w-[440px] max-w-[92vw] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-2xl"
        >
        {query.isPending && searches.length > 0 && (
            <p role="status" className="p-3 text-sm text-muted">
              Searching…
            </p>
          )}
          {query.data?.map((section) => (
            <section key={section.key} className="mb-2">
              <h2 className="px-3 py-2 text-xs font-bold text-subtle">{section.label}</h2>
              {section.error ? (
                <p role="alert" className="px-3 text-xs text-muted">
                  Search unavailable.{' '}
                  <button className="underline" onClick={() => query.refetch()}>
                    Retry
                  </button>
                </p>
              ) : section.items.length ? (
                section.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      setQ('');
                      setOpen(false);
                    }}
                    className="block rounded-xl px-3 py-2 hover:bg-surface-2"
                  >
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="text-xs text-muted">{item.subtitle}</span>
                  </Link>
                ))
              ) : (
                <p className="px-3 text-xs text-muted">No matching records.</p>
              )}
            </section>
          ))}
          {!searches.length && <p className="p-3 text-sm text-muted">No searchable modules are available for your role.</p>}
        </Pop.Content>
      </Pop.Portal>
    </Pop.Root>
  );
}
