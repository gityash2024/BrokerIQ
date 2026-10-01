'use client';
import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFlag } from '@/lib/config';
import { Button } from '../ui/button';

const DISMISS_KEY = 'biq_push_dismissed';
const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (ch) => ch.charCodeAt(0));
};

async function subscribe() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  const { publicKey } = await api<{ publicKey: string }>('/public/webpush-key', { auth: false });
  const sub =
    (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  await api('/me/push-tokens', { method: 'POST', body: { platform: 'web', token: JSON.stringify(sub.toJSON()) } });
}

/**
 * Asks for browser notifications only after the user has done something worth being notified about
 * (signed in and spent a little time), never on first visit; "बाद में" is remembered for 14 days.
 * Already-granted browsers re-register silently so the subscription stays fresh.
 */
export function WebPushPrompt() {
  const { user } = useAuth();
  const on = useFlag('web_push');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!on || !user || !supported()) return;
    if (Notification.permission === 'granted') {
      subscribe().catch(() => undefined);
      return;
    }
    if (Notification.permission === 'denied') return;
    let dismissed = 0;
    try {
      dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    } catch {
      /* ignore */
    }
    if (Date.now() - dismissed < 14 * 86_400_000) return;
    const t = setTimeout(() => setShow(true), 20_000);
    return () => clearTimeout(t);
  }, [on, user]);
  if (!show) return null;
  const later = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };
  const allow = async () => {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) === 'granted') await subscribe();
    } catch {
      /* the browser refused; nothing else to do */
    } finally {
      setBusy(false);
      setShow(false);
    }
  };
  return (
    <div className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-xl sm:left-auto">
      <button onClick={later} className="absolute top-3 right-3 text-muted" aria-label="Close">
        <X className="size-4" />
      </button>
      <p className="flex items-center gap-2 font-semibold">
        <BellRing className="size-5 text-brand-600" /> Notifications चालू करें?
      </p>
      <p className="mt-1 text-sm text-muted">नई matching properties, broker के जवाब और visit reminders तुरंत — browser बंद हो तब भी।</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" loading={busy} onClick={allow}>
          चालू करें
        </Button>
        <Button size="sm" variant="ghost" onClick={later}>
          बाद में
        </Button>
      </div>
    </div>
  );
}
