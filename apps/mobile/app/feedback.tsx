import { useState } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { ChevronUp, ImagePlus, MessageSquare, Send, Star, X } from 'lucide-react-native';
import { FEEDBACK_STATUS_COLORS, FEEDBACK_STATUS_LABELS, FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, timeAgo } from '@brokeriq/shared';
import { api, post, qs, uploadUri } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Chip, Empty, Header, Input, PressableScale, Row, Screen, Segmented, Sheet, Skeleton, Txt } from '@/ui';

function VoteButton({ item, onVoted }: { item: any; onVoted: () => void }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const vote = async () => {
    if (!user) return router.push('/login');
    s.value = withSequence(withSpring(1.2), withSpring(1));
    try {
      await post(`/feedback/${item.id}/vote`);
      onVoted();
    } catch (e) {
      showError(e);
    }
  };
  return (
    <PressableScale onPress={vote} style={{ width: 54, alignItems: 'center', paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, borderColor: item.voted ? c.brand : c.line, backgroundColor: item.voted ? c.brandSoft : c.surface }}>
      <Animated.View style={a}><ChevronUp size={20} color={item.voted ? c.brand : c.muted} /></Animated.View>
      <Txt v="bodyStrong" color={item.voted ? 'brand' : 'fg'}>{item.voteCount}</Txt>
    </PressableScale>
  );
}

export default function Feedback() {
  const { c } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'board' | 'new' | 'mine'>('board');
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const board = useQuery({ queryKey: ['feedback-board', sort, status], queryFn: () => api<any>(`/feedback/board${qs({ sort, status })}`) });
  const mine = useQuery({ queryKey: ['feedback-mine'], queryFn: () => api<any[]>('/feedback/mine'), enabled: !!user && tab === 'mine' });
  const refresh = () => qc.invalidateQueries({ queryKey: ['feedback-board'] });
  const list = tab === 'mine' ? mine.data ?? [] : board.data?.items ?? [];

  return (
    <Screen scroll={false} padded={false} edges={['top', 'bottom']}>
      <Header title="Feedback & roadmap" subtitle="आपके सुझाव से app बनता है 💜" />
      <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 10 }}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'board', label: 'Roadmap' }, { value: 'new', label: '+ नया सुझाव' }, { value: 'mine', label: 'मेरे' }]} />
        {tab === 'board' && (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['', 'PLANNED', 'IN_PROGRESS', 'DONE', 'UNDER_REVIEW']}
            keyExtractor={(x) => x || 'all'}
            contentContainerStyle={{ gap: 8 }}
            ListHeaderComponent={<Row gap={8} style={{ marginRight: 8 }}><Chip label="🔥 Top" active={sort === 'top'} onPress={() => setSort('top')} /><Chip label="🆕 New" active={sort === 'new'} onPress={() => setSort('new')} /></Row>}
            renderItem={({ item }) => <Chip label={item ? `${FEEDBACK_STATUS_LABELS[item]} ${board.data?.statusCounts?.[item] ?? ''}` : 'All'} active={status === item} color={item ? FEEDBACK_STATUS_COLORS[item] : undefined} onPress={() => setStatus(item)} />}
          />
        )}
      </View>
      {tab === 'new' ? (
        <NewFeedback onDone={() => (setTab(user ? 'mine' : 'board'), qc.invalidateQueries({ queryKey: ['feedback-mine'] }))} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(x) => x.id}
          refreshing={board.isRefetching}
          onRefresh={() => (tab === 'mine' ? mine.refetch() : board.refetch())}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={board.isLoading ? <Skeleton h={90} /> : <Empty title={tab === 'mine' ? 'अभी कोई feedback नहीं दिया' : 'अभी कुछ नहीं'} text="पहला सुझाव आप दीजिए!" action={<Button title="सुझाव दें" onPress={() => setTab('new')} />} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 35)}>
              <Card style={{ padding: 14, flexDirection: 'row', gap: 12 }} onPress={() => setOpen(item.id)}>
                <VoteButton item={item} onVoted={refresh} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Row wrap gap={6}>
                    <Badge label={FEEDBACK_STATUS_LABELS[item.status]} color={FEEDBACK_STATUS_COLORS[item.status]} />
                    <Badge label={FEEDBACK_TYPE_LABELS[item.type]} />
                  </Row>
                  <Txt v="bodyStrong">{item.title}</Txt>
                  <Txt v="small" color="muted" numberOfLines={2}>{item.description}</Txt>
                  <Row gap={10}>
                    <Txt v="caption" color="subtle">{timeAgo(item.createdAt)}</Txt>
                    <Row gap={3}><MessageSquare size={12} color={c.subtle} /><Txt v="caption" color="subtle">{item._count?.comments ?? 0}</Txt></Row>
                  </Row>
                </View>
              </Card>
            </Animated.View>
          )}
        />
      )}
      <FeedbackDetail id={open} onClose={() => setOpen(null)} onChange={refresh} />
    </Screen>
  );
}

