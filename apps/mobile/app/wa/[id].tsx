import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Check, CheckCheck, Clock, FileText, Send, UserRound } from 'lucide-react-native';
import { renderTemplate } from '@brokeriq/shared';
import { api, post } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { useRealtime } from '@/lib/realtime';
import { toast } from '@/lib/toast';
import { fonts, useTheme } from '@/lib/theme';
import { tr } from '@/lib/i18n';
import { Button, Card, ErrorView, Header, IconBtn, Input, Loader, PressableScale, Row, Sheet, Txt } from '@/ui';

export default function WaThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['wa-thread', id], queryFn: () => api<any>(`/whatsapp/conversations/${id}/messages`) });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [tpl, setTpl] = useState(false);
  const list = useRef<FlatList>(null);
  useRealtime<any>('wa:message', (d) => d.conversationId === id && qc.invalidateQueries({ queryKey: ['wa-thread', id] }));
  useRealtime<any>('wa:status', (d) => d.conversationId === id && qc.invalidateQueries({ queryKey: ['wa-thread', id] }));
  useEffect(() => {
    if (q.data?.conversation?.unreadCount) post(`/whatsapp/conversations/${id}/read`).then(() => qc.invalidateQueries({ queryKey: ['conversations'] })).catch(() => undefined);
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 120);
  }, [q.data, id, qc]);
  const send = async (body: Record<string, unknown>) => {
    setSending(true);
    try {
      await post('/whatsapp/send', { conversationId: id, ...body });
      setText('');
      q.refetch();
      return true;
    } catch (e) {
      showError(e);
      return false;
    } finally {
      setSending(false);
    }
  };
  if (q.isLoading) return <Loader />;
  if (q.isError) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ErrorView error={q.error} onRetry={() => q.refetch()} /></SafeAreaView>;
  const conv = q.data.conversation;
  const windowOpen = q.data.windowOpen;
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={conv.contactName || conv.contactPhone} subtitle={conv.contactPhone} right={conv.leadId ? <IconBtn onPress={() => router.push(`/lead/${conv.leadId}`)}><UserRound size={20} color={c.brand} /></IconBtn> : undefined} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={q.data.items}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 14, gap: 6 }}
          renderItem={({ item: m }) => {
            const out = m.direction === 'OUTBOUND';
            const Tick = m.status === 'READ' ? CheckCheck : m.status === 'DELIVERED' ? CheckCheck : m.status === 'SENT' ? Check : m.status === 'FAILED' ? AlertTriangle : Clock;
            return (
              <Animated.View entering={FadeInUp.duration(220)} style={{ alignItems: out ? 'flex-end' : 'flex-start' }}>
                <View style={{ maxWidth: '82%', padding: 10, paddingHorizontal: 13, borderRadius: 18, borderBottomRightRadius: out ? 5 : 18, borderBottomLeftRadius: out ? 18 : 5, backgroundColor: out ? '#059669' : c.surface, borderWidth: out ? 0 : 1, borderColor: c.line }}>
                  {!!m.templateName && <Txt v="caption" color={out ? 'rgba(255,255,255,0.7)' : 'subtle'}>📄 {m.templateName}</Txt>}
                  <Txt color={out ? 'white' : 'fg'}>{m.body ?? `[${m.type.toLowerCase()}]`}</Txt>
                  <Row gap={4} style={{ alignSelf: 'flex-end', marginTop: 2 }}>
                    <Txt v="caption" color={out ? 'rgba(255,255,255,0.7)' : 'subtle'}>{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</Txt>
                    {out && <Tick size={13} color={m.status === 'READ' ? '#7DD3FC' : m.status === 'FAILED' ? '#FECACA' : 'rgba(255,255,255,0.8)'} />}
                  </Row>
                  {m.status === 'FAILED' && !!m.error && <Txt v="caption" color="#FECACA">{m.error}</Txt>}
                </View>
              </Animated.View>
            );
          }}
        />
        {!windowOpen && (
          <PressableScale onPress={() => setTpl(true)} style={{ marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: 14, backgroundColor: `${c.warning}1f`, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Clock size={16} color={c.warning} />
            <Txt v="caption" style={{ flex: 1 }}>24-घंटे की window बंद है — सिर्फ़ approved template भेज सकते हैं। Tap करें।</Txt>
          </PressableScale>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
          <IconBtn onPress={() => setTpl(true)}><FileText size={21} color={c.muted} /></IconBtn>
          <TextInput value={text} onChangeText={setText} editable={windowOpen} placeholder={tr(windowOpen ? 'Message…' : 'Template भेजें')} placeholderTextColor={c.subtle} multiline style={{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, backgroundColor: c.surface2, paddingHorizontal: 16, paddingVertical: 11, color: c.fg, fontFamily: fonts.body, fontSize: 15 }} />
          <IconBtn onPress={() => text.trim() && send({ text })} style={{ backgroundColor: '#25D366', width: 46, height: 46, borderRadius: 23, opacity: !windowOpen || sending || !text.trim() ? 0.5 : 1 }}>
            <Send size={19} color="#fff" />
          </IconBtn>
        </View>
      </KeyboardAvoidingView>
      <TemplateSheet open={tpl} onClose={() => setTpl(false)} name={conv.contactName} onSend={async (b) => (await send(b)) && (setTpl(false), toast.success('Template भेजा गया'))} />
    </SafeAreaView>
  );
}

function TemplateSheet({ open, onClose, onSend, name }: { open: boolean; onClose: () => void; onSend: (b: Record<string, unknown>) => void; name?: string | null }) {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['wa-templates'], queryFn: () => api<any[]>('/whatsapp/templates'), enabled: open });
  const [sel, setSel] = useState<any>(null);
  const [params, setParams] = useState<string[]>([]);
  const approved = (q.data ?? []).filter((t) => !t.status || t.status === 'APPROVED');
  const pick = (t: any) => {
    setSel(t);
    const n = new Set(String(t.body ?? '').match(/\{\{\d+\}\}/g) ?? []).size;
    setParams(Array.from({ length: n }, (_, i) => (i === 0 && name ? name : '')));
  };
  return (
    <Sheet open={open} onClose={onClose} title="WhatsApp template">
      {!approved.length && <Txt v="small" color="muted">कोई approved template नहीं। Meta WhatsApp Manager में template बनाकर approve करवाएँ, फिर web CRM → Inbox → “Meta से sync” करें।</Txt>}
      {approved.map((t) => (
        <Card key={t.id} onPress={() => pick(t)} style={{ padding: 12, borderColor: sel?.id === t.id ? c.brand : c.line }}>
          <Txt v="bodyStrong">{t.name}</Txt>
          <Txt v="caption" color="muted" numberOfLines={2}>{t.body}</Txt>
        </Card>
      ))}
      {sel && (
        <>
          <Card style={{ padding: 12, backgroundColor: `${c.success}14` }}>
            <Txt v="small">{renderTemplate(sel.body ?? '', Object.fromEntries(params.map((p, i) => [String(i + 1), p || `{{${i + 1}}}`])))}</Txt>
          </Card>
          {params.map((p, i) => <Input key={i} value={p} onChangeText={(v) => setParams((ps) => ps.map((x, j) => (j === i ? v : x)))} placeholder={`Variable {{${i + 1}}}`} />)}
          <Button title="Send template" variant="whatsapp" disabled={params.some((p) => !p.trim())} onPress={() => onSend({ templateName: sel.name, templateLanguage: sel.language, templateParams: params })} />
        </>
      )}
    </Sheet>
  );
}
