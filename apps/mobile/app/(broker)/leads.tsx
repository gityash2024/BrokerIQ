import { useRef, useState } from 'react';
import { FlatList, Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AlarmClock, Inbox, MessageCircle, Phone, Plus, Search } from 'lucide-react-native';
import { LEAD_STAGES, LEAD_STAGE_LABELS, formatPriceShort, timeAgo, whatsappLink } from '@brokeriq/shared';
import { BrokerScreen } from '@/launch/screen';
import { ChoiceField } from '@/launch/form';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import { useRealtime } from '@/lib/realtime';
import { useTheme } from '@/lib/theme';
import { SourceBadge, StageBadge, TempBadge } from '@/components/crm';
import { Avatar, Chip, Empty, ErrorView, IconBtn, Input, PressableScale, Row, Skeleton, Txt, Button, Sheet } from '@/ui';

function Action({ color, icon, label, align }: { color: string; icon: React.ReactNode; label: string; align: 'left' | 'right' }) {
  return (
    <View
      style={{
        width: 96,
        backgroundColor: color,
        justifyContent: 'center',
        alignItems: align === 'left' ? 'flex-start' : 'flex-end',
        paddingHorizontal: 22,
        borderRadius: 18,
        marginVertical: 0,
      }}
    >
      {icon}
      <Txt v="caption" color="white" style={{ marginTop: 4 }}>
        {label}
      </Txt>
    </View>
  );
}

function LeadItem({ l }: { l: any }) {
  const { c } = useTheme();
  const ref = useRef<SwipeableMethods>(null);
  const r = l.requirement;
  const summary = [r?.bedrooms?.length ? `${r.bedrooms.join('/')} BHK` : null, r?.maxBudget ? `≤ ${formatPriceShort(r.maxBudget)}` : null, l.listing?.title]
    .filter(Boolean)
    .join(' · ');
  return (
    <ReanimatedSwipeable
      friction={2}
      leftThreshold={70}
      rightThreshold={70}
      renderLeftActions={() => <Action color="#4F46E5" icon={<Phone size={22} color="#fff" />} label="Call" align="left" />}
      renderRightActions={() => <Action color="#16A34A" icon={<MessageCircle size={22} color="#fff" />} label="WhatsApp" align="right" />}
      ref={ref}
      onSwipeableOpen={(dir) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        // "left" = left-side actions revealed (swiped right) → Call
        if (String(dir) === 'left') Linking.openURL(`tel:${l.phone}`);
        else Linking.openURL(whatsappLink(l.phone, `Hi ${l.name ?? ''}`));
        ref.current?.close();
      }}
    >
      <PressableScale
        onPress={() => router.push(`/lead/${l.id}`)}
        style={{ padding: 14, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, gap: 6 }}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={8} style={{ flex: 1 }}>
            <Avatar name={l.name} size={36} />
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong" numberOfLines={1}>
                {l.name || l.phone}
              </Txt>
              <Txt v="caption" color="muted">
                {l.phone}
              </Txt>
            </View>
          </Row>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Txt v="caption" color="subtle">
              {timeAgo(l.lastActivityAt ?? l.createdAt)}
            </Txt>
            <Row gap={4}>
              <TempBadge t={l.temperature} />
              {!!l.scoredAt && (
                <Txt v="caption" color="muted">
                  {l.score}
                </Txt>
              )}
            </Row>
          </View>
        </Row>
        {!!summary && (
          <Txt v="small" color="muted" numberOfLines={1}>
            {summary}
          </Txt>
        )}
        <Row wrap gap={6}>
          <SourceBadge source={l.source} />
          <StageBadge stage={l.stage} />
          {l.repeatCount > 0 && (
            <Txt v="caption" color="warning">
              ↻ {l.repeatCount + 1}x enquiry
            </Txt>
          )}
          {l.nextFollowUpAt && (
            <Row gap={3}>
              <AlarmClock size={11} color={new Date(l.nextFollowUpAt) < new Date() ? c.danger : c.muted} />
              <Txt v="caption" color={new Date(l.nextFollowUpAt) < new Date() ? 'danger' : 'muted'}>
                {new Date(l.nextFollowUpAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Txt>
            </Row>
          )}
          {!l.assignedTo && (
            <Txt v="caption" color="warning">
              Unassigned
            </Txt>
          )}
        </Row>
      </PressableScale>
    </ReanimatedSwipeable>
  );
}

export default function Leads() {
  const { c } = useTheme();
  const [text, setText] = useState('');
  const q = useDebounced(text);
  const [view, setView] = useState('');
  const [stage, setStage] = useState('');
  const [filters, setFilters] = useState(false);
  const list = useInfiniteQuery({
    queryKey: ['leads', q, view, stage],
    queryFn: ({ pageParam }) => api<any>(`/leads${qs({ q, view, stage, page: pageParam, pageSize: 25 })}`),
    initialPageParam: 1,
    getNextPageParam: (p) => (p.page < p.totalPages ? p.page + 1 : undefined),
  });
  useRealtime('notification', () => list.refetch());
  return (
    <BrokerScreen title="Leads & Requirements" subtitle={list.data ? `${list.data.pages[0].total} contacts` : 'Contacts, follow-ups and visits.'}>
      <View style={{ paddingHorizontal: 20, gap: 10, paddingBottom: 12 }}>
        <Input value={text} onChangeText={setText} placeholder="Name / phone" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Add lead" size="sm" onPress={() => router.push('/add-lead')} />
          <Button title="Requirements" size="sm" variant="secondary" onPress={() => router.push('/requirements')} />
          <Button title="Filters" size="sm" variant="ghost" onPress={() => setFilters(true)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Pipeline" size="sm" variant="ghost" onPress={() => router.push('/pipeline')} />
          <Button title="Follow-ups" size="sm" variant="ghost" onPress={() => router.push('/follow-ups')} />
          <Button title="Visits" size="sm" variant="ghost" onPress={() => router.push('/visits')} />
        </View>
      </View>
      <FlatList
        data={list.data?.pages.flatMap((p) => p.items) ?? []}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 12, paddingBottom: 30 }}
        refreshing={list.isRefetching}
        onRefresh={() => list.refetch()}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
        renderItem={({ item }) => <LeadItem l={item} />}
        ListEmptyComponent={
          list.error ? <ErrorView error={list.error} /> : <Empty title="No leads yet" text="Add a contact or capture a requirement from Inbox." />
        }
      />
      <Sheet open={filters} onClose={() => setFilters(false)} title="Lead filters">
        <ChoiceField label="View" value={view} choices={['new', 'due', 'mine', 'stale']} onChange={(v) => setView(v ?? '')} />
        <ChoiceField label="Stage" value={stage} choices={LEAD_STAGES} onChange={(v) => setStage(v ?? '')} />
        <Button title="Apply filters" onPress={() => setFilters(false)} />
      </Sheet>
    </BrokerScreen>
  );
}
