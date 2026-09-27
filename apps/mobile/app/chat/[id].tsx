import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send } from 'lucide-react-native';
import { api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { useRealtime } from '@/lib/realtime';
import { fonts, useTheme } from '@/lib/theme';
import { ErrorView, Header, IconBtn, Loader, Txt } from '@/ui';

/** In-app chat thread. Works for both sides: the user (INBOUND = mine) and broker (OUTBOUND = mine). */
export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { c } = useTheme();
  const { isBroker } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['chat', id], queryFn: () => api<any>(`/chat/threads/${id}`) });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList>(null);
  useRealtime<any>('chat:message', (d) => d.conversationId === id && qc.invalidateQueries({ queryKey: ['chat', id] }));
  useEffect(() => {
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 100);
  }, [q.data?.items?.length]);
  const mine = (m: any) => (isBroker ? m.direction === 'OUTBOUND' : m.direction === 'INBOUND');
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      await post(`/chat/threads/${id}`, { text: t });
      setText('');
      q.refetch();
      qc.invalidateQueries({ queryKey: ['chat-threads'] });
    } catch (e) {
      showError(e);
    } finally {
      setSending(false);
    }
  };
  const title = name ?? (isBroker ? q.data?.conversation?.contactName : q.data?.conversation?.organization?.name);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={title ?? 'Chat'} subtitle="Real-time chat" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {q.isLoading ? <Loader /> : q.isError ? <ErrorView error={q.error} onRetry={() => q.refetch()} /> : (
          <FlatList
            ref={list}
            data={q.data.items}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item: m }) => {
              const me = mine(m);
              return (
                <Animated.View entering={FadeInUp.duration(250)} style={{ alignItems: me ? 'flex-end' : 'flex-start' }}>
                  <View style={{ maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: me ? 6 : 20, borderBottomLeftRadius: me ? 20 : 6, backgroundColor: me ? c.brand : c.surface, borderWidth: me ? 0 : 1, borderColor: c.line }}>
                    <Txt color={me ? 'white' : 'fg'}>{m.body}</Txt>
                    <Txt v="caption" color={me ? 'rgba(255,255,255,0.7)' : 'subtle'} style={{ marginTop: 3, textAlign: 'right' }}>
                      {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                    </Txt>
                  </View>
                </Animated.View>
              );
            }}
          />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
          <TextInput value={text} onChangeText={setText} placeholder="Message लिखें…" placeholderTextColor={c.subtle} multiline style={{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, backgroundColor: c.surface2, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, color: c.fg, fontFamily: fonts.body, fontSize: 15 }} />
          <IconBtn onPress={send} style={{ backgroundColor: c.brand, width: 46, height: 46, borderRadius: 23, opacity: sending || !text.trim() ? 0.5 : 1 }}>
            <Send size={19} color="#fff" />
          </IconBtn>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
