import { router, type Href } from 'expo-router';
import { nativeHomeForRole } from '@/launch/routes';
import { authStore } from './api';

export function goBack(fallback: Href = nativeHomeForRole(authStore.get()?.user.role)) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
