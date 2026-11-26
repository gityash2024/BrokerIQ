'use client';
import { AssistantActivity, AssistantText } from './presentation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Mic, Send, Sparkles, Square, Volume2, VolumeX, Trash2, X } from 'lucide-react';
import { assistantDestination, languageOf, type AssistantPhase, type AssistantProgress } from '@brokeriq/shared';
import { useRealtime } from '@/lib/realtime';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

/**
 * Floating in-app AI agent (bottom-right). Text or voice; it acts only inside the signed-in
 * account and asks before changing anything. Hidden on auth pages.
 */
type Msg = {
  role: 'user' | 'assistant';
  content: string;
  cards?: { type: 'listings' | 'leads'; items: any[] };
  pending?: { token: string; summary: string };
  resolved?: 'done' | 'cancelled' | 'failed';
};
const HIDDEN = ['/login', '/signup', '/forgot'];

function useLang() {
  const [lang, setLang] = useState('hi');
  useEffect(() => {
    const read = () => {
      try {
        setLang(localStorage.getItem('biq.lang') || 'hi');
      } catch {
        /* ignore */
      }
    };
    read();
    window.addEventListener('biq-lang', read);
    return () => window.removeEventListener('biq-lang', read);
  }, []);
  return lang;
}

const blobToBase64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(b);
  });

export function AssistantWidget() {
  const { user } = useAuth();
  const scope = JSON.stringify([user?.id, user?.organizationId, user?.role, user?.rolePermissions, user?.agentChatEnabled]);
  return <AssistantSession key={scope} />;
}

