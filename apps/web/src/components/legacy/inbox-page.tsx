'use client';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Phone,
  Plug,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { renderTemplate, timeAgo, type WaTemplate } from '@brokeriq/shared';
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

const CANNED_REPLIES = [
  'नमस्ते! मैं आपकी किस प्रकार सहायता कर सकता हूँ?',
  'क्या आप आज साइट विजिट के लिए उपलब्ध हैं?',
  'प्रॉपर्टी ब्रोशर और कीमत डिटेल्स भेज रहा हूँ।',
  'लोकेशन मैप व दिशा-निर्देश भेज रहा हूँ।',
  'क्या आपकी BHK व बजट आवश्यकता यही है?',
];

function InboxInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { user } = useAuth();
  const channel = (sp.get('channel') as Channel) || 'WHATSAPP';
  const active = sp.get('c');

  const setParam = (p: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    Object.entries(p).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    router.replace(`${pathname}?${n}`, { scroll: false });
  };

  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const dq = useDebounced(search);
  const status = useQuery({ queryKey: ['wa-status'], queryFn: () => api<any>('/whatsapp/status'), staleTime: 60_000 });
  const unreadStats = useQuery({
    queryKey: ['wa-unread-stats'],
    queryFn: () => api<any>('/whatsapp/unread-stats'),
    refetchInterval: 15_000,
  });

  const convs = useQuery({
    queryKey: ['conversations', channel, dq, unreadOnly],
    queryFn: () => api<any[]>(`/whatsapp/conversations${qs({ channel, q: dq, unread: unreadOnly ? 'true' : '' })}`),
    refetchInterval: 30_000,
  });

  const refreshAll = useCallback(() => {
    convs.refetch();
    unreadStats.refetch();
    qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
  }, [convs, unreadStats, qc]);

  useRealtime('wa:message', refreshAll);
  useRealtime('chat:message', refreshAll);
  useRealtime('wa:read', refreshAll);
  useRealtime('chat:read', refreshAll);
  useRealtime('wa:conversation_deleted', refreshAll);

  const current = convs.data?.find((c) => c.id === active);

  const handleRead = useCallback(() => {
    convs.refetch();
    unreadStats.refetch();
    qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
  }, [convs, unreadStats, qc]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/whatsapp/conversations/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success('चैट सफलतापूर्वक हटा दी गई (Lead सुरक्षित है)');
      if (active === deleteTarget.id) {
        setParam({ c: null });
      }
      refreshAll();
      setDeleteTarget(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const waUnreadCount = unreadStats.data?.whatsapp?.unreadConversations ?? 0;
  const chatUnreadCount = unreadStats.data?.chat?.unreadConversations ?? 0;
  const currentUnreadCount = channel === 'WHATSAPP' ? waUnreadCount : chatUnreadCount;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-64px)] sm:-mx-6 lg:-mx-8">
      {/* conversation list */}
      <aside className={cn('flex w-full flex-col border-r border-line bg-surface md:w-[360px] md:shrink-0', active && 'hidden md:flex')}>
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-extrabold text-fg">Inbox</h1>
              {unreadStats.data?.total?.unreadConversations > 0 && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-xs">
                  {unreadStats.data.total.unreadConversations} unread
                </span>
              )}
            </div>
            {channel === 'WHATSAPP' && status.data && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-xs',
                  status.data.connected
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
                )}
              >
                <span className={cn('size-1.5 rounded-full', status.data.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
                {status.data.connected ? (status.data.displayPhone ?? 'Connected') : 'Not connected'}
              </span>
            )}
          </div>

          {/* Channel Selector with Dynamic Badges */}
          <Segmented
            size="sm"
            value={channel}
            onChange={(v) => setParam({ channel: v, c: null })}
            options={[
              { value: 'WHATSAPP', label: 'WhatsApp', count: waUnreadCount > 0 ? waUnreadCount : undefined },
              { value: 'CHAT', label: 'Website chat', count: chatUnreadCount > 0 ? chatUnreadCount : undefined },
            ]}
            className="w-full"
          />

          {/* Search & Filter Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                icon={<Search className="size-4" />}
                className="h-9 pr-7"
                placeholder="नाम / नंबर खोजें..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 rounded-xl border px-3 h-9 text-xs font-semibold transition',
                unreadOnly
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 shadow-xs'
                  : 'border-line text-muted hover:text-fg hover:bg-surface-2',
              )}
            >
              Unread
              {currentUnreadCount > 0 && (
                <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">
                  {currentUnreadCount}
                </span>
              )}
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

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-line/60">
          {!convs.data && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="m-3 h-16 rounded-xl" />)}
          {convs.data && !convs.data.length && (
            <Empty
              className="mt-12"
              icon={<MessagesSquare className="size-8 text-muted" />}
              title="कोई बातचीत नहीं मिली"
              text={
                search || unreadOnly
                  ? 'फ़िल्टर या खोज शब्द बदल कर देखें।'
                  : channel === 'WHATSAPP'
                    ? 'Client WhatsApp पर message करेगा तो यहाँ दिखेगा।'
                    : 'Website पर users chat शुरू करेंगे तो यहाँ दिखेगा।'
              }
            />
          )}
          {convs.data?.map((c) => (
            <div
              key={c.id}
              onClick={() => setParam({ c: c.id })}
              className={cn(
                'group relative flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-2',
                c.id === active && 'bg-brand-50/80 dark:bg-brand-500/10',
              )}
            >
              {c.id === active && <motion.span layoutId="inbox-active" className="absolute inset-y-0 left-0 w-1 bg-brand-600 rounded-r" />}
              <Avatar name={c.contactName || c.contactPhone} src={c.user?.avatarUrl} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('truncate text-sm', c.unreadCount ? 'font-bold text-fg' : 'font-semibold text-fg')}>
                    {c.contactName || c.contactPhone || 'Unknown'}
                  </p>
                  <span className="shrink-0 text-[11px] text-subtle font-medium">{c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={cn('truncate text-xs', c.unreadCount ? 'font-semibold text-fg' : 'text-muted')}>
                    {c.lastPreview ?? '—'}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.unreadCount > 0 && (
                      <span className="grid min-w-5 place-items-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white shadow-xs">
                        {c.unreadCount}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(c);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition rounded-lg p-1 text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15"
                      title="चैट हटाएं (Delete Chat)"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                {c.lead && (
                  <div className="mt-1 flex items-center justify-between text-[11px] text-subtle">
                    <span className="truncate">Lead · {c.lead.assignedTo?.name ?? 'Unassigned'}</span>
                    <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[10px] font-medium text-brand-600 dark:text-brand-300">
                      {c.lead.stage}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* active thread view */}
      <section className={cn('flex min-w-0 flex-1 flex-col bg-surface-2/30', !active && 'hidden md:flex')}>
        {!active ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/25">
                <MessageCircle className="size-10" />
              </div>
              <p className="mt-4 font-display text-xl font-bold text-fg">Team Messaging Hub</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                WhatsApp और website chat — सभी ग्राहक संवाद एक जगह। किसी भी चैट पर क्लिक करके वार्तालाप शुरू करें।
              </p>
            </motion.div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 shadow-xs">
              <button
                className="md:hidden rounded-lg p-1.5 -ml-1 text-muted hover:text-fg hover:bg-surface-2"
                onClick={() => setParam({ c: null })}
                aria-label="Back"
              >
                <ArrowLeft className="size-5" />
              </button>
              <Avatar name={current?.contactName || current?.contactPhone} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold text-sm sm:text-base text-fg">
                    {current?.contactName || current?.contactPhone || '…'}
                  </p>
                  {channel === 'WHATSAPP' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      WhatsApp
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                      Website Chat
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                  {current?.contactPhone && (
                    <a href={`tel:${current.contactPhone}`} className="flex items-center gap-1 hover:text-brand-600 hover:underline">
                      <Phone className="size-3" />
                      <span>{current.contactPhone}</span>
                    </a>
                  )}
                  {current?.lastMessageAt && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-subtle">
                      <Clock className="size-3" /> {timeAgo(current.lastMessageAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {current?.lead && (
                  <Link
                    href={`/broker/leads/${current.lead.id}`}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-2 transition shadow-xs"
                  >
                    <span className="text-muted">Lead:</span>
                    <StageBadge stage={current.lead.stage} />
                  </Link>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(current)}
                  className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition flex items-center gap-1.5"
                  title="Delete chat (चैट हटाएं - Lead सुरक्षित रहेगी)"
                >
                  <Trash2 className="size-4" />
                  <span className="hidden sm:inline text-xs font-semibold">Delete chat</span>
                </Button>
              </div>
            </header>

            {channel === 'CHAT' ? (
              <div className="min-h-0 flex-1">
                <ChatThread id={active} side="broker" onRead={handleRead} />
              </div>
            ) : (
              <WaThread id={active} connected={!!status.data?.connected} onRead={handleRead} />
            )}
          </>
        )}
      </section>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="चैट डिलीट करें (Delete Conversation)"
        description="क्या आप वाकई इस बातचीत को हटाना चाहते हैं? इसके सभी मैसेजेस डिलीट हो जाएंगे।"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              रद्द करें
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              <Trash2 className="size-4" /> चैट डिलीट करें
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <p className="font-bold flex items-center gap-1.5">
              <Check className="size-4" /> आपकी Lead 100% सुरक्षित रहेगी!
            </p>
            <p className="mt-1">
              {deleteTarget?.lead
                ? `इस बातचीत से संबद्ध Lead (${deleteTarget.lead.name || 'Lead'}) का डेटाबेस रिकॉर्ड, स्थिति और विवरण डिलीट नहीं होंगे। सिर्फ चैट और संदेश इतिहास हटाया जाएगा।`
                : 'यह क्रिया इस बातचीत और इसके सभी संदेशों को हटा देगी।'}
            </p>
          </div>
          <p className="text-xs text-muted">
            डिलीट करने के बाद आप इस कॉन्टैक्ट के साथ कभी भी नया मैसेज भेजकर नई चैट शुरू कर सकते हैं।
          </p>
        </div>
      </Dialog>
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
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  useRealtime<any>('wa:message', (d) => d?.conversationId === id && qc.invalidateQueries({ queryKey: ['wa-thread', id] }));
  useRealtime<any>('wa:status', (d) => d?.conversationId === id && qc.invalidateQueries({ queryKey: ['wa-thread', id] }));

  useEffect(() => {
    if (q.data?.conversation?.unreadCount) {
      api(`/whatsapp/conversations/${id}/read`, { method: 'POST', body: {} })
        .then(() => onReadRef.current())
        .catch(() => undefined);
    }
  }, [q.data?.conversation?.unreadCount, id]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [q.data?.items?.length]);

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
  if (q.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="mb-2 size-8 text-amber-500" />
        <p className="text-sm font-semibold">Conversation लोड नहीं हो सकी</p>
        <p className="mt-1 text-xs text-muted">{errorMessage(q.error)}</p>
        <Button size="sm" variant="secondary" className="mt-4" onClick={() => q.refetch()}>
          दोबारा कोशिश करें
        </Button>
      </div>
    );
  }
  const windowOpen = q.data?.windowOpen;
  return (
    <>
      <div className="flex-1 space-y-2 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,var(--color-line)_1px,transparent_0)] [background-size:24px_24px] p-4">
        {grouped.map((g) => (
          <div key={g.day} className="space-y-2">
            <p className="sticky top-0 z-10 mx-auto my-3 w-fit rounded-full bg-surface/90 backdrop-blur-md px-3.5 py-1 text-[11px] font-semibold text-muted shadow-xs border border-line/60">
              {g.day}
            </p>
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
                        'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition',
                        out
                          ? 'rounded-br-sm bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white'
                          : 'rounded-bl-sm bg-surface border border-line/70 text-fg',
                      )}
                    >
                      {m.mediaUrl && m.type === 'IMAGE' && (
                        <img src={m.mediaUrl} alt="Media" className="mb-2 max-h-72 rounded-xl object-cover shadow-xs" />
                      )}
                      {m.templateName && (
                        <p className={cn('mb-1 flex items-center gap-1 text-[10px] font-bold uppercase', out ? 'text-white/80' : 'text-subtle')}>
                          <FileText className="size-3" /> {m.templateName}
                        </p>
                      )}
                      <p className="break-words whitespace-pre-line leading-relaxed">
                        {m.body ?? (m.type !== 'TEXT' ? `[${m.type.toLowerCase()}]` : '')}
                      </p>
                      <p className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', out ? 'text-white/80' : 'text-subtle')}>
                        {out && m.sender?.name && <span className="mr-1">{m.sender.name} ·</span>}
                        {formatDate(m.createdAt, { timeStyle: 'short' })}
                        {out && TICKS[m.status]}
                      </p>
                      {m.status === 'FAILED' && m.error && <p className="mt-1 text-[11px] text-rose-100 font-medium">{m.error}</p>}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ))}
        {!q.data?.items.length && <p className="py-12 text-center text-sm text-muted">अभी कोई संदेश नहीं है</p>}
        <div ref={end} />
      </div>

      {/* Composer Area */}
      <div className="border-t border-line bg-surface p-3 space-y-2.5">
        {notConfigured?.body.integration && (
          <div className="mb-2">
            <IntegrationBanner compact name={notConfigured.body.integration.name} message={notConfigured.body.message} />
          </div>
        )}

        {/* 24-Hour Window Alert */}
        {!windowOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20">
            <Clock className="size-3.5" />
            <span className="flex-1">24-घंटे की window बंद है — WhatsApp नियम के अनुसार केवल approved template भेज सकते हैं।</span>
            <Button size="xs" variant="secondary" onClick={() => setTplOpen(true)}>
              Template भेजें
            </Button>
          </div>
        )}

        {/* Canned Quick Replies */}
        {windowOpen && connected && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-subtle shrink-0 mr-1">
              <Sparkles className="size-3 text-brand-500" />
              त्वरित उत्तर:
            </span>
            {CANNED_REPLIES.map((cr, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setText((prev) => (prev ? `${prev} ${cr}` : cr))}
                className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/15"
              >
                {cr}
              </button>
            ))}
          </div>
        )}

        {/* Message Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send({ text });
          }}
          className="flex items-end gap-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShareOpen(true)}
            aria-label="Share property"
            title="प्रॉपर्टी शेयर करें"
            className="hover:bg-surface-2"
          >
            <Building2 className="size-5 text-muted hover:text-fg" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTplOpen(true)}
            aria-label="Templates"
            title="WhatsApp Templates"
            className="hover:bg-surface-2"
          >
            <FileText className="size-5 text-muted hover:text-fg" />
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
            placeholder={!connected ? 'WhatsApp connect नहीं है' : windowOpen ? 'संदेश लिखें… (Enter = भेजें, Shift+Enter = नई पंक्ति)' : 'Window बंद — template भेजें'}
            className="max-h-40 min-h-11 resize-none py-2.5"
          />
          <Button
            type="submit"
            size="icon"
            variant="whatsapp"
            loading={sending}
            disabled={!windowOpen || !text.trim()}
            aria-label="Send"
            className="shadow-sm"
          >
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
        title="प्रॉपर्टी शेयर करें"
        description="प्रॉपर्टी का शीर्षक, कीमत, इलाका और लिंक WhatsApp पर भेजा जाएगा।"
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
      <ListingPicker value={id} onChange={setId} placeholder="प्रॉपर्टी चुनें" />
      {disabled && <p className="text-xs text-amber-600">24-घंटे की window बंद है — पहले approved template भेजें।</p>}
      <Button className="w-full" variant="whatsapp" disabled={!id || disabled} onClick={() => onSend(id)}>
        <ImageIcon className="size-4" /> शेयर करें
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
  const tpls = useQuery({ queryKey: ['wa-templates'], queryFn: () => api<WaTemplate[]>('/whatsapp/templates'), enabled: open });
  const [sel, setSel] = useState<any>(null);
  const [params, setParams] = useState<string[]>([]);
  const count = sel?.body ? new Set(sel.body.match(/\{\{\d+\}\}/g) ?? []).size : 0;
  useEffect(() => {
    setParams(Array.from({ length: count }, (_, i) => (i === 0 && name ? name : '')));
  }, [sel, count, name]);
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
                  'w-full rounded-xl px-3 py-2 text-left text-sm transition',
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
                <div className="rounded-2xl rounded-tl-md bg-emerald-50 p-4 text-sm whitespace-pre-line dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
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
