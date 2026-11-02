import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState, useMemo } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Check, CheckCheck, Clock, FileText, Send, UserRound } from 'lucide-react-native';
import { renderTemplate, type WaTemplate } from '@brokeriq/shared';
import { readInboxDraft, saveInboxDraft, hasLegacyInboxDraft } from '@/lib/inbox-drafts';
import { useAuth } from '@/lib/auth';
import { authStore, api, post, captureAccountContext, assertAccountContext } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { useRealtime } from '@/lib/realtime';
import { toast } from '@/lib/toast';
import { fonts, useTheme } from '@/lib/theme';
import { tr } from '@/lib/i18n';
import { Button, Card, ErrorView, Header, IconBtn, Input, Loader, PressableScale, Row, Sheet, Txt } from '@/ui';

export default function WaThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { user } = useAuth();
  const owner = useRef(captureAccountContext()).current;
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ['wa-thread', id, user?.id],
    initialPageParam: '',
    queryFn: ({ pageParam }) => api<any>(`/whatsapp/conversations/${id}/messages${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (page) => page.nextCursor || undefined,
    refetchInterval: 10_000,
  });
  const thread = useMemo(() => (q.data ? { ...q.data.pages[0], items: [...q.data.pages].reverse().flatMap((page) => page.items) } : undefined), [q.data]);
  const [replyToId, setReplyToId] = useState<string | undefined>();
  const [subject, setSubject] = useState('Property enquiry');
  const [syncing, setSyncing] = useState(false);
  const [syncCursor, setSyncCursor] = useState<string | null>(null);
  const [text, setText] = useState('');
  const legacy = useQuery({ queryKey: ['legacy-inbox-draft', owner.scope, id], queryFn: () => hasLegacyInboxDraft(id, owner) });
  const edited = useRef(false);
  useEffect(() => {
    let cancelled = false;
    edited.current = false;
    setText('');
    readInboxDraft(id, owner)
      .then((draft) => {
        if (!cancelled && !edited.current) {
          assertAccountContext(owner);
          setText(draft);
        }
      })
      .catch(showError);
    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);
  const attempt = useRef<{ text: string; requestId: string; subject?: string; replyToId?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [tpl, setTpl] = useState(false);
  const list = useRef<FlatList>(null);
  useRealtime<any>('wa:message', (d) => d.conversationId === id && qc.invalidateQueries({ queryKey: ['wa-thread', id] }));
  useRealtime<any>('wa:status', (d) => d.conversationId === id && qc.invalidateQueries({ queryKey: ['wa-thread', id] }));
  useEffect(() => {
    if (thread?.conversation?.unreadCount)
      post(`/whatsapp/conversations/${id}/read`)
        .then(() => qc.invalidateQueries({ queryKey: ['conversations'] }))
        .catch(() => undefined);
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 120);
  }, [thread, id, qc]);
  const send = async (body: Record<string, unknown>) => {
    if (sending) return false;
    setSending(true);
    try {
      if (['SMS', 'EMAIL'].includes(thread?.conversation?.channel)) {
        const content = String(body.text || '').trim();
        if (!attempt.current) {
          try {
            const stored = JSON.parse(await readInboxDraft(`sms-attempt:${id}`, owner));
            if (
              stored?.text === content &&
              (thread?.conversation?.channel !== 'EMAIL' || (stored?.subject === subject && stored?.replyToId === replyToId)) &&
              typeof stored?.requestId === 'string'
            )
              attempt.current = stored;
          } catch {
            /* Ignore corrupt local drafts. */
          }
        }
        if (
          attempt.current?.text !== content ||
          (thread?.conversation?.channel === 'EMAIL' && (attempt.current?.subject !== subject || attempt.current?.replyToId !== replyToId))
        )
          attempt.current = {
            text: content,
            requestId: Crypto.randomUUID(),
            ...(thread?.conversation?.channel === 'EMAIL' ? { subject, ...(replyToId ? { replyToId } : {}) } : {}),
          };
        await saveInboxDraft(`sms-attempt:${id}`, JSON.stringify(attempt.current), owner);
        await api(thread?.conversation?.channel === 'EMAIL' ? '/messaging/email/send' : '/messaging/sms/send', {
          body: { conversationId: id, ...attempt.current },
          ownerContext: owner,
        });
        attempt.current = null;
        setReplyToId(undefined);
        await saveInboxDraft(`sms-attempt:${id}`, '', owner);
      } else await api('/whatsapp/send', { body: { conversationId: id, ...body }, ownerContext: owner });
      await saveInboxDraft(id, '', owner);
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
  if (q.isError)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      </SafeAreaView>
    );
  const conv = thread!.conversation;
  const email = conv.channel === 'EMAIL';
  const sms = conv.channel === 'SMS';
  const windowOpen = sms || email || thread!.windowOpen;
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
      <Header
        title={conv.contactName || conv.contactPhone}
        subtitle={conv.contactPhone}
        right={
          conv.leadId ? (
            <IconBtn onPress={() => router.push(`/lead/${conv.leadId}`)}>
              <UserRound size={20} color={c.brand} />
            </IconBtn>
          ) : undefined
        }
      />
      {email && (
        <View style={{ padding: 12, gap: 8 }}>
          <Input label="Email subject" value={subject} onChangeText={setSubject} maxLength={200} />
          <Button
            title={syncCursor ? 'अगली emails sync करें' : 'Client emails sync करें'}
            variant="secondary"
            loading={syncing}
            onPress={async () => {
              setSyncing(true);
              try {
                const result = await post<any>(`/messaging/email/${id}/sync`, { ...(syncCursor ? { cursor: syncCursor } : {}) });
                setSyncCursor(result.nextCursor);
                await q.refetch();
              } catch (error) {
                showError(error);
              } finally {
                setSyncing(false);
              }
            }}
          />
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {q.hasNextPage && <Button title="पुराने संदेश लोड करें" variant="secondary" loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} />}
        <FlatList
          ref={list}
          data={thread!.items}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 14, gap: 6 }}
          renderItem={({ item: m }) => {
            const out = m.direction === 'OUTBOUND';
            const Tick =
              m.status === 'READ'
                ? CheckCheck
                : m.status === 'DELIVERED'
                  ? CheckCheck
                  : m.status === 'SENT'
                    ? Check
                    : m.status === 'FAILED'
                      ? AlertTriangle
                      : Clock;
            return (
              <Animated.View entering={FadeInUp.duration(220)} style={{ alignItems: out ? 'flex-end' : 'flex-start' }}>
                <View
                  style={{
                    maxWidth: '82%',
                    padding: 10,
                    paddingHorizontal: 13,
                    borderRadius: 18,
                    borderBottomRightRadius: out ? 5 : 18,
                    borderBottomLeftRadius: out ? 18 : 5,
                    backgroundColor: out ? '#059669' : c.surface,
                    borderWidth: out ? 0 : 1,
                    borderColor: c.line,
                  }}
                >
                  {!!m.templateName && (
                    <Txt v="caption" color={out ? 'rgba(255,255,255,0.7)' : 'subtle'}>
                      📄 {m.templateName}
                    </Txt>
                  )}
                  <Txt color={out ? 'white' : 'fg'}>{m.body ?? `[${m.type.toLowerCase()}]`}</Txt>
                  <Row gap={4} style={{ alignSelf: 'flex-end', marginTop: 2 }}>
                    <Txt v="caption" color={out ? 'rgba(255,255,255,0.7)' : 'subtle'}>
                      {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                    </Txt>
                    {out && <Tick size={13} color={m.status === 'READ' ? '#7DD3FC' : m.status === 'FAILED' ? '#FECACA' : 'rgba(255,255,255,0.8)'} />}
                  </Row>
                  {email && (
                    <Button
                      title="Reply"
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        setReplyToId(m.id);
                        setSubject(/^Re:/i.test(m.meta?.subject || '') ? m.meta.subject : `Re: ${m.meta?.subject || 'Property enquiry'}`);
                      }}
                    />
                  )}
                  {!!m.error && (
                    <Txt v="caption" color="#FECACA">
                      {m.error}
                    </Txt>
                  )}
                </View>
              </Animated.View>
            );
          }}
        />
        {sms && (
          <Txt v="caption" color="muted" style={{ paddingHorizontal: 14 }}>
            SMS business SIM से जाएगा। Queue में पहुँचना delivery नहीं है; अनिश्चित स्थिति में फिर न भेजें।
          </Txt>
        )}
        {!windowOpen && (
          <PressableScale
            onPress={() => setTpl(true)}
            style={{
              marginHorizontal: 12,
              marginBottom: 8,
              padding: 10,
              borderRadius: 14,
              backgroundColor: `${c.warning}1f`,
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <Clock size={16} color={c.warning} />
            <Txt v="caption" style={{ flex: 1 }}>
              24-घंटे की window बंद है — सिर्फ़ approved template भेज सकते हैं। Tap करें।
            </Txt>
          </PressableScale>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
          {!sms && !email && (
            <IconBtn onPress={() => setTpl(true)}>
              <FileText size={21} color={c.muted} />
            </IconBtn>
          )}
          {legacy.data && (
            <Txt v="caption" color="muted">
              An older message draft is preserved. Its firm and role need review before it can be restored; this composer creates a separate draft.
            </Txt>
          )}
          <TextInput
            value={text}
            onChangeText={(value) => {
              edited.current = true;
              setText(value);
              saveInboxDraft(id, value, owner).catch(showError);
            }}
            editable={windowOpen && !sending}
            placeholder={tr(windowOpen ? 'Message…' : 'Template भेजें')}
            placeholderTextColor={c.subtle}
            maxLength={sms ? 1600 : email ? 20_000 : undefined}
            multiline
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: 44,
              borderRadius: 22,
              backgroundColor: c.surface2,
              paddingHorizontal: 16,
              paddingVertical: 11,
              color: c.fg,
              fontFamily: fonts.body,
              fontSize: 15,
            }}
          />
          <IconBtn
            onPress={() => text.trim() && send({ text })}
            style={{ backgroundColor: '#25D366', width: 46, height: 46, borderRadius: 23, opacity: !windowOpen || sending || !text.trim() ? 0.5 : 1 }}
          >
            <Send size={19} color="#fff" />
          </IconBtn>
        </View>
      </KeyboardAvoidingView>
      <TemplateSheet
        open={tpl}
        onClose={() => setTpl(false)}
        name={conv.contactName}
        onSend={async (b) => (await send(b)) && (setTpl(false), toast.success('Template भेजा गया'))}
      />
    </SafeAreaView>
  );
}

function TemplateSheet({
  open,
  onClose,
  onSend,
  name,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (b: Record<string, unknown>) => void;
  name?: string | null;
}) {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['wa-templates'], queryFn: () => api<WaTemplate[]>('/whatsapp/templates'), enabled: open });
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
      {!approved.length && (
        <Txt v="small" color="muted">
          कोई approved template नहीं। Meta WhatsApp Manager में template बनाकर approve करवाएँ, फिर web CRM → Inbox → “Meta से sync” करें।
        </Txt>
      )}
      {approved.map((t) => (
        <Card key={t.id} onPress={() => pick(t)} style={{ padding: 12, borderColor: sel?.id === t.id ? c.brand : c.line }}>
          <Txt v="bodyStrong">{t.name}</Txt>
          <Txt v="caption" color="muted" numberOfLines={2}>
            {t.body}
          </Txt>
        </Card>
      ))}
      {sel && (
        <>
          <Card style={{ padding: 12, backgroundColor: `${c.success}14` }}>
            <Txt v="small">{renderTemplate(sel.body ?? '', Object.fromEntries(params.map((p, i) => [String(i + 1), p || `{{${i + 1}}}`])))}</Txt>
          </Card>
          {params.map((p, i) => (
            <Input key={i} value={p} onChangeText={(v) => setParams((ps) => ps.map((x, j) => (j === i ? v : x)))} placeholder={`Variable {{${i + 1}}}`} />
          ))}
          <Button
            title="Send template"
            variant="whatsapp"
            disabled={params.some((p) => !p.trim())}
            onPress={() => onSend({ templateName: sel.name, templateLanguage: sel.language, templateParams: params })}
          />
        </>
      )}
    </Sheet>
  );
}
