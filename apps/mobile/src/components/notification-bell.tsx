import { Pressable, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import type { NotificationsResponse } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { tr } from '@/lib/i18n';

export function NotificationBell() {
  const { user } = useAuth();
  const { c } = useTheme();
  const path = usePathname();
  const q = useQuery({
    queryKey: ['notifications', user?.id, 'summary'],
    queryFn: () => api<NotificationsResponse>('/me/notifications?unread=true'),
    enabled: !!user,
    refetchInterval: 60_000,
  });
  if (!user || path === '/notifications') return null;
  const unread = q.data?.unreadCount ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tr('Notifications')}${unread ? ` (${unread})` : ''}`}
      onPress={() => router.push('/notifications')}
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surface2,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <Bell size={19} color={c.fg} />
      {unread > 0 && (
        <View style={{ position: 'absolute', top: -3, right: -4, backgroundColor: c.danger, borderRadius: 10, minWidth: 17, paddingHorizontal: 3 }}>
          <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center', fontWeight: '700' }}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}
