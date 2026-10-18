'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Blocks, Clock3, Search } from 'lucide-react';
import { catalogModules } from '@brokeriq/shared';
import { useConfig } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { Dialog } from '@/components/ui/dialog';

export function ProductCatalog() {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState('');
  const { modules } = useConfig(),
    role = useAuth().user?.role ?? 'PUBLIC';
  const items = catalogModules(modules, role).filter((m) => `${m.name} ${m.description}`.toLowerCase().includes(search.toLowerCase()));
  const admin: Record<string, string> = {
    consumer: '/admin/listings',
    today: '/admin',
    inventory: '/admin/inventory',
    directory: '/admin/inventory/directory',
    leads: '/admin/enquiries',
    inbox: '/admin/chat-reports',
    automation: '/admin/system',
    tenant_requirements: '/admin/enquiries',
    slot_booking: '/admin/visit-verification',
  };
  const user: Record<string, string> = { consumer: '/user', tenant_requirements: '/user/account/requirements', slot_booking: '/user/account/visits' };
  const tools =
    role === 'BROKER_ADMIN'
      ? [
          {
            name: 'Scanner · Inventory & Requirements',
            description: 'Camera, register pages, gallery and source review',
            href: '/broker/scanner',
            key: 'inventory',
          },
          { name: 'WhatsApp export & Paste', description: 'Import bulk TXT/ZIP chats, screenshots or messages', href: '/broker/imports', key: 'inbox' },
          {
            name: 'Public rental draft scanner',
            description: 'Page preview, rotate, extraction and listing drafts',
            href: '/broker/scanner/listing-drafts',
            key: 'inventory',
          },
          {
            name: 'Requirements & matching',
            description: 'Separate client needs, budgets and matching inventory',
            href: '/broker/leads/requirements',
            key: 'leads',
          },
        ].filter((tool) => items.some((item) => item.key === tool.key && item.state === 'ACTIVE'))
      : [];
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Product features & upcoming"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-semibold hover:border-brand-400"
      >
        <Blocks className="size-4 text-brand-600" />
        <span className="hidden md:inline">Product features</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen} title="Your product workspace" size="xl">
        <p className="text-sm leading-6 text-muted">
          Explore available tools and the complete upcoming roadmap. Upcoming features remain disabled and do not request protected data.
        </p>
        <div className="my-5 flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4">
          <Search className="size-4 text-muted" />
          <input
            aria-label="Search product features"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search features, scanner, workflows…"
            className="min-h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        {!!tools.length && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {tools.map((tool) => (
              <Link key={tool.href} href={tool.href} onClick={() => setOpen(false)} className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4">
                <p className="flex items-center justify-between gap-3 text-sm font-bold">
                  {tool.name}
                  <ArrowUpRight className="size-4 shrink-0 text-brand-600" />
                </p>
                <p className="mt-2 text-xs leading-5 text-muted">{tool.description}</p>
              </Link>
            ))}
          </div>
        )}
        {(['ACTIVE', 'COMING_SOON'] as const).map((state) => (
          <section key={state} className="mb-6">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">
              {state === 'ACTIVE' ? 'Available in your workspace' : 'Coming soon · Product roadmap'}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items
                .filter((item) => item.state === state)
                .map((item) => {
                  const href = role === 'SUPER_ADMIN' ? admin[item.key] : role === 'USER' ? user[item.key] : item.href;
                  const content = (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-bold">{item.name}</h3>
                        {state === 'COMING_SOON' ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[10px] font-semibold text-muted">
                            <Clock3 className="size-3" />
                            Coming soon
                          </span>
                        ) : (
                          <ArrowUpRight className="size-4 shrink-0 text-brand-600" />
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted">{item.description}</p>
                    </>
                  );
                  return state === 'ACTIVE' && href ? (
                    <Link
                      key={item.key}
                      href={href}
                      onClick={() => setOpen(false)}
                      className="rounded-2xl border border-line p-4 transition hover:border-brand-400"
                    >
                      {content}
                    </Link>
                  ) : (
                    <article key={item.key} aria-disabled="true" className="rounded-2xl border border-dashed border-line bg-surface/60 p-4">
                      {content}
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
        {items.length === 0 && <p className="p-6 text-center text-sm text-muted">No matching features.</p>}
      </Dialog>
    </>
  );
}