function AssistantSession() {
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [memoryReady, setMemoryReady] = useState(false);
  const userId = user?.id;
  useEffect(() => {
    if (!open || !userId || memoryReady) return;
    let active = true;
    void api<{ messages: Msg[] }>('/assistant/history')
      .then(({ messages }) => {
        if (active) {
          setMsgs((current) => (current.length ? current : messages));
          setMemoryReady(true);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open, userId, memoryReady]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [phases, setPhases] = useState<AssistantPhase[]>([]);
  const request = useRef<string | undefined>(undefined);
  useRealtime<AssistantProgress>('assistant.progress', ({ requestId, phase }) => {
    if (request.current === requestId) setPhases((previous) => (previous.at(-1) === phase ? previous : [...previous.slice(-3), phase]));
  });
  const start = (phase: AssistantPhase) => {
    const requestId = globalThis.crypto?.randomUUID?.();
    request.current = requestId;
    setPhases([phase]);
    setBusy(true);
    return requestId;
  };
  const finish = () => {
    request.current = undefined;
    setPhases([]);
    setBusy(false);
  };
  const [recording, setRecording] = useState(false);
  const [speak, setSpeak] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      const recorder = recRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
      window.speechSynthesis?.cancel();
    },
    [],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [msgs, phases, open]);
  if (!ready || HIDDEN.includes(pathname)) return null;

  const say = (content: string) => {
    if (!speak || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(content.replace(/[*_#`]/g, ''));
    u.lang = languageOf(lang).speech;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };
  const context = () => {
    const m = pathname.match(/^\/((?:user\/)?property|broker\/leads|broker\/listings)\/([^/]+)/);
    return { path: pathname, entityId: m?.[2] };
  };

  const send = async (content: string) => {
    const q = content.trim().slice(0, 4000);
    if (!q || busy) return;
    const history: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs(history);
    setText('');
    const requestId = start('understanding');
    try {
      const r = await api<any>('/assistant/chat', {
        method: 'POST',
        body: {
          requestId,
          rememberConversation: memoryReady,
          messages: (memoryReady ? history.slice(-1) : history.slice(-16)).map(({ role, content }) => ({ role, content: content.slice(0, 4000) })),
          lang,
          context: context(),
        },
      });
      setMsgs((m) => [...m, { role: 'assistant', content: r.reply, cards: r.cards, pending: r.pending }]);
      say(r.reply);
    } catch (e) {
      const notConfigured = e instanceof ApiError && e.isNotConfigured;
      setMsgs((m) => [
        ...m,
        {
          role: 'assistant',
          content: notConfigured ? 'AI assistant के लिए Admin → Settings → Integrations में AI providers जाँचें।' : `⚠️ ${errorMessage(e)}`,
        },
      ]);
    } finally {
      finish();
    }
  };

  const resolve = async (i: number, ok: boolean) => {
    const p = msgs[i].pending!;
    const resolveAs = (resolved: Msg['resolved']) => setMsgs((m) => m.map((x, k) => (k === i ? { ...x, resolved } : x)));
    if (busy) return;
    if (!ok) {
      resolveAs('cancelled');
      api('/assistant/cancel', { method: 'POST', body: { token: p.token } }).catch(() => undefined);
      return;
    }
    const requestId = start('applying');
    try {
      const r = await api<any>('/assistant/confirm', { method: 'POST', body: { token: p.token, lang, requestId } });
      resolveAs(r.actionSucceeded === false ? 'failed' : 'done');
      const receipt = r.receipt
        ? Object.entries(r.receipt)
            .map(([label, value]) => label + ' ' + value)
            .join(' · ')
        : '';
      setMsgs((m) => [...m, { role: 'assistant', content: [r.reply, receipt].filter(Boolean).join('\n'), cards: r.cards }]);
      say(r.reply);
    } catch (e) {
      resolveAs('failed');
      setMsgs((m) => [...m, { role: 'assistant', content: `⚠️ ${errorMessage(e)}` }]);
    } finally {
      finish();
    }
  };

  const toggleMic = async () => {
    if (recording) return recRef.current?.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 800) return;
        start('transcribing');
        try {
          const r = await api<{ text: string }>('/assistant/transcribe', { method: 'POST', body: { audio: await blobToBase64(blob), mime: blob.type, lang } });
          finish();
          if (r.text) await send(r.text);
        } catch (e) {
          finish();
          setMsgs((m) => [...m, { role: 'assistant', content: `⚠️ ${errorMessage(e)}` }]);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      setTimeout(() => rec.state === 'recording' && rec.stop(), 30_000);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Microphone की permission नहीं मिली — browser settings में allow करें।' }]);
    }
  };

  if (user?.role === 'SUB_BROKER_ADMIN' && !user.delegatedPermissions?.includes('assistant:view')) return null;
  const onProperty = /^\/(?:user\/)?property\//.test(pathname);
  const hints = !user
    ? []
    : user.role === 'SUPER_ADMIN' || user.role === 'MODERATOR'
      ? ['Approval के लिए कितनी listings pending हैं?', 'आज का platform overview']
      : user.role === 'PROPERTY_OWNER'
        ? ['मेरी properties दिखाओ', 'मेरी properties की availability बताओ']
        : user.role === 'USER'
          ? ['Sector 65 में 3 BHK furnished, 60k तक', '40k rent पर move-in cost कितना होगा?', 'मेरी enquiries दिखाओ']
          : ['आज का agenda बताओ', 'Hot leads दिखाओ', 'नई lead जोड़ो: Rahul 98xxxxxxx'];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="AI assistant"
        className={cn(
          'fixed right-4 z-40 grid size-14 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-2xl shadow-brand-600/40 transition hover:scale-105',
          onProperty ? 'bottom-24 md:bottom-6' : 'bottom-40 lg:bottom-24',
          open && 'pointer-events-none opacity-0',
        )}
      >
        <Sparkles className="size-6" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            className="fixed inset-x-2 bottom-2 z-50 flex h-[min(640px,calc(100dvh-16px))] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl sm:right-4 sm:bottom-4 sm:left-auto sm:w-[400px]"
          >
            <div className="flex items-center gap-3 bg-gradient-to-br from-brand-700 to-violet-700 px-4 py-3 text-white">
              <span className="grid size-9 place-items-center rounded-xl bg-white/15">
                <Sparkles className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold">BrokerIQ Assistant</p>
                <p className="truncate text-xs text-white/70">बोलकर या लिखकर — आपके account में, आपकी अनुमति से</p>
              </div>
              {memoryReady && msgs.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  className="grid size-8 place-items-center rounded-lg hover:bg-white/10 disabled:opacity-50"
                  aria-label="Clear assistant history"
                  onClick={async () => {
                    if (!window.confirm('Clear your saved BrokerIQ Assistant history?')) return;
                    setBusy(true);
                    try {
                      await api('/assistant/history', { method: 'DELETE' });
                      setMsgs([]);
                    } catch (error) {
                      setMsgs((m) => [...m, { role: 'assistant', content: errorMessage(error) }]);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <button onClick={() => setSpeak(!speak)} className="grid size-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Voice replies">
                {speak ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </button>
              <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {!user ? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <p className="font-semibold">Assistant आपके account में काम करता है</p>
                    <p className="mt-1 text-sm text-muted">Login करके घर खोजें, enquiry भेजें, listing डालें — बस बोलकर।</p>
                    <Button href={`/login?next=${encodeURIComponent(pathname)}`} className="mt-4">
                      Login करें
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {!msgs.length && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted">नमस्ते {user.name.split(' ')[0]} 👋 मैं आपकी कैसे मदद करूँ?</p>
                      {hints.map((h) => (
                        <button
                          key={h}
                          onClick={() => send(h)}
                          className="block w-full rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-500/10"
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  )}
                  {msgs.map((m, i) => (
                    <div key={i} className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}>
                      <div
                        className={cn(
                          'max-w-[88%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap',
                          m.role === 'user' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-surface-2',
                        )}
                      >
                        {m.role === 'assistant' ? (
                          <AssistantText
                            content={m.content}
                            cardUrls={m.cards?.items.map((item) => item.url) ?? []}
                            staff={user?.role === 'SUPER_ADMIN' || user?.role === 'MODERATOR'}
                            onNavigate={() => setOpen(false)}
                          />
                        ) : (
                          m.content
                        )}
                      </div>
                      {m.cards?.type === 'listings' && (
                        <div className="w-full space-y-1.5">
                          {m.cards.items
                            .filter((item) => assistantDestination(item.url))
                            .map((l) => (
                              <Link
                                key={l.id}
                                href={assistantDestination(l.url)!}
                                onClick={() => setOpen(false)}
                                className="block rounded-xl border border-line px-3 py-2 text-sm hover:border-brand-400"
                              >
                                <p className="truncate font-semibold">{l.title}</p>
                                <p className="text-xs text-muted">
                                  {[l.purpose, l.priceText ?? l.rentText, l.locality, l.bedrooms ? `${l.bedrooms} BHK` : null].filter(Boolean).join(' · ')}
                                </p>
                              </Link>
                            ))}
                        </div>
                      )}
                      {m.cards?.type === 'leads' && (
                        <div className="w-full space-y-1.5">
                          {m.cards.items
                            .filter((item) => assistantDestination(item.url))
                            .map((l) => (
                              <Link
                                key={l.id}
                                href={assistantDestination(l.url)!}
                                onClick={() => setOpen(false)}
                                className="block rounded-xl border border-line px-3 py-2 text-sm hover:border-brand-400"
                              >
                                <p className="font-semibold">{l.name}</p>
                                <p className="text-xs text-muted">{[l.phone, l.stage, l.temperature].filter(Boolean).join(' · ')}</p>
                              </Link>
                            ))}
                        </div>
                      )}
                      {m.pending && (
                        <div className="w-full rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
                          <p className="font-semibold">{m.pending.summary}</p>
                          {m.resolved ? (
                            <p className="mt-1 text-xs text-muted">
                              {m.resolved === 'done' ? '✅ Confirmed' : m.resolved === 'failed' ? 'Could not confirm' : 'रद्द किया'}
                            </p>
                          ) : (
                            <div className="mt-2 flex gap-2">
                              <Button size="sm" onClick={() => resolve(i, true)} disabled={busy}>
                                <Check className="size-4" /> हाँ, करें
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => resolve(i, false)} disabled={busy}>
                                रहने दें
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {busy && phases.length > 0 && <AssistantActivity phases={phases} lang={lang} />}
                  <div ref={endRef} />
                </>
              )}
            </div>

            {user && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(text);
                }}
                className="flex items-center gap-2 border-t border-line p-3"
              >
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={busy && !recording}
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full border',
                    recording ? 'animate-pulse border-rose-500 bg-rose-500 text-white' : 'border-line text-muted hover:text-brand-600',
                  )}
                  aria-label={recording ? 'Stop' : 'Speak'}
                >
                  {recording ? <Square className="size-4" /> : <Mic className="size-5" />}
                </button>
                <input
                  value={text}
                  maxLength={4000}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={recording ? 'सुन रहा हूँ… (रोकने के लिए ■)' : 'लिखें या mic दबाकर बोलें…'}
                  className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || busy}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
