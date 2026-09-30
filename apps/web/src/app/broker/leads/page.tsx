'use client';
import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Filter, Inbox, MessageCircle, Phone, Search, Trash2, Upload, UserPlus, X } from 'lucide-react';
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, LEAD_STAGES, LEAD_STAGE_LABELS, formatPriceShort, timeAgo, whatsappLink } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { post, useApiMutation } from '@/lib/hooks';
import { useRealtime } from '@/lib/realtime';
import { cn, qs } from '@/lib/utils';
import type { LeadRow, Paged } from '@/lib/types';
import { PageHeader } from '@/components/panel/shell';
import { SourceBadge, StageBadge, TempBadge, useTeam } from '@/components/broker/bits';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { Avatar, Empty, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

function LeadsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const admin = user?.role === 'BROKER_ADMIN';
  const team = useTeam();
  const f = useMemo(() => Object.fromEntries(sp.entries()) as Record<string, string>, [sp]);
  const setF = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!('page' in patch)) n.delete('page');
    router.replace(`${pathname}?${n}`, { scroll: false });
  };
  const [sel, setSel] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const q = useQuery({ queryKey: ['leads', f], queryFn: () => api<Paged<LeadRow>>(`/leads${qs({ ...f, pageSize: 30 })}`), placeholderData: (p) => p });
  useRealtime('notification', (n: any) => n?.kind === 'NEW_LEAD' && q.refetch());
  const bulk = useApiMutation((b: { action: string; value?: string | null }) => post('/leads/bulk', { ids: sel, ...b }), {
    success: (r: any) => `${r.updated} leads updated`,
    invalidate: [['leads'], ['kanban']],
    onSuccess: () => setSel([]),
  });

  const exportCsv = async () => {
    try {
      const res = await api<Response>(`/leads/export${qs(f)}`, { raw: true });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const items = q.data?.items ?? [];
  const allSel = items.length > 0 && items.every((l) => sel.includes(l.id));
  const views = [
    { value: '', label: 'All' },
    { value: 'new', label: 'New' },
    { value: 'due', label: 'Due today' },
    ...(admin ? [{ value: 'unassigned', label: 'Unassigned' }] : []),
    { value: 'mine', label: 'Mine' },
    { value: 'stale', label: 'No activity 3d+' },
  ];

  return (
    <>
      <PageHeader
        title="Lead inbox"
        subtitle={q.data ? `${q.data.total} leads — हर portal, ad और WhatsApp से एक जगह` : ' '}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Import CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download className="size-4" /> Export
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3">
        <Segmented value={f.view ?? ''} onChange={(v) => setF({ view: v || null })} options={views} />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-10 w-64"
            icon={<Search className="size-4" />}
            placeholder="नाम, phone, project…"
            defaultValue={f.q}
            onKeyDown={(e) => e.key === 'Enter' && setF({ q: (e.target as HTMLInputElement).value || null })}
          />
          <Select className="h-10 w-40 text-sm" value={f.source ?? ''} onChange={(e) => setF({ source: e.target.value || null })}>
            <option value="">All sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select className="h-10 w-36 text-sm" value={f.stage ?? ''} onChange={(e) => setF({ stage: e.target.value || null })}>
            <option value="">All stages</option>
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STAGE_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select className="h-10 w-32 text-sm" value={f.temperature ?? ''} onChange={(e) => setF({ temperature: e.target.value || null })}>
            <option value="">Any temp</option>
            <option value="HOT">🔥 Hot</option>
            <option value="WARM">☀️ Warm</option>
            <option value="COLD">❄️ Cold</option>
          </Select>
          {admin && (
            <Select className="h-10 w-40 text-sm" value={f.assignedToId ?? ''} onChange={(e) => setF({ assignedToId: e.target.value || null })}>
              <option value="">Anyone</option>
              <option value="none">Unassigned</option>
              {team.data?.members.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          )}
          <Select className="h-10 w-40 text-sm" value={f.sort ?? ''} onChange={(e) => setF({ sort: e.target.value || null })}>
            <option value="">Recent activity</option>
            <option value="created">Newest</option>
            <option value="score">Score (hot पहले)</option>
            <option value="followup">Next follow-up</option>
          </Select>
          {Object.keys(f).some((k) => !['view', 'page'].includes(k)) && (
            <button className="flex items-center gap-1 text-sm font-semibold text-brand-600" onClick={() => router.replace(pathname)}>
              <X className="size-4" /> Clear
            </button>
          )}
        </div>
      </div>

      {sel.length > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          <span className="font-semibold">{sel.length} selected</span>
          {admin && (
            <Select
              className="h-9 w-44 border-white/20 bg-white/10 text-sm text-white"
              value=""
              onChange={(e) => e.target.value && bulk.mutate({ action: 'assign', value: e.target.value === 'none' ? null : e.target.value })}
            >
              <option value="">Assign to…</option>
              <option value="none">Unassign</option>
              {team.data?.members.map((m: any) => (
                <option key={m.id} value={m.id} className="text-fg">
                  {m.name}
                </option>
              ))}
            </Select>
          )}
          <Select
            className="h-9 w-40 border-white/20 bg-white/10 text-sm text-white"
            value=""
            onChange={(e) => e.target.value && bulk.mutate({ action: 'stage', value: e.target.value })}
          >
            <option value="">Move to stage…</option>
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s} className="text-fg">
                {LEAD_STAGE_LABELS[s]}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const t = prompt('Tag');
              if (t) bulk.mutate({ action: 'tag', value: t });
            }}
          >
            + Tag
          </Button>
          {admin && (
            <Button size="sm" variant="danger" onClick={() => confirm(`${sel.length} leads delete करें?`) && bulk.mutate({ action: 'delete' })}>
              <Trash2 className="size-4" />
            </Button>
          )}
          <button className="ml-auto" onClick={() => setSel([])} aria-label="Clear selection">
            <X className="size-5" />
          </button>
        </div>
      )}

      {q.error ? (
        <ApiErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !items.length ? (
        <Empty
          icon={<Inbox className="size-6" />}
          title="यहाँ कोई lead नहीं"
          text={admin ? 'Housing / 99acres / MagicBricks inbox और WhatsApp connect करें — leads अपने-आप आएँगी।' : 'आपको assign होते ही leads यहाँ दिखेंगी।'}
          action={admin ? <Button href="/broker/connectors">Connectors setup करें</Button> : undefined}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[32px_minmax(0,2fr)_minmax(0,1.2fr)_120px_minmax(0,1.3fr)_120px_96px] items-center gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-bold text-muted uppercase lg:grid">
            <input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? [] : items.map((l) => l.id))} aria-label="Select all" />
            <span>Lead</span>
            <span>Source</span>
            <span>Stage</span>
            <span>Requirement</span>
            <span>Owner</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-line">
            {items.map((l) => {
              const r = l.requirement;
              return (
                <div
                  key={l.id}
                  className={cn(
                    'grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-surface-2 lg:grid-cols-[32px_minmax(0,2fr)_minmax(0,1.2fr)_120px_minmax(0,1.3fr)_120px_96px]',
                    sel.includes(l.id) && 'bg-brand-50/60 dark:bg-brand-500/10',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={sel.includes(l.id)}
                    onChange={() => setSel(sel.includes(l.id) ? sel.filter((x) => x !== l.id) : [...sel, l.id])}
                    aria-label={`Select ${l.name}`}
                  />
                  <Link href={`/broker/leads/${l.id}`} className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-semibold">
                      {l.name} <TempBadge t={l.temperature} />
                      {l.scoredAt && (
                        <span className="text-xs font-semibold text-muted" title={(l.scoreReasons ?? []).join(' · ')}>
                          {l.score}
                        </span>
                      )}
                      {l.repeatCount > 0 && (
                        <span className="rounded bg-violet-100 px-1.5 text-[10px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                          ×{l.repeatCount + 1}
                        </span>
                      )}
                      {l.tags?.includes('verified-tenant') && (
                        <span className="rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                          ✓ Verified tenant
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {l.phone} · {timeAgo(l.lastActivityAt ?? l.createdAt)}
                      {l.nextFollowUpAt
                        ? ` · ⏰ ${new Date(l.nextFollowUpAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
                        : ''}
                    </p>
                    <div className="mt-1 flex gap-1.5 lg:hidden">
                      <SourceBadge source={l.source} />
                      <StageBadge stage={l.stage} />
                    </div>
                  </Link>
                  <div className="hidden min-w-0 lg:block">
                    <SourceBadge source={l.source} />
                    {l.sourceDetail && <p className="mt-0.5 truncate text-xs text-subtle">{l.sourceDetail}</p>}
                  </div>
                  <div className="hidden lg:block">
                    <StageBadge stage={l.stage} />
                  </div>
                  <p className="hidden truncate text-xs text-muted lg:block">
                    {r
                      ? [
                          r.purpose === 'RENT' ? 'Rent' : r.purpose === 'SALE' ? 'Buy' : null,
                          r.bedrooms?.length ? `${r.bedrooms.join('/')} BHK` : null,
                          r.maxBudget ? `≤ ${formatPriceShort(r.maxBudget)}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'
                      : (l.listing?.title ?? '—')}
                  </p>
                  <div className="hidden items-center gap-2 lg:flex">
                    {l.assignedTo ? (
                      <>
                        <Avatar name={l.assignedTo.name} src={l.assignedTo.avatarUrl} size={24} />
                        <span className="truncate text-xs">{l.assignedTo.name.split(' ')[0]}</span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <UserPlus className="size-3.5" /> Unassigned
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <Button size="icon-sm" variant="secondary" href={`tel:${l.phone}`} aria-label="Call">
                      <Phone className="size-4" />
                    </Button>
                    <Button size="icon-sm" variant="whatsapp" href={whatsappLink(l.phone, `नमस्ते ${l.name.split(' ')[0]} जी,`)} external aria-label="WhatsApp">
                      <MessageCircle className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {q.data && q.data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
              <span className="text-muted">
                Page {q.data.page} of {q.data.totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={q.data.page <= 1} onClick={() => setF({ page: String(q.data!.page - 1) })}>
                  Prev
                </Button>
                <Button size="sm" variant="secondary" disabled={q.data.page >= q.data.totalPages} onClick={() => setF({ page: String(q.data!.page + 1) })}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={() => q.refetch()} />
    </>
  );
}

function ImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<any>(null);
  const m = useApiMutation(() => post('/leads/import', { csv }), { onSuccess: (r) => (setResult(r), onDone()) });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (onOpenChange(v), !v && (setResult(null), setCsv('')))}
      title="CSV / Excel से leads import"
      description="पहली row में headers हों: Name, Phone, Email, Source, Notes. Excel file को “CSV” में save करके upload करें।"
      size="lg"
      footer={
        !result && (
          <Button onClick={() => m.mutate(undefined)} loading={m.isPending} disabled={!csv}>
            <Filter className="size-4" /> Import
          </Button>
        )
      }
    >
      {result ? (
        <div className="space-y-2 text-sm">
          <p>
            ✅ <b>{result.created}</b> नई leads · 🔁 <b>{result.merged}</b> duplicates merged · ❌ <b>{result.failed}</b> failed
          </p>
          {result.errors.map((e: any) => (
            <p key={e.row} className="text-rose-600">
              Row {e.row}: {e.error}
            </p>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-6 font-semibold text-muted hover:border-brand-400">
            <Upload className="size-5" /> CSV file चुनें
            <input type="file" accept=".csv,text/csv" hidden onChange={async (e) => setCsv((await e.target.files?.[0]?.text()) ?? '')} />
          </label>
          <Textarea
            rows={6}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={'Name,Phone,Email,Source,Notes\nRahul Sharma,9876543210,rahul@gmail.com,Housing,3BHK Sector 65'}
            className="font-mono text-xs"
          />
        </div>
      )}
    </Dialog>
  );
}

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadsInner />
    </Suspense>
  );
}