function NewFeedback({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const [f, setF] = useState({ type: 'FEATURE', title: '', description: '', rating: 0, contactEmail: '' });
  const [shots, setShots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const addShot = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled) return;
    try {
      const small = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 1400 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      setShots((s) => [...s, '']);
      const { url } = await uploadUri(small.uri, 'cms');
      setShots((s) => [...s.filter(Boolean), url]);
    } catch (e) {
      setShots((s) => s.filter(Boolean));
      showError(e);
    }
  };
  const submit = async () => {
    setBusy(true);
    try {
      await post('/feedback', { ...f, rating: f.rating || null, contactEmail: user ? '' : f.contactEmail, screenshots: shots.filter(Boolean), platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID', appVersion: Constants.expoConfig?.version });
      toast.success('धन्यवाद! 🙏 आपका feedback team तक पहुँच गया');
      onDone();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Animated.ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Row wrap>{FEEDBACK_TYPES.map((t) => <Chip key={t} label={FEEDBACK_TYPE_LABELS[t]} active={f.type === t} onPress={() => setF({ ...f, type: t })} />)}</Row>
      <Input label="Title" value={f.title} onChangeText={(v) => setF({ ...f, title: v })} placeholder="जैसे: Map पर metro stations दिखें" />
      <Input label="Details" value={f.description} onChangeText={(v) => setF({ ...f, description: v })} multiline placeholder="क्या होना चाहिए, क्यों ज़रूरी है…" />
      <Txt v="label" color="subtle">App को rating दें</Txt>
      <Row>
        {[1, 2, 3, 4, 5].map((n) => (
          <PressableScale key={n} onPress={() => setF({ ...f, rating: n })}>
            <Star size={32} color="#F59E0B" fill={n <= f.rating ? '#F59E0B' : 'transparent'} />
          </PressableScale>
        ))}
      </Row>
      <Row wrap>
        {shots.map((s, i) => (
          <View key={i} style={{ width: 70, height: 70, borderRadius: 12, overflow: 'hidden', backgroundColor: c.surface2 }}>
            {!!s && <Image source={{ uri: s }} style={{ width: '100%', height: '100%' }} />}
            {!!s && (
              <PressableScale onPress={() => setShots(shots.filter((x) => x !== s))} style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: 2 }}>
                <X size={12} color="#fff" />
              </PressableScale>
            )}
          </View>
        ))}
        {shots.length < 5 && <Button title="Screenshot" size="sm" variant="secondary" icon={<ImagePlus size={16} color={c.fg} />} onPress={addShot} />}
      </Row>
      {!user && <Input label="Email (reply के लिए)" value={f.contactEmail} onChangeText={(v) => setF({ ...f, contactEmail: v })} keyboardType="email-address" autoCapitalize="none" />}
      <Button title="भेजें" size="lg" icon={<Send size={18} color="#fff" />} loading={busy} disabled={f.title.length < 4 || f.description.length < 10 || (!user && !f.contactEmail)} onPress={submit} />
    </Animated.ScrollView>
  );
}

function FeedbackDetail({ id, onClose, onChange }: { id: string | null; onClose: () => void; onChange: () => void }) {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['feedback', id], queryFn: () => api<any>(`/feedback/${id}`), enabled: !!id });
  const [text, setText] = useState('');
  const comment = async () => {
    if (!user) return router.push('/login');
    try {
      await post(`/feedback/${id}/comments`, { body: text });
      setText('');
      q.refetch();
      onChange();
    } catch (e) {
      showError(e);
    }
  };
  const d = q.data;
  return (
    <Sheet open={!!id} onClose={onClose} title={d?.title}>
      {!d ? <Skeleton h={120} /> : (
        <>
          <Row wrap gap={6}>
            <Badge label={FEEDBACK_STATUS_LABELS[d.status]} color={FEEDBACK_STATUS_COLORS[d.status]} />
            <Badge label={`${d.voteCount} votes`} />
          </Row>
          <Txt color="muted">{d.description}</Txt>
          {!!d.adminReply && (
            <Card style={{ padding: 12, gap: 4 }}>
              <Txt v="caption" color="brand">Team reply</Txt>
              <Txt v="small">{d.adminReply}</Txt>
            </Card>
          )}
          {(d.comments ?? []).map((cm: any) => (
            <View key={cm.id} style={{ gap: 2 }}>
              <Txt v="caption" color={cm.isAdmin ? 'brand' : 'muted'}>{cm.authorName} · {timeAgo(cm.createdAt)}</Txt>
              <Txt v="small">{cm.body}</Txt>
            </View>
          ))}
          <Row>
            <Input value={text} onChangeText={setText} placeholder="Comment लिखें…" containerStyle={{ flex: 1 }} />
            <Button icon={<Send size={18} color="#fff" />} disabled={!text.trim()} onPress={comment} style={{ width: 50, paddingHorizontal: 0 }} />
          </Row>
        </>
      )}
    </Sheet>
  );
}
