import { router } from 'expo-router';
import { notificationDestination, notificationPath, type PublicConfig } from '@brokeriq/shared';
import { authStore } from './api';
import { queryClient } from './query';
import { Alert, Linking } from 'react-native';
import { toast } from './toast';

/** Shared mapping; target APIs still authorize current record ownership. */
export function openLink(link?: string | null) {
  const user = authStore.get()?.user;
  const config = queryClient.getQueryData<PublicConfig>(['public-config']);
  const target = notificationDestination(link, user?.role ?? 'PUBLIC', true, config?.modules);
  if (target) return router.push(target as any);
  try {
    const url = new URL(link ?? '');
    if (!notificationPath(link) && url.protocol === 'https:' && !url.username && !url.password) {
      Alert.alert('Open website?', url.hostname, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open',
          onPress: () => {
            Linking.openURL(url.href).catch(() => toast.error('Website नहीं खुली।'));
          },
        },
      ]);
      return;
    }
  } catch {}
  toast.info('यह destination इस app में उपलब्ध नहीं है। Notification सुरक्षित है।');
}
