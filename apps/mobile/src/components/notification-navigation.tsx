import { useEffect, useRef, useState } from 'react';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { authStore } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query';
import { openLink } from '@/lib/links';

/** Both cold-start and foreground taps wait for hydration and an authenticated navigator. */
export function NotificationNavigation() {
  const { user } = useAuth();
  const userId = user?.id;
  const role = user?.role;
  const navigation = useRootNavigationState();
  const pathname = usePathname();
  const waitingForLogin = useRef(false);
  const [pending, setPending] = useState<Notifications.NotificationResponse | null>(null);
  const handled = useRef(new Set<string>());
  useEffect(() => {
    const accept = (response: Notifications.NotificationResponse | null) => {
      if (response) setPending((current) => (!current || response.notification.date >= current.notification.date ? response : current));
    };
    const sub = Notifications.addNotificationResponseReceivedListener(accept);
    const receive = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    Notifications.getLastNotificationResponseAsync()
      .then(accept)
      .catch(() => undefined);
    return () => {
      sub.remove();
      receive.remove();
    };
  }, []);
  useEffect(() => {
    if (!pending || !navigation?.key) return;
    const key = pending.notification.request.identifier + ':' + pending.actionIdentifier;
    if (handled.current.has(key)) {
      setPending(null);
      return;
    }
    if (!userId) {
      waitingForLogin.current = true;
      router.push('/login');
      return;
    }
    if (waitingForLogin.current && pathname === '/login') return;
    waitingForLogin.current = false;
    let active = true;
    // Defer until this navigator commit, without racing a password/OTP login redirect.
    const timer = setTimeout(async () => {
      if (authStore.get()?.user.id !== userId) return;
      const data = pending.notification.request.content.data ?? {};
      handled.current.add(key);
      const belongs = typeof data.recipientUserId === 'string' && data.recipientUserId !== userId;
      if (belongs) toast.info('यह notification दूसरे account की है।');
      const notificationId = typeof data.notificationId === 'string' && /^[A-Za-z0-9_-]+$/.test(data.notificationId) ? data.notificationId : null;
      if (
        !belongs &&
        data.localReminder === true &&
        data.recipientUserId === userId &&
        typeof data.leadId === 'string' &&
        /^[A-Za-z0-9_-]+$/.test(data.leadId)
      ) {
        try {
          // A reassignment since scheduling must not grant access to the old agent.
          await api(`/leads/${data.leadId}`, { ownerId: userId });
          if (active && authStore.get()?.user.id === userId) openLink('/broker/leads/' + data.leadId);
        } catch {
          if (active && authStore.get()?.user.id === userId) {
            toast.info('Reminder की lead अब उपलब्ध नहीं है।');
            router.push('/notifications');
          }
        }
      } else {
        // Legacy notifications without an account-bound id open the inbox, never a raw URL.
        router.push(!belongs && notificationId ? `/notifications?notification=${notificationId}` : '/notifications');
      }
      if (active) setPending((current) => (current?.notification.request.identifier === pending.notification.request.identifier ? null : current));
      Notifications.getLastNotificationResponseAsync()
        .then((last) => {
          if (last?.notification.request.identifier === pending.notification.request.identifier) return Notifications.clearLastNotificationResponseAsync();
        })
        .catch(() => undefined);
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pending, userId, role, navigation?.key, pathname]);
  return null;
}
