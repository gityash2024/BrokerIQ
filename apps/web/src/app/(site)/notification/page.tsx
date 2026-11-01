'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { notificationDestination, notificationInbox, notificationPath, type AppNotification } from '@brokeriq/shared';
import { api, authStore } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig, useConfigStatus } from '@/lib/config';

function OpenNotification() {
  const { user, ready } = useAuth();
  const userId = user?.id;
  const role = user?.role;
  const config = useConfig();
  const { loaded } = useConfigStatus();
  const params = useSearchParams();
  const router = useRouter();
  const client = useQueryClient();
  const id = params.get('notification');
  const [error, setError] = useState('');
  const [external, setExternal] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !loaded) return;
    if (!userId || !role) {
      router.replace('/login?next=' + encodeURIComponent('/notification?notification=' + (id ?? '')));
      return;
    }
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
      setError('Notification unavailable.');
      return;
    }
    let active = true;
    setError('');
    setExternal(null);
    api<AppNotification>(`/me/notifications/${id}/open`, { method: 'POST', body: {} })
      .then((note) => {
        if (!active || authStore.get()?.user.id !== userId) return;
        void client.invalidateQueries({ queryKey: ['notifications'] });
        const target = notificationDestination(note.link, role, false, config.modules, window.location.origin);
        if (target) {
          router.replace(target);
          return;
        }
        try {
          const url = new URL(note.link ?? '');
          if (!notificationPath(note.link, window.location.origin) && url.protocol === 'https:' && !url.username && !url.password) {
            setExternal(url.href);
            return;
          }
        } catch {}
        setError('यह destination उपलब्ध नहीं है या आपके role में अनुमति नहीं है।');
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [ready, userId, role, id, loaded, config.modules, client, router]);
  return (
    <main className="mx-auto max-w-xl p-8 space-y-4">
      <h1 className="text-xl font-bold">Notifications</h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : external ? (
        <>
          <p>इस website पर जाएँ: {new URL(external).hostname}</p>
          <a className="btn-primary" href={external} rel="noopener noreferrer">
            Open website
          </a>
        </>
      ) : (
        <p>Opening notification…</p>
      )}
      {user && (
        <Link href={notificationInbox(user.role)} className="block text-brand-600">
          All notifications
        </Link>
      )}
    </main>
  );
}
export default function NotificationEntry() {
  return (
    <Suspense fallback={<p className="p-8">Opening notification…</p>}>
      <OpenNotification />
    </Suspense>
  );
}
