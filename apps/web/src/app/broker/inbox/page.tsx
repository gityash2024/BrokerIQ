'use client';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  MessagesSquare,
  Plug,
  Search,
  Send,
} from 'lucide-react';
import { renderTemplate, timeAgo } from '@brokeriq/shared';
import { ApiError, api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { post, useDebounced } from '@/lib/hooks';
import { useRealtime } from '@/lib/realtime';
import { cn, formatDate, qs } from '@/lib/utils';
import { StageBadge } from '@/components/broker/bits';
import { ListingPicker } from '@/components/broker/lead-picker';
import { ChatThread } from '@/components/site/chat-view';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Avatar, Empty, PageLoader, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { IntegrationBanner } from '@/components/ui/api-error';

type Channel = 'WHATSAPP' | 'CHAT';

function InboxInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const channel = (sp.get('channel') as Channel) || 'WHATSAPP';
  const active = sp.get('c');
  const setParam = (p: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    Object.entries(p).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    router.replace(`${pathname}?${n}`, { scroll: false });
  };
  const [search, setSearch] = useState('');
  const [unread, setUnread] = useState(false);
  const dq = useDebounced(search);
  const status = useQuery({ queryKey: ['wa-status'], queryFn: () => api<any>('/whatsapp/status'), staleTime: 60_000 });
  const convs = useQuery({
    queryKey: ['conversations', channel, dq, unread],
    queryFn: () => api<any[]>(`/whatsapp/conversations${qs({ channel, q: dq, unread: unread ? 'true' : '' })}`),
    refetchInterval: 60_000,
  });
  useRealtime('wa:message', () => convs.refetch());
  useRealtime('chat:message', () => convs.refetch());
  const current = convs.data?.find((c) => c.id === active);

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-64px)] sm:-mx-6 lg:-mx-8">
      {/* list */}
      <aside className={cn('flex w-full flex-col border-r border-line bg-surface md:w-[340px] md:shrink-0', active && 'hidden md:flex')}>
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-xl font-extrabold">Inbox</h1>
            {channel === 'WHATSAPP' && status.data && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                  status.data.connected
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15',
                )}
              >
                <span className={cn('size-1.5 rounded-full', status.data.connected ? 'bg-emerald-500' : 'bg-amber-500')} />
                {status.data.connected ? (status.data.displayPhone ?? 'Connected') : 'Not connected'}
              </span>
            )}
          </div>
          <Segmented
            size="sm"
            value={channel}
            onChange={(v) => setParam({ channel: v, c: null })}
            options={[
              { value: 'WHATSAPP', label: 'WhatsApp' },
              { value: 'CHAT', label: 'Website chat' },
            ]}
            className="w-full"
          />
          <div className="flex gap-2">
            <Input icon={<Search className="size-4" />} className="h-9" placeholder="नाम / number" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button
              onClick={() => setUnread(!unread)}
              className={cn(
                'shrink-0 rounded-xl border px-3 text-xs font-semibold',
                unread ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15' : 'border-line text-muted',
              )}
            >
              Unread
            </button>
          </div>
        </div>
        {channel === 'WHATSAPP' && status.data && !status.data.connected && (
          <div className="border-b border-line p-3">
            <IntegrationBanner
              compact
              name="WhatsApp"
              message={
                user?.role === 'BROKER_ADMIN'
                  ? 'अपना WhatsApp Business number connect करें — तभी messages यहाँ आएँगे और automation चलेगा।'
                  : 'Admin से WhatsApp connect करवाएँ।'
              }
              href="/broker/connectors?key=whatsapp"
            />
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {!convs.data && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="m-3 h-16 rounded-xl" />)}
          {convs.data && !convs.data.length && (
            <Empty
              className="mt-10"
              icon={<MessagesSquare className="size-7" />}
              title="कोई conversation नहीं"
              text={channel === 'WHATSAPP' ? 'Client WhatsApp पर message करेगा तो यहाँ दिखेगा।' : 'Website पर users chat शुरू करेंगे तो यहाँ दिखेगा।'}
            />
          )}
          {convs.data?.map((c) => (
            <button
              key={c.id}
              onClick={() => setParam({ c: c.id })}
              className={cn(
                'relative flex w-full gap-3 border-b border-line px-4 py-3 text-left transition hover:bg-surface-2',
                c.id === active && 'bg-brand-50/70 dark:bg-brand-500/10',
              )}
            >
              {c.id === active && <motion.span layoutId="inbox-active" className="absolute inset-y-0 left-0 w-1 bg-brand-600" />}
              <Avatar name={c.contactName || c.contactPhone} src={c.user?.avatarUrl} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('truncate text-sm', c.unreadCount ? 'font-bold' : 'font-semibold')}>{c.contactName || c.contactPhone || 'Unknown'}</p>
                  <span className="shrink-0 text-[11px] text-subtle">{c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('truncate text-xs', c.unreadCount ? 'text-fg' : 'text-muted')}>{c.lastPreview ?? '—'}</p>
                  {c.unreadCount > 0 && (
                    <span className="grid min-w-5 place-items-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">{c.unreadCount}</span>
                  )}
                </div>
                {c.lead && <p className="mt-0.5 truncate text-[11px] text-subtle">Lead · {c.lead.assignedTo?.name ?? 'Unassigned'}</p>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* thread */}
      <section className={cn('flex min-w-0 flex-1 flex-col bg-surface-2/40', !active && 'hidden md:flex')}>
        {!active ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/30">
                <MessageCircle className="size-10" />
              </div>
              <p className="mt-4 font-display text-lg font-bold">Team inbox</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                WhatsApp और website chat — सारे client messages एक जगह, real-time। हर conversation अपने lead से जुड़ा है।
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
              <button className="md:hidden" onClick={() => setParam({ c: null })} aria-label="Back">
                <ArrowLeft className="size-5" />
              </button>
              <Avatar name={current?.contactName || current?.contactPhone} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{current?.contactName || current?.contactPhone || '…'}</p>
                <p className="truncate text-xs text-muted">{current?.contactPhone}</p>
              </div>
              {current?.lead && (
                <Link
                  href={`/broker/leads/${current.lead.id}`}
                  className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-2"
                >
                  Lead <StageBadge stage={current.lead.stage} />
                </Link>
              )}
            </header>
            {channel === 'CHAT' ? (
              <div className="min-h-0 flex-1">
                <ChatThread id={active} side="broker" />
              </div>
            ) : (
              <WaThread id={active} connected={!!status.data?.connected} onRead={() => convs.refetch()} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

const TICKS: Record<string, React.ReactNode> = {
  QUEUED: <Clock className="size-3" />,
  SENT: <Check className="size-3" />,
  DELIVERED: <CheckCheck className="size-3" />,
  READ: <CheckCheck className="size-3 text-sky-300" />,
  FAILED: <AlertTriangle className="size-3 text-rose-300" />,
};

function WaThread({ id, connected, onRead }: { id: string; connected: boolean; onRead: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['wa-thread', id], queryFn: () => api<any>(`/whatsapp/conversations/${id}/messages`) });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [notConfigured, setNotConfigured] = useState<ApiError | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useRealtime<any>('wa:message', (d) => d.conversationId === id && qc.invalidateQueries({ queryKey: ['wa-thread', id] }));
  useRealtime<any>('wa:status', (d) => d.conversationId === id && qc.invalidateQueries({ queryKey: ['wa-thread', id] }));
  useEffect(() => {
    if (q.data?.conversation?.unreadCount) api(`/whatsapp/conversations/${id}/read`, { method: 'POST', body: {} }).then(onRead);
  }, [q.data?.conversation?.unreadCount, id, onRead]);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [q.data?.items.length]);

  const send = async (body: Record<string, unknown>) => {
    setSending(true);
    setNotConfigured(null);
    try {
      await post('/whatsapp/send', { conversationId: id, ...body });
      setText('');
      q.refetch();
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.isNotConfigured) setNotConfigured(e);
      else toast.error(errorMessage(e));
      return false;
    } finally {
      setSending(false);
    }
  };

  const grouped = useMemo(() => {
    const out: { day: string; items: any[] }[] = [];
    for (const m of q.data?.items ?? []) {
      const day = formatDate(m.createdAt, { weekday: 'short', day: 'numeric', month: 'short' });
      if (out.at(-1)?.day !== day) out.push({ day, items: [] });
      out.at(-1)!.items.push(m);
    }
    return out;
  }, [q.data]);

  if (q.isLoading) return <PageLoader />;
  const windowOpen = q.data?.windowOpen;
  return (
    <>
      <div className="flex-1 space-y-1.5 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,var(--color-line)_1px,transparent_0)] [background-size:22px_22px] p-4">
        {grouped.map((g) => (
          <div key={g.day} className="space-y-1.5">
            <p className="sticky top-0 z-10 mx-auto my-3 w-fit rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-muted shadow-sm">{g.day}</p>
            <AnimatePresence initial={false}>
              {g.items.map((m: any) => {
                const out = m.direction === 'OUTBOUND';
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn('flex', out ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                        out ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md bg-surface',
                      )}
                    >
                      {m.mediaUrl && m.type === 'IMAGE' && <img src={m.mediaUrl} alt="" className="mb-1.5 max-h-64 rounded-xl" />}
                      {m.templateName && (
                        <p className={cn('mb-1 flex items-center gap-1 text-[10px] font-bold uppercase', out ? 'text-white/70' : 'text-subtle')}>
                          <FileText className="size-3" /> {m.templateName}
                        </p>
                      )}
                      <p className="break-words whitespace-pre-line">{m.body ?? (m.type !== 'TEXT' ? `[${m.type.toLowerCase()}]` : '')}</p>
                      <p className={cn('mt-0.5 flex items-center justify-end gap-1 text-[10px]', out ? 'text-white/70' : 'text-subtle')}>
                        {out && m.sender?.name && <span className="mr-1">{m.sender.name} ·</span>}
                        {formatDate(m.createdAt, { timeStyle: 'short' })}
                        {out && TICKS[m.status]}
                      </p>
                      {m.status === 'FAILED' && m.error && <p className="mt-1 text-[11px] text-rose-100">{m.error}</p>}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ))}
        {!q.data?.items.length && <p className="py-10 text-center text-sm text-muted">अभी कोई message नहीं</p>}
        <div ref={end} />
      </div>
      <div className="border-t border-line bg-surface p-3">
        {notConfigured?.body.integration && (
          <div className="mb-3">
            <IntegrationBanner compact name={notConfigured.body.integration.name} message={notConfigured.body.message} />
          </div>
        )}
        {!windowOpen && (
          <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <Clock className="size-3.5" />
            <span className="flex-1">24-घंटे की window बंद है — WhatsApp नियम के अनुसार सिर्फ़ approved template भेज सकते हैं।</span>
            <Button size="xs" variant="secondary" onClick={() => setTplOpen(true)}>
              Template भेजें
            </Button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send({ text });
          }}
          className="flex items-end gap-2"
        >
          <Button type="button" variant="ghost" size="icon" onClick={() => setShareOpen(true)} aria-label="Share property" title="Property share करें">
            <Building2 className="size-5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => setTplOpen(true)} aria-label="Templates" title="Templates">
            <FileText className="size-5" />
          </Button>
          <Textarea
            rows={1}
            value={text}
            disabled={!windowOpen || !connected}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (text.trim()) send({ text });
              }
            }}
            placeholder={!connected ? 'WhatsApp connect नहीं है' : windowOpen ? 'Message लिखें… (Enter = send)' : 'Window बंद — template भेजें'}
            className="max-h-40 min-h-11 resize-none py-2.5"
          />
          <Button type="submit" size="icon" variant="whatsapp" loading={sending} disabled={!windowOpen || !text.trim()} aria-label="Send">
            {!sending && <Send className="size-4" />}
          </Button>
        </form>
      </div>
      <TemplateDialog
        open={tplOpen}
        onOpenChange={setTplOpen}
        name={q.data?.conversation?.contactName}
        onSend={async (b) => (await send(b)) && setTplOpen(false)}
      />
      <Dialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Property share करें"
        description="Title, price, locality और link WhatsApp पर जाएगा।"
        size="sm"
      >
        <ShareListing disabled={!windowOpen} onSend={async (listingId) => (await send({ listingId })) && setShareOpen(false)} />
      </Dialog>
    </>
  );
}

function ShareListing({ onSend, disabled }: { onSend: (id: string) => void; disabled?: boolean }) {
  const [id, setId] = useState('');
  return (
    <div className="space-y-3">
      <ListingPicker value={id} onChange={setId} placeholder="Listing चुनें" />
      {disabled && <p className="text-xs text-amber-600">24-घंटे window बंद है — पहले template भेजें।</p>}
      <Button className="w-full" variant="whatsapp" disabled={!id || disabled} onClick={() => onSend(id)}>
        <ImageIcon className="size-4" /> भेजें
      </Button>
    </div>
  );
}

function TemplateDialog({
  open,
  onOpenChange,
  onSend,
  name,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSend: (b: Record<string, unknown>) => void;
  name?: string | null;
}) {
  const { user } = useAuth();
  const tpls = useQuery({ queryKey: ['wa-templates'], queryFn: () => api<any[]>('/whatsapp/templates'), enabled: open });
  const [sel, setSel] = useState<any>(null);
  const [params, setParams] = useState<string[]>([]);
  const count = sel?.body ? new Set(sel.body.match(/\{\{\d+\}\}/g) ?? []).size : 0;
  useEffect(() => setParams(Array.from({ length: count }, (_, i) => (i === 0 && name ? name : ''))), [sel, count, name]);
  const sync = async () => {
    try {
      const r = await post<any>('/whatsapp/templates/sync');
      toast.success(`${Array.isArray(r) ? r.length : 0} templates synced`);
      tpls.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const approved = (tpls.data ?? []).filter((t) => !t.status || t.status === 'APPROVED');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="WhatsApp template"
      description="Meta से approved templates — 24 घंटे के बाद भी भेज सकते हैं"
      size="lg"
      footer={
        <>
          {user?.role === 'BROKER_ADMIN' && (
            <Button variant="secondary" onClick={sync}>
              Meta से sync करें
            </Button>
          )}
          <Button
            variant="whatsapp"
            disabled={!sel || params.some((p) => !p.trim())}
            onClick={() => onSend({ templateName: sel.name, templateLanguage: sel.language, templateParams: params })}
          >
            <Send className="size-4" /> Send template
          </Button>
        </>
      }
    >
      {tpls.isLoading ? (
        <Skeleton className="h-40" />
      ) : !approved.length ? (
        <Empty
          icon={<Plug className="size-6" />}
          title="कोई approved template नहीं"
          text="Meta Business Manager → WhatsApp Manager में template बनाकर approve करवाएँ, फिर 'Meta से sync करें' दबाएँ।"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {approved.map((t) => (
              <button
                key={t.id}
                onClick={() => setSel(t)}
                className={cn(
                  'w-full rounded-xl px-3 py-2 text-left text-sm',
                  sel?.id === t.id ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15' : 'hover:bg-surface-2',
                )}
              >
                {t.name}
                <span className="block text-[11px] text-subtle">
                  {t.language} · {t.category?.toLowerCase() ?? 'template'}
                </span>
              </button>
            ))}
          </div>
          <div>
            {sel ? (
              <>
                <div className="rounded-2xl rounded-tl-md bg-emerald-50 p-4 text-sm whitespace-pre-line dark:bg-emerald-500/10">
                  {renderTemplate(sel.body ?? '', Object.fromEntries(params.map((p, i) => [String(i + 1), p || `{{${i + 1}}}`])))}
                </div>
                <div className="mt-3 space-y-2">
                  {params.map((p, i) => (
                    <Input
                      key={i}
                      value={p}
                      onChange={(e) => setParams((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder={`Variable {{${i + 1}}}`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="grid h-full place-items-center text-sm text-muted">बाएँ से template चुनें</p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <InboxInner />
    </Suspense>
  );
}
