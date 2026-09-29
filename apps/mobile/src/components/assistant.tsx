import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, KeyboardAvoidingView, Modal, Platform, TextInput, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { Check, Mic, Send, Sparkles, Square, Volume2, VolumeX, X } from 'lucide-react-native';
import { languageOf } from '@brokeriq/shared';
import { ApiError, errorMessage, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/lang';
import { fonts, useTheme } from '@/lib/theme';
import { tr } from '@/lib/i18n';
import { Button, Card, PressableScale, Row, Txt } from '@/ui';

/**
 * Floating AI assistant (bottom-right). Voice or text; acts only inside the signed-in account
 * and asks before changing anything.
 */
type Msg = { role: 'user' | 'assistant'; content: string; cards?: { type: 'listings' | 'leads'; items: any[] }; pending?: { token: string; summary: string }; resolved?: 'done' | 'cancelled' };
const HIDDEN = ['/login', '/onboarding', '/data-consent', '/scanner', '/post-property'];

export function AssistantButton() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  if (!user || HIDDEN.some((p) => pathname.startsWith(p)) || pathname.startsWith('/chat/') || pathname.startsWith('/wa/')) return null;
  return (
    <>
      <PressableScale
        onPress={() => setOpen(true)}
        style={{ position: 'absolute', right: 16, bottom: insets.bottom + 96, width: 56, height: 56, borderRadius: 28, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center', shadowColor: c.brand, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}
      >
        <Sparkles size={26} color="#fff" />
      </PressableScale>
      {open && <AssistantSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function AssistantSheet({ onClose }: { onClose: () => void }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const lang = useLang((s) => s.lang) ?? 'hi';
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const list = useRef<FlatList<Msg>>(null);
  useEffect(() => () => void Speech.stop(), []);

  const say = (t: string) => speak && Speech.speak(t.replace(/[*_#`]/g, ''), { language: languageOf(lang).speech });
  const append = (m: Msg) => setMsgs((x) => [...x, m]);

  const send = async (content: string) => {
    const q = content.trim();
    if (!q || busy) return;
    const history = [...msgs, { role: 'user' as const, content: q }];
    setMsgs(history);
    setText('');
    setBusy(true);
    try {
      const r = await post<any>('/assistant/chat', { messages: history.map(({ role, content }) => ({ role, content })), lang, context: { path: '/app' } });
      append({ role: 'assistant', content: r.reply, cards: r.cards, pending: r.pending });
      say(r.reply);
    } catch (e) {
      append({ role: 'assistant', content: e instanceof ApiError && e.body?.code === 'INTEGRATION_NOT_CONFIGURED' ? 'AI assistant अभी setup नहीं है — admin को Groq/Gemini key जोड़नी होगी।' : `⚠️ ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (i: number, ok: boolean) => {
    const p = msgs[i].pending!;
    setMsgs((m) => m.map((x, k) => (k === i ? { ...x, resolved: ok ? 'done' : 'cancelled' } : x)));
    if (!ok) return void post('/assistant/cancel', { token: p.token }).catch(() => undefined);
    setBusy(true);
    try {
      const r = await post<any>('/assistant/confirm', { token: p.token, lang });
      append({ role: 'assistant', content: r.reply, cards: r.cards });
      say(r.reply);
    } catch (e) {
      append({ role: 'assistant', content: `⚠️ ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = async () => {
    if (recording) {
      await recorder.stop();
      setRecording(false);
      if (!recorder.uri) return;
      setBusy(true);
      try {
        const b64 = await FileSystem.readAsStringAsync(recorder.uri, { encoding: FileSystem.EncodingType.Base64 });
        const r = await post<{ text: string }>('/assistant/transcribe', { audio: b64, mime: 'audio/m4a', lang });
        setBusy(false);
        if (r.text) await send(r.text);
      } catch (e) {
        setBusy(false);
        append({ role: 'assistant', content: `⚠️ ${errorMessage(e)}` });
      }
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return append({ role: 'assistant', content: 'Microphone की permission दें (phone settings)।' });
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  const open = (url: string) => {
    onClose();
    router.push(url.startsWith('/broker/leads/') ? `/lead/${url.split('/').pop()}` : (url as any));
  };

  const hints =
    user?.role === 'SUPER_ADMIN'
      ? ['Approval के लिए कितनी listings pending हैं?', 'आज का platform overview']
      : user?.role === 'USER'
        ? ['Sector 65 में 3 BHK furnished, 60k तक', '40k rent पर move-in cost कितना होगा?', 'मेरी enquiries दिखाओ']
        : ['आज का agenda बताओ', 'Hot leads दिखाओ', 'नई lead जोड़ो: Rahul 98xxxxxxxx'];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Dimensions.get('screen').height, backgroundColor: c.bg }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#3730A3' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={10} style={{ flex: 1 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="h3" color="white">BrokerIQ Assistant</Txt>
                <Txt v="caption" color="rgba(255,255,255,0.75)" numberOfLines={1}>बोलकर या लिखकर — आपके account में, आपकी अनुमति से</Txt>
              </View>
            </Row>
            <PressableScale onPress={() => (setSpeak(!speak), Speech.stop())} style={{ padding: 8 }}>{speak ? <Volume2 size={20} color="#fff" /> : <VolumeX size={20} color="#fff" />}</PressableScale>
            <PressableScale onPress={onClose} style={{ padding: 8 }}><X size={22} color="#fff" /></PressableScale>
          </Row>
        </View>
        <FlatList
          ref={list}
          data={msgs}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            !msgs.length ? (
              <View style={{ gap: 8 }}>
                <Txt color="muted">नमस्ते {user?.name.split(' ')[0]} 👋 मैं आपकी कैसे मदद करूँ?</Txt>
                {hints.map((h) => (
                  <Card key={h} onPress={() => send(h)} style={{ padding: 12 }}>
                    <Txt v="small">{h}</Txt>
                  </Card>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item: m, index: i }) => (
            <View style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}>
              <View style={{ maxWidth: '88%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: m.role === 'user' ? c.brand : c.surface2, borderBottomRightRadius: m.role === 'user' ? 6 : 18, borderBottomLeftRadius: m.role === 'user' ? 18 : 6 }}>
                <Txt color={m.role === 'user' ? 'white' : 'fg'} selectable>{m.content}</Txt>
              </View>
              {m.cards?.items.map((it) => (
                <Card key={it.id} onPress={() => it.url && open(it.url)} style={{ padding: 10, alignSelf: 'stretch' }}>
                  <Txt v="bodyStrong" numberOfLines={1}>{m.cards!.type === 'listings' ? it.title : it.name}</Txt>
                  <Txt v="caption" color="muted">{(m.cards!.type === 'listings' ? [it.rentText, it.locality, it.bedrooms ? `${it.bedrooms} BHK` : null] : [it.phone, it.stage, it.temperature]).filter(Boolean).join(' · ')}</Txt>
                </Card>
              ))}
              {m.pending && (
                <Card style={{ padding: 12, gap: 8, alignSelf: 'stretch', borderColor: c.warning, backgroundColor: `${c.warning}14` }}>
                  <Txt v="bodyStrong">{m.pending.summary}</Txt>
                  {m.resolved ? (
                    <Txt v="caption" color="muted">{m.resolved === 'done' ? '✅ Confirmed' : 'रद्द किया'}</Txt>
                  ) : (
                    <Row>
                      <Button title="हाँ, करें" size="sm" icon={<Check size={16} color="#fff" />} disabled={busy} onPress={() => resolve(i, true)} />
                      <Button title="रहने दें" size="sm" variant="secondary" disabled={busy} onPress={() => resolve(i, false)} />
                    </Row>
                  )}
                </Card>
              )}
            </View>
          )}
          ListFooterComponent={busy ? <Row gap={8}><ActivityIndicator color={c.brand} /><Txt v="small" color="muted">सोच रहा हूँ…</Txt></Row> : null}
        />
        <Row gap={8} style={{ padding: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
          <PressableScale onPress={toggleMic} disabled={busy && !recording} style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: recording ? c.danger : c.surface2 }}>
            {recording ? <Square size={18} color="#fff" /> : <Mic size={22} color={c.fg} />}
          </PressableScale>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={tr(recording ? 'सुन रहा हूँ… (■ दबाकर भेजें)' : 'लिखें या mic दबाकर बोलें…')}
            placeholderTextColor={c.subtle}
            onSubmitEditing={() => send(text)}
            returnKeyType="send"
            style={{ flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16, color: c.fg, fontFamily: fonts.body, fontSize: 15, backgroundColor: c.bg }}
          />
          <PressableScale onPress={() => send(text)} disabled={!text.trim() || busy} style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brand, opacity: !text.trim() || busy ? 0.4 : 1 }}>
            <Send size={18} color="#fff" />
          </PressableScale>
        </Row>
      </KeyboardAvoidingView>
    </Modal>
  );
}
