import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, Plug, Search } from 'lucide-react-native';
import { timeAgo } from '@brokeriq/shared';
import { api, qs } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { useRealtime } from '@/lib/realtime';
import { useTheme } from '@/lib/theme';
import { StageBadge } from '@/components/crm';
import { Avatar, Button, Card, Chip, Empty, ErrorView, Input, PressableScale, Row, Segmented, Skeleton, Txt } from '@/ui';

export default function Inbox() {
  const { c } = useTheme();
  const [channel, setChannel] = useState<'WHATSAPP' | 'CHAT'>('WHATSAPP');
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(false);
  const q = useDebounced(text);
  const status = useQuery({ queryKey: ['wa-status'], queryFn: () => api<any>('/whatsapp/status'), staleTime: 60_000 });
  const list = useQuery({ queryKey: ['conversations', channel, q, unread], queryFn: () => api<any[]>(`/whatsapp/conversations${qs({ channel, q, unread: unread ? 'true' : '' })}`) });
  useRealtime('wa:message', () => list.refetch());
  useRealtime('chat:message', () => list.refetch());
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="h1">Inbox</Txt>
          {channel === 'WHATSAPP' && status.data && (
            <Row gap={6} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: status.data.connected ? `${c.success}1f` : `${c.warning}1f` }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: status.data.connected ? c.success : c.warning }} />
              <Txt v="caption" color={status.data.connected ? 'success' : 'warning'}>{status.data.connected ? status.data.displayPhone ?? 'Connected' : 'Not connected'}</Txt>
            </Row>
          )}
        </Row>
        <Segmented value={channel} onChange={setChannel} options={[{ value: 'WHATSAPP', label: 'WhatsApp' }, { value: 'CHAT', label: 'App / website chat' }]} />
        <Row>
          <Input value={text} onChangeText={setText} placeholder="नाम / number" icon={<Search size={18} color={c.subtle} />} containerStyle={{ flex: 1 }} />
          <Chip label="Unread" active={unread} onPress={() => setUnread(!unread)} />
        </Row>
        {channel === 'WHATSAPP' && status.data && !status.data.connected && (
          <Card style={{ padding: 14, gap: 8, borderColor: `${c.warning}66` }}>
            <Row><Plug size={18} color={c.warning} /><Txt v="bodyStrong">WhatsApp Business connect नहीं है</Txt></Row>
            <Txt v="small" color="muted">अपना number connect करें — client के messages यहाँ आएँगे और automation चलेगा। (Firm admin → More → Lead connectors)</Txt>
            <Button title="Connectors खोलें" size="sm" variant="secondary" onPress={() => router.push('/connectors')} style={{ alignSelf: 'flex-start' }} />
          </Card>
        )}
      </View>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(x) => x.id}
        refreshing={list.isRefetching}
        onRefresh={() => list.refetch()}
        contentContainerStyle={{ paddingBottom: 130 }}
        ListEmptyComponent={list.isLoading ? <View style={{ padding: 16, gap: 10 }}><Skeleton h={64} /><Skeleton h={64} /></View> : list.isError ? <ErrorView error={list.error} /> : <Empty icon={<MessageCircle size={28} color={c.brand} />} title="कोई conversation नहीं" />}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 12) * 30)}>
            <PressableScale onPress={() => router.push(channel === 'CHAT' ? { pathname: '/chat/[id]', params: { id: item.id, name: item.contactName } } : { pathname: '/wa/[id]', params: { id: item.id } })} style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.line }}>
              <Avatar name={item.contactName || item.contactPhone} uri={item.user?.avatarUrl} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{item.contactName || item.contactPhone}</Txt>
                  <Txt v="caption" color="subtle">{item.lastMessageAt ? timeAgo(item.lastMessageAt) : ''}</Txt>
                </Row>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="small" color={item.unreadCount ? 'fg' : 'muted'} numberOfLines={1} style={{ flex: 1 }}>{item.lastPreview ?? '—'}</Txt>
                  {item.unreadCount > 0 && <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><Txt v="caption" color="white">{item.unreadCount}</Txt></View>}
                </Row>
                {item.lead && <StageBadge stage={item.lead.stage} />}
              </View>
            </PressableScale>
          </Animated.View>
        )}
      />
    </SafeAreaView>
  );
}
