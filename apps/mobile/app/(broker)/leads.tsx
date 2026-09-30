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
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import { useRealtime } from '@/lib/realtime';
import { useTheme } from '@/lib/theme';
import { SourceBadge, StageBadge, TempBadge } from '@/components/crm';
import { Avatar, Chip, Empty, ErrorView, IconBtn, Input, PressableScale, Row, Skeleton, Txt } from '@/ui';

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
  const { isBrokerAdmin } = useAuth();
  const [text, setText] = useState('');
  const q = useDebounced(text);
  const [view, setView] = useState('');
  const [stage, setStage] = useState('');
  const list = useInfiniteQuery({
    queryKey: ['leads', q, view, stage],
    queryFn: ({ pageParam }) => api<any>(`/leads${qs({ q, view, stage, page: pageParam, pageSize: 25 })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  useRealtime('notification', (n: any) => n?.kind === 'NEW_LEAD' && list.refetch());
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const views = [
    ['', 'All'],
    ['new', 'New'],
    ['due', 'Due today'],
    ...(isBrokerAdmin ? [['unassigned', 'Unassigned']] : []),
    ['mine', 'Mine'],
    ['stale', 'No activity 3d+'],
  ];
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <Row style={{ paddingHorizontal: 16, paddingTop: 8, justifyContent: 'space-between' }}>
        <View>
          <Txt v="h1">Leads</Txt>
          <Txt v="caption" color="muted">
            {list.data ? `${list.data.pages[0].total} leads · swipe → call, ← WhatsApp` : ' '}
          </Txt>
        </View>
        <IconBtn onPress={() => router.push('/add-lead')} style={{ backgroundColor: c.brand }}>
          <Plus size={22} color="#fff" />
        </IconBtn>
      </Row>
      <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
        <Input value={text} onChangeText={setText} placeholder="नाम या phone…" icon={<Search size={18} color={c.subtle} />} />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={views}
          keyExtractor={(v) => v[0] || 'all'}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => <Chip label={item[1]} active={view === item[0]} onPress={() => setView(item[0])} />}
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['', ...LEAD_STAGES]}
          keyExtractor={(v) => v || 'any'}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <Chip
              label={item ? LEAD_STAGE_LABELS[item as keyof typeof LEAD_STAGE_LABELS] : 'All stages'}
              active={stage === item}
              onPress={() => setStage(item)}
            />
          )}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: 130 }}
        refreshing={list.isRefetching}
        onRefresh={() => list.refetch()}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
        onEndReachedThreshold={0.5}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay((index % 25) * 25)}>
            <LeadItem l={item} />
          </Animated.View>
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} h={110} r={18} />
              ))}
            </View>
          ) : list.isError ? (
            <ErrorView error={list.error} onRetry={() => list.refetch()} />
          ) : (
            <Empty
              icon={<Inbox size={28} color={c.brand} />}
              title="कोई lead नहीं"
              text="Portals connect करें (More → Lead connectors) या manually lead जोड़ें।"
            />
          )
        }
      />
    </SafeAreaView>
  );
}
