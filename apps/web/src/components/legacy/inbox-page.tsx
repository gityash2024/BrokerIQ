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
  Globe,
  Image as ImageIcon,
  MessageCircle,
  MessagesSquare,
  MessageSquare,
  Phone,
  Plug,
  RefreshCw,
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
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Empty, PageLoader, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { IntegrationBanner } from '@/components/ui/api-error';

type Channel = 'WHATSAPP' | 'CHAT';

const CANNED_REPLIES = [
  '👋 नमस्ते! मैं आपकी किस प्रकार सहायता कर सकता हूँ?',
  '📅 क्या आप आज साइट विजिट के लिए उपलब्ध हैं?',
  '🏡 प्रॉपर्टी ब्रोशर और कीमत डिटेल्स भेज रहा हूँ।',
  '📍 लोकेशन मैप व दिशा-निर्देश भेज रहा हूँ।',
  '💰 क्या आपकी BHK व बजट आवश्यकता यही है?',
];

const AVATAR_GRADIENTS = [
  'from-emerald-500 to-teal-600',
  'from-blue-600 to-indigo-600',
  'from-violet-600 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
];

function getAvatarGradient(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

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
    refetchInterval: 10_000,
  });

  const convs = useQuery({
    queryKey: ['conversations', channel, dq, unreadOnly],
    queryFn: () => api<any[]>(`/whatsapp/conversations${qs({ channel, q: dq, unread: unreadOnly ? 'true' : '' })}`),
    refetchInterval: 20_000,
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

  // Optimistic read handler
  const handleSelectChat = (c: any) => {
    setParam({ c: c.id });
    if (c.unreadCount > 0) {
      qc.setQueryData(['conversations', channel, dq, unreadOnly], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((item) => (item.id === c.id ? { ...item, unreadCount: 0 } : item));
      });
      api(`/whatsapp/conversations/${c.id}/read`, { method: 'POST', body: {} })
        .then(() => refreshAll())
        .catch(() => undefined);
    }
  };

  const activeThreadQuery = useQuery({
    queryKey: ['wa-thread', active],
    queryFn: () => api<any>(`/whatsapp/conversations/${active}/messages`),
    enabled: !!active && channel === 'WHATSAPP',
  });

  // Current conversation resolution (searches list first, fallbacks to thread query data)
  const current = useMemo(() => {
    if (!active) return null;
    const found = convs.data?.find((c) => c.id === active);
    if (found) return found;
    if (activeThreadQuery.data?.conversation) return activeThreadQuery.data.conversation;
    return null;
  }, [active, convs.data, activeThreadQuery.data]);

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
  const totalUnreadCount = unreadStats.data?.total?.unreadConversations ?? (waUnreadCount + chatUnreadCount);
  const currentChannelUnread = channel === 'WHATSAPP' ? waUnreadCount : chatUnreadCount;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-64px)] sm:-mx-6 lg:-mx-8 bg-surface overflow-hidden">
      {/* Left Conversations Sidebar */}
      <aside className={cn('flex w-full flex-col border-r border-line bg-surface md:w-[360px] lg:w-[380px] md:shrink-0', active && 'hidden md:flex')}>
        {/* Header Block */}
        <div className="space-y-3.5 border-b border-line p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-extrabold tracking-tight text-fg">Inbox</h1>
              {totalUnreadCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 text-xs font-bold">
                  {totalUnreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted hover:text-fg"
                onClick={refreshAll}
                title="रिफ्रेश करें"
              >
                <RefreshCw className="size-3.5" />
              </Button>
              {channel === 'WHATSAPP' && status.data && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border shadow-2xs',
                    status.data.connected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', status.data.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
                  {status.data.connected ? (status.data.displayPhone ?? 'Connected') : 'Not connected'}
                </span>
              )}
            </div>
          </div>

          {/* Channel Selector with Beautiful Tabs & Live Badges */}
          <div className="grid grid-cols-2 rounded-xl bg-surface-2 p-1 border border-line">
            <button
              type="button"
              onClick={() => setParam({ channel: 'WHATSAPP', c: null })}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold transition-all',
                channel === 'WHATSAPP'
                  ? 'bg-surface text-fg shadow-xs border border-line/40'
                  : 'text-muted hover:text-fg',
              )}
            >
              <MessageSquare className="size-3.5 text-emerald-600" />
              <span>WhatsApp</span>
              {waUnreadCount > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white shadow-2xs">
                  {waUnreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setParam({ channel: 'CHAT', c: null })}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold transition-all',
                channel === 'CHAT'
                  ? 'bg-surface text-fg shadow-xs border border-line/40'
                  : 'text-muted hover:text-fg',
              )}
            >
              <Globe className="size-3.5 text-indigo-600" />
              <span>Website chat</span>
              {chatUnreadCount > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white shadow-2xs">
                  {chatUnreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                icon={<Search className="size-4 text-subtle" />}
                className="h-9 pr-7 rounded-xl bg-surface-2 border-line text-xs focus-within:bg-surface"
                placeholder="नाम / नंबर खोजें..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-fg"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 rounded-xl border px-3 h-9 text-xs font-semibold transition shadow-2xs',
                unreadOnly
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-line bg-surface-2 text-muted hover:text-fg hover:bg-surface',
              )}
            >
              <span>Unread</span>
              {currentChannelUnread > 0 && (
                <span className={cn('rounded-full px-1.5 text-[10px] font-bold', unreadOnly ? 'bg-white/20 text-white' : 'bg-emerald-600 text-white')}>
                  {currentChannelUnread}
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
              icon={<MessagesSquare className="size-8 text-subtle" />}
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
          {convs.data?.map((c) => {
            const displayName = c.contactName || c.lead?.name || c.contactPhone || 'Housing Client';
            const gradient = getAvatarGradient(displayName);
            const isSelected = c.id === active;
            return (
              <div
                key={c.id}
                onClick={() => handleSelectChat(c)}
                className={cn(
                  'group relative flex w-full cursor-pointer items-start gap-3 p-3.5 text-left transition-all',
                  isSelected
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-l-[3.5px] border-emerald-600 shadow-2xs'
                    : 'hover:bg-surface-2',
                )}
              >
                <div className={cn('size-10 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-2xs shrink-0 bg-gradient-to-tr', gradient)}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('truncate text-sm text-fg', c.unreadCount ? 'font-bold' : 'font-semibold')}>
                      {displayName}
                    </p>
                    <span className="shrink-0 text-[11px] text-subtle font-medium">{c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={cn('truncate text-xs', c.unreadCount ? 'font-semibold text-fg' : 'text-muted')}>
                      {c.lastPreview ?? '—'}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {c.unreadCount > 0 && (
                        <span className="grid min-w-5 place-items-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white shadow-2xs">
                          {c.unreadCount}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(c);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition rounded-lg p-1 text-subtle hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15"
                        title="चैट हटाएं (Delete Chat)"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  {c.lead && (
                    <div className="mt-1 flex items-center justify-between text-[11px] text-subtle">
                      <span className="truncate">Lead · {c.lead.assignedTo?.name ?? 'Unassigned'}</span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[10px] font-medium text-fg">
                        {c.lead.stage}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right Active Chat Window */}
      <section className={cn('flex min-w-0 flex-1 flex-col bg-bg/40', !active && 'hidden md:flex')}>
        {!active ? (
          <div className="grid flex-1 place-items-center p-8 text-center bg-surface">
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
            {/* Active Chat Header */}
            <header className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3 shadow-2xs z-10">
              <button
                className="md:hidden rounded-lg p-1.5 -ml-1 text-muted hover:text-fg hover:bg-surface-2"
                onClick={() => setParam({ c: null })}
                aria-label="Back"
              >
                <ArrowLeft className="size-5" />
              </button>

              {/* Contact Avatar & Info */}
              <div className={cn('size-10 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-2xs shrink-0 bg-gradient-to-tr', getAvatarGradient(current?.contactName || current?.lead?.name || current?.contactPhone || 'Contact'))}>
                {(current?.contactName || current?.lead?.name || current?.contactPhone || 'C').charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold text-base text-fg">
                    {current?.contactName || current?.lead?.name || current?.contactPhone || 'Customer'}
                  </p>
                  {channel === 'WHATSAPP' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                      WhatsApp
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                      Website Chat
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                  {current?.contactPhone && (
                    <a href={`tel:${current.contactPhone}`} className="flex items-center gap-1 hover:text-emerald-600 hover:underline">
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

              {/* Action Buttons in Header */}
              <div className="flex items-center gap-2">
                {current?.lead && (
                  <Link
                    href={`/broker/leads/${current.lead.id}`}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:bg-surface transition shadow-2xs"
                  >
                    <span className="text-muted">Lead:</span>
                    <StageBadge stage={current.lead.stage} />
                  </Link>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(current)}
                  className="text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition flex items-center gap-1.5 rounded-xl border border-transparent hover:border-rose-200"
                  title="Delete chat (चैट हटाएं - Lead सुरक्षित रहेगी)"
                >
                  <Trash2 className="size-4" />
                  <span className="hidden sm:inline text-xs font-semibold">Delete chat</span>
                </Button>
              </div>
            </header>

            {/* Conversation Stream */}
            {channel === 'CHAT' ? (
              <div className="min-h-0 flex-1">
                <ChatThread id={active} side="broker" onRead={refreshAll} />
              </div>
            ) : (
              <WaThread id={active} connected={!!status.data?.connected} onRead={refreshAll} />
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
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
            <p className="font-bold flex items-center gap-1.5 text-sm">
              <Check className="size-4 text-emerald-600" /> आपकी Lead 100% सुरक्षित रहेगी!
            </p>
            <p className="mt-1.5 leading-relaxed">
              {deleteTarget?.lead
                ? `इस बातचीत से संबद्ध Lead (${deleteTarget.lead.name || 'Lead'}) का डेटाबेस रिकॉर्ड, स्थिति और विवरण डिलीट नहीं होंगे। सिर्फ चैट और संदेश इतिहास हटाया जाएगा।`
                : 'यह क्रिया इस बातचीत और इसके सभी संदेशों को हटा देगी।'}
            </p>
          </div>
          <p className="text-xs text-muted">
            डिलीट करने के बाद आप इस कॉन्टैक्ट के साथ कभी भी नया मैसेज भेजकर नई बातचीत शुरू कर सकते हैं।
          </p>
        </div>
      </Dialog>
    </div>
  );
}

const TICKS: Record<string, React.ReactNode> = {
  QUEUED: <Clock className="size-3 text-emerald-100/70" />,
  SENT: <Check className="size-3 text-emerald-100/80" />,
  DELIVERED: <CheckCheck className="size-3 text-emerald-100/80" />,
  READ: <CheckCheck className="size-3 text-[#53bdeb]" />,
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
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [q.data?.items?.length]);

  const send = async (body: Record<string, unknown>) => {
    setSending(true);
    setNotConfigured(null);
    try {
      await post('/whatsapp/send', { conversationId: id, ...body });
      setText('');
      q.refetch();
      onReadRef.current();
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
      {/* Message List Canvas */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5 bg-bg/50">
        {grouped.map((g) => (
          <div key={g.day} className="space-y-3">
            <div className="flex justify-center sticky top-0 z-10 my-2">
              <span className="rounded-full bg-surface/90 backdrop-blur-md px-4 py-1 text-[11px] font-semibold text-muted shadow-xs border border-line">
                {g.day}
              </span>
            </div>
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
                        'max-w-[78%] sm:max-w-[65%] rounded-2xl px-4 py-2.5 text-sm shadow-xs transition',
                        out
                          ? 'rounded-tr-xs bg-gradient-to-br from-[#005c4b] via-[#006a57] to-[#008069] text-white'
                          : 'rounded-tl-xs bg-surface border border-line text-fg shadow-2xs',
                      )}
                    >
                      {m.mediaUrl && m.type === 'IMAGE' && (
                        <img src={m.mediaUrl} alt="Media" className="mb-2 max-h-72 rounded-xl object-cover shadow-2xs" />
                      )}
                      {m.templateName && (
                        <p className={cn('mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider', out ? 'text-emerald-100/90' : 'text-subtle')}>
                          <FileText className="size-3" /> {m.templateName}
                        </p>
                      )}
                      <p className="break-words whitespace-pre-line leading-relaxed text-[13.5px]">
                        {m.body ?? (m.type !== 'TEXT' ? `[${m.type.toLowerCase()}]` : '')}
                      </p>
                      <p className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', out ? 'text-emerald-100/80' : 'text-subtle font-medium')}>
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
        {!q.data?.items.length && <p className="py-12 text-center text-sm text-subtle">अभी कोई संदेश नहीं है</p>}
        <div ref={end} />
      </div>

      {/* Modern Composer Dock */}
      <div className="border-t border-line bg-surface p-3 sm:p-4 space-y-2.5 shadow-2xs">
        {notConfigured?.body.integration && (
          <div className="mb-2">
            <IntegrationBanner compact name={notConfigured.body.integration.name} message={notConfigured.body.message} />
          </div>
        )}

        {/* 24-Hour Window Alert */}
        {!windowOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <Clock className="size-3.5 text-amber-600" />
            <span className="flex-1 leading-normal">24-घंटे की window बंद है — WhatsApp नियम के अनुसार केवल approved template भेज सकते हैं।</span>
            <Button size="xs" variant="secondary" onClick={() => setTplOpen(true)}>
              Template भेजें
            </Button>
          </div>
        )}

        {/* Canned Quick Replies with Beautiful Horizontal Scroll */}
        {windowOpen && connected && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-subtle shrink-0 mr-1">
              <Sparkles className="size-3 text-emerald-600" />
              त्वरित उत्तर:
            </span>
            {CANNED_REPLIES.map((cr, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setText((prev) => (prev ? `${prev} ${cr}` : cr))}
                className="shrink-0 rounded-full border border-line bg-surface-2 px-3.5 py-1 text-xs text-muted transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 shadow-2xs"
              >
                {cr}
              </button>
            ))}
          </div>
        )}

        {/* Modern Rounded Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send({ text });
          }}
          className="flex items-end gap-2 bg-surface-2 border border-line rounded-2xl p-1.5 focus-within:bg-surface focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition shadow-inner"
        >
          <div className="flex items-center gap-0.5 pb-1 pl-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShareOpen(true)}
              aria-label="Share property"
              title="प्रॉपर्टी शेयर करें"
              className="size-8 rounded-xl text-muted hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <Building2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setTplOpen(true)}
              aria-label="Templates"
              title="WhatsApp Templates"
              className="size-8 rounded-xl text-muted hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <FileText className="size-4" />
            </Button>
          </div>
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
            className="border-0 bg-transparent py-2 text-sm text-fg placeholder:text-muted focus:ring-0 focus:outline-none resize-none max-h-36 min-h-[38px] leading-normal flex-1"
          />
          <Button
            type="submit"
            size="icon"
            variant="whatsapp"
            loading={sending}
            disabled={!windowOpen || !text.trim()}
            aria-label="Send"
            className="size-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-md active:scale-95 shrink-0"
          >
            {!sending && <Send className="size-4" />}
          </Button>
        </form>
      </div>

      <TemplateDialog
        open={tplOpen}
        onOpenChange={setTplOpen}
        name={q.data?.conversation?.contactName || q.data?.conversation?.lead?.name}
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
