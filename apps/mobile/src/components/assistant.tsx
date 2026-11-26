import { AssistantActivity, AssistantText } from './assistant-presentation';
import { randomUUID } from 'expo-crypto';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Modal, TextInput, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { Check, Mic, Send, Sparkles, Square, Volume2, VolumeX, Trash2, X } from 'lucide-react-native';
import { assistantDestination, hasDelegatedAccess, languageOf, moduleAllowed, type AssistantPhase, type AssistantProgress } from '@brokeriq/shared';
import { useRealtime } from '@/lib/realtime';
import { api, ApiError, errorMessage, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { useLang } from '@/lib/lang';
import { fonts, useTheme } from '@/lib/theme';
import { tr } from '@/lib/i18n';
import { Button, Card, PressableScale, Row, Txt } from '@/ui';

/**
 * Floating AI assistant (bottom-right). Voice or text; acts only inside the signed-in account
 * and asks before changing anything.
 */
type Msg = {
  role: 'user' | 'assistant';
  content: string;
  cards?: { type: 'listings' | 'leads'; items: any[] };
  pending?: { token: string; summary: string };
  resolved?: 'done' | 'cancelled' | 'failed';
};
const HIDDEN = ['/login', '/onboarding', '/data-consent', '/scanner', '/post-property'];

export function AssistantButton() {
  const pathname = usePathname();
  const { user } = useAuth();
  const config = useConfig();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const role = user?.role === 'PROPERTY_OWNER' ? 'USER' : user?.role === 'SUB_BROKER_ADMIN' ? 'BROKER_ADMIN' : (user?.role ?? '');
  if (!config.loaded || !moduleAllowed(config.modules, 'assistant', role) || !hasDelegatedAccess(user, 'assistant', 'view')) return null;

  if (!user || HIDDEN.some((p) => pathname.startsWith(p)) || pathname.startsWith('/chat/') || pathname.startsWith('/wa/')) return null;
  return (
    <>
      <PressableScale
        accessibilityLabel="AI assistant"
        onPress={() => setOpen(true)}
        style={{
          position: 'absolute',
          right: 16,
          bottom: insets.bottom + 96,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.brand,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: c.brand,
          shadowOpacity: 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }}
      >
        <Sparkles size={26} color="#fff" />
      </PressableScale>
      {open && (
        <AssistantSheet
          key={JSON.stringify([user.id, user.organizationId, user.role, user.rolePermissions, user.agentChatEnabled])}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function AssistantSheet({ onClose }: { onClose: () => void }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const lang = useLang((s) => s.lang) ?? 'hi';
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [memoryReady, setMemoryReady] = useState(false);
  useEffect(() => {
    let active = true;
    void api<{ messages: Msg[] }>('/assistant/history')
      .then(({ messages }) => {
        if (active) {
          setMsgs((current) => (current.length ? current : messages));
          setMemoryReady(true);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [phases, setPhases] = useState<AssistantPhase[]>([]);
  const request = useRef<string | undefined>(undefined);
  const pathname = usePathname();
  useRealtime<AssistantProgress>('assistant.progress', ({ requestId, phase }) => {
    if (request.current === requestId) setPhases((previous) => (previous.at(-1) === phase ? previous : [...previous.slice(-3), phase]));
  });
  const start = (phase: AssistantPhase) => {
    const requestId = randomUUID();
    request.current = requestId;
    setPhases([phase]);
    setBusy(true);
    return requestId;
  };
  const finish = () => {
    request.current = undefined;
    setPhases([]);
    setBusy(false);
  };
  const [speak, setSpeak] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const list = useRef<FlatList<Msg>>(null);
  useEffect(
    () => () => {
      void Speech.stop();
      if (recorder.isRecording) void recorder.stop().catch(() => undefined);
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    },
    [recorder],
  );

  const say = (t: string) => speak && Speech.speak(t.replace(/[*_#`]/g, ''), { language: languageOf(lang).speech });
  const append = (m: Msg) => setMsgs((x) => [...x, m]);

  const send = async (content: string) => {
    const q = content.trim().slice(0, 4000);
    if (!q || busy) return;
    const history = [...msgs, { role: 'user' as const, content: q }];
    setMsgs(history);
    setText('');
    const requestId = start('understanding');
    try {
      const entityId = /^\/(?:lead|inventory|property)\/([^/]+)$/.exec(pathname)?.[1];
      const r = await post<any>('/assistant/chat', {
        requestId,
        rememberConversation: memoryReady,
        messages: (memoryReady ? history.slice(-1) : history.slice(-16)).map(({ role, content }) => ({ role, content: content.slice(0, 4000) })),
        lang,
        context: { path: pathname, entityId },
      });
      append({ role: 'assistant', content: r.reply, cards: r.cards, pending: r.pending });
      say(r.reply);
    } catch (e) {
      append({
        role: 'assistant',
        content:
          e instanceof ApiError && e.body?.code === 'INTEGRATION_NOT_CONFIGURED'
            ? 'AI assistant के लिए सक्षम free provider अभी configured नहीं है। Admin → Settings → Integrations में connection जाँचें।'
            : `⚠️ ${errorMessage(e)}`,
      });
    } finally {
      finish();
    }
  };

  const resolve = async (i: number, ok: boolean) => {
    const p = msgs[i].pending!;
    const resolveAs = (resolved: Msg['resolved']) => setMsgs((m) => m.map((x, k) => (k === i ? { ...x, resolved } : x)));
    if (busy) return;
    if (!ok) {
      resolveAs('cancelled');
      return void post('/assistant/cancel', { token: p.token }).catch(() => undefined);
    }
    const requestId = start('applying');
    try {
      const r = await post<any>('/assistant/confirm', { token: p.token, lang, requestId });
      resolveAs(r.actionSucceeded === false ? 'failed' : 'done');
      const receipt = r.receipt
        ? Object.entries(r.receipt)
            .map(([label, value]) => label + ' ' + value)
            .join(' · ')
        : '';
      append({ role: 'assistant', content: [r.reply, receipt].filter(Boolean).join('\n'), cards: r.cards });
      say(r.reply);
    } catch (e) {
      resolveAs('failed');
      append({ role: 'assistant', content: `⚠️ ${errorMessage(e)}` });
    } finally {
      finish();
    }
  };

  const toggleMic = async () => {
    if (recording) {
      await recorder.stop();
      setRecording(false);
      await setAudioModeAsync({ allowsRecording: false });
      if (!recorder.uri) return;
      start('transcribing');
      try {
        const b64 = await FileSystem.readAsStringAsync(recorder.uri, { encoding: FileSystem.EncodingType.Base64 });
        const r = await post<{ text: string }>('/assistant/transcribe', { audio: b64, mime: 'audio/m4a', lang });
        finish();
        if (r.text) setText(r.text); // The user reviews/edits the transcript before sending it.
      } catch (e) {
        finish();
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

  const open = (destination: string) => {
    if (destination.startsWith('https://')) {
      void Linking.openURL(destination)
        .then(onClose)
        .catch(() => append({ role: 'assistant', content: 'Could not open the BrokerIQ Web portal.' }));
      return;
    }
    onClose();
    router.push(destination as never);
  };

  const hints =
    user?.role === 'SUPER_ADMIN'
      ? ['Approval के लिए कितनी listings pending हैं?', 'आज का platform overview']
      : user?.role === 'PROPERTY_OWNER'
        ? ['मेरी properties दिखाओ', 'मेरी properties की availability बताओ']
        : user?.role === 'USER'
          ? ['Sector 65 में 3 BHK furnished, 60k तक', '40k rent पर move-in cost कितना होगा?', 'मेरी enquiries दिखाओ']
          : ['आज का agenda बताओ', 'Hot leads दिखाओ', 'नई lead जोड़ो: Rahul 98xxxxxxxx'];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={'padding'} style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#3730A3' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={10} style={{ flex: 1 }}>
              <View
                style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Sparkles size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="h3" color="white">
                  BrokerIQ Assistant
                </Txt>
                <Txt v="caption" color="rgba(255,255,255,0.75)" numberOfLines={1}>
                  बोलकर या लिखकर — आपके account में, आपकी अनुमति से
                </Txt>
              </View>
            </Row>
            {memoryReady && msgs.length > 0 && (
              <PressableScale
                accessibilityLabel="Clear assistant history"
                disabled={busy}
                style={{ padding: 8 }}
                onPress={() =>
                  Alert.alert('Clear assistant history?', 'Your saved BrokerIQ Assistant history will be removed.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: async () => {
                        setBusy(true);
                        try {
                          await api('/assistant/history', { method: 'DELETE' });
                          setMsgs([]);
                        } catch (error) {
                          append({ role: 'assistant', content: errorMessage(error) });
                        } finally {
                          setBusy(false);
                        }
                      },
                    },
                  ])
                }
              >
                <Trash2 size={18} color="#fff" />
              </PressableScale>
            )}
            <PressableScale onPress={() => (setSpeak(!speak), Speech.stop())} style={{ padding: 8 }}>
              {speak ? <Volume2 size={20} color="#fff" /> : <VolumeX size={20} color="#fff" />}
            </PressableScale>
            <PressableScale onPress={onClose} style={{ padding: 8 }}>
              <X size={22} color="#fff" />
            </PressableScale>
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
              <View
                style={{
                  maxWidth: '88%',
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  backgroundColor: m.role === 'user' ? c.brand : c.surface2,
                  borderBottomRightRadius: m.role === 'user' ? 6 : 18,
                  borderBottomLeftRadius: m.role === 'user' ? 18 : 6,
                }}
              >
                {m.role === 'assistant' ? (
                  <AssistantText
                    content={m.content}
                    cardUrls={m.cards?.items.map((item) => item.url) ?? []}
                    staff={user?.role === 'SUPER_ADMIN' || user?.role === 'MODERATOR'}
                    onNavigate={open}
                  />
                ) : (
                  <Txt color="white" selectable>
                    {m.content}
                  </Txt>
                )}
              </View>
              {m.cards?.items
                .filter((item) => assistantDestination(item.url, true))
                .map((it) => (
                  <Card key={it.id} onPress={() => open(assistantDestination(it.url, true)!)} style={{ padding: 10, alignSelf: 'stretch' }}>
                    <Txt v="bodyStrong" numberOfLines={1}>
                      {m.cards!.type === 'listings' ? it.title : it.name}
                    </Txt>
                    <Txt v="caption" color="muted">
                      {(m.cards!.type === 'listings'
                        ? [it.purpose, it.priceText ?? it.rentText, it.locality, it.bedrooms ? `${it.bedrooms} BHK` : null]
                        : [it.phone, it.stage, it.temperature]
                      )
                        .filter(Boolean)
                        .join(' · ')}
                    </Txt>
                  </Card>
                ))}
              {m.pending && (
                <Card style={{ padding: 12, gap: 8, alignSelf: 'stretch', borderColor: c.warning, backgroundColor: `${c.warning}14` }}>
                  <Txt v="bodyStrong">{m.pending.summary}</Txt>
                  {m.resolved ? (
                    <Txt v="caption" color="muted">
                      {m.resolved === 'done' ? '✅ Confirmed' : m.resolved === 'failed' ? 'Could not confirm' : 'रद्द किया'}
                    </Txt>
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
          ListFooterComponent={busy && phases.length > 0 ? <AssistantActivity phases={phases} lang={lang} /> : null}
        />
        <Row gap={8} style={{ padding: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
          <PressableScale
            onPress={toggleMic}
            disabled={busy && !recording}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: recording ? c.danger : c.surface2,
            }}
          >
            {recording ? <Square size={18} color="#fff" /> : <Mic size={22} color={c.fg} />}
          </PressableScale>
          <TextInput
            value={text}
            maxLength={4000}
            onChangeText={setText}
            placeholder={tr(recording ? 'सुन रहा हूँ… (■ दबाकर भेजें)' : 'लिखें या mic दबाकर बोलें…')}
            placeholderTextColor={c.subtle}
            onSubmitEditing={() => send(text)}
            returnKeyType="send"
            style={{
              flex: 1,
              height: 46,
              borderRadius: 23,
              borderWidth: 1,
              borderColor: c.line,
              paddingHorizontal: 16,
              color: c.fg,
              fontFamily: fonts.body,
              fontSize: 15,
              backgroundColor: c.bg,
            }}
          />
          <PressableScale
            onPress={() => send(text)}
            disabled={!text.trim() || busy}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.brand,
              opacity: !text.trim() || busy ? 0.4 : 1,
            }}
          >
            <Send size={18} color="#fff" />
          </PressableScale>
        </Row>
      </KeyboardAvoidingView>
    </Modal>
  );
}
