import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlarmClock,
  Bell,
  Building2,
  CalendarCheck,
  FileSpreadsheet,
  Handshake,
  IndianRupee,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  ScanLine,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react-native';
import {
  LEAD_SOURCE_COLORS,
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_COLORS,
  LEAD_STAGE_LABELS,
  formatINR,
  timeAgo,
  whatsappLink,
  type LeadSource,
  type LeadStage,
  type NotificationsResponse,
} from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLightStatusBar } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { SourceBadge, StageBadge } from '@/components/crm';
import { Card, ErrorView, IconBtn, PressableScale, Row, SectionTitle, Skeleton, Txt, useStatusScrim } from '@/ui';

export default function Dashboard() {
  useLightStatusBar();
  const scrim = useStatusScrim();
  const { c } = useTheme();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['broker-dashboard'], queryFn: () => api<any>('/broker/dashboard') });
  const notif = useQuery({ queryKey: ['notifications'], queryFn: () => api<NotificationsResponse>('/me/notifications') });
  const d = q.data;
  const k = d?.kpis;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const totalPipe = Math.max(1, ...(d?.pipeline ?? []).map((p: any) => p.count));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Animated.ScrollView
        onScroll={scrim.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#1E1B4B', '#3730A3', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          <SafeAreaView edges={['top']} style={{ padding: 20, paddingBottom: 26 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt v="caption" color="rgba(255,255,255,0.7)">
                  {greet} 👋
                </Txt>
                <Txt v="h2" color="white" numberOfLines={1}>
                  {user?.name?.split(' ')[0]} · {user?.organization?.name}
                </Txt>
              </View>
              <IconBtn onPress={() => router.push('/notifications')} badge={notif.data?.unreadCount} style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}>
                <Bell size={20} color="#fff" />
              </IconBtn>
            </Row>
            <Row style={{ marginTop: 22, gap: 8 }}>
              {[
                { label: 'Register Units', value: k?.totalInventory ?? 1698, icon: FileSpreadsheet, onPress: () => router.push('/(broker)/inventory') },
                { label: 'नई Leads', value: k?.newToday, icon: UserPlus, onPress: () => router.push('/(broker)/leads') },
                { label: 'Overdue', value: k?.overdue, icon: AlarmClock, onPress: () => router.push('/follow-ups'), warn: (k?.overdue ?? 0) > 0 },
                { label: 'Open', value: k?.open, icon: Users, onPress: () => router.push('/pipeline') },
              ].map((s, i) => (
                <Animated.View key={s.label} entering={FadeInDown.delay(i * 50)} style={{ flex: 1 }}>
                  <PressableScale
                    onPress={s.onPress}
                    style={{
                      padding: 10,
                      borderRadius: 16,
                      backgroundColor: s.warn ? 'rgba(244,63,94,0.25)' : 'rgba(255,255,255,0.12)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.18)',
                      gap: 4,
                      alignItems: 'center',
                    }}
                  >
                    <s.icon size={16} color="#fff" />
                    {k ? (
                      <Txt v="h2" color="white" style={{ fontSize: 18 }}>
                        {s.value ?? 0}
                      </Txt>
                    ) : (
                      <Skeleton h={22} w={32} />
                    )}
                    <Txt v="caption" color="rgba(255,255,255,0.75)" style={{ fontSize: 10, textAlign: 'center' }} numberOfLines={1}>
                      {s.label}
                    </Txt>
                  </PressableScale>
                </Animated.View>
              ))}
            </Row>
            <Row style={{ marginTop: 14, gap: 8 }}>
              {[
                { label: 'Ledger', icon: FileSpreadsheet, to: '/(broker)/inventory' },
                { label: 'AI Scan', icon: ScanLine, to: '/scanner' },
                { label: 'Add Lead', icon: Plus, to: '/add-lead' },
                { label: 'WhatsApp', icon: MessageCircle, to: '/(broker)/inbox' },
                { label: 'Co-Broker', icon: Handshake, to: '/network' },
              ].map((a) => (
                <PressableScale
                  key={a.label}
                  onPress={() => router.push(a.to as any)}
                  style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 14, backgroundColor: '#fff' }}
                >
                  <a.icon size={18} color="#4F46E5" />
                  <Txt v="caption" color="#1E1B4B" style={{ fontSize: 10, fontWeight: '700' }}>
                    {a.label}
                  </Txt>
                </PressableScale>
              ))}
            </Row>
          </SafeAreaView>
        </LinearGradient>

        {q.isError && <ErrorView error={q.error} onRetry={() => q.refetch()} />}
        <View style={{ paddingHorizontal: 16 }}>
          {k && (
            <Row style={{ marginTop: 16, gap: 10 }}>
              <Card style={{ flex: 1, padding: 14, gap: 4 }} onPress={() => router.push('/deals')}>
                <Trophy size={18} color={c.success} />
                <Txt v="h3">{k.wonThisMonth} won</Txt>
                <Txt v="caption" color="muted">
                  इस महीने
                </Txt>
              </Card>
              <Card style={{ flex: 1.4, padding: 14, gap: 4 }} onPress={() => router.push('/deals')}>
                <IndianRupee size={18} color={c.accent} />
                <Txt v="h3">{formatINR(k.commissionThisMonth)}</Txt>
                <Txt v="caption" color="muted">
                  Commission (month)
                </Txt>
              </Card>
            </Row>
          )}

          <SectionTitle
            title="आज का agenda"
            subtitle={d ? `${d.todayFollowUps.length} follow-ups · ${d.todayVisits.length} visits` : undefined}
            action={
              <Txt v="small" color="brand" onPress={() => router.push('/follow-ups')}>
                सब देखें
              </Txt>
            }
          />
          {!d ? (
            <Skeleton h={120} r={18} />
          ) : d.todayFollowUps.length + d.todayVisits.length === 0 ? (
            <Card style={{ padding: 18, alignItems: 'center' }}>
              <Txt color="muted">आज कोई pending task नहीं 🎉</Txt>
            </Card>
          ) : (
            <View style={{ gap: 8 }}>
              {d.todayVisits.map((v: any) => (
                <Card key={v.id} style={{ padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }} onPress={() => router.push(`/lead/${v.lead.id}`)}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${c.accent}22`, alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarCheck size={20} color={c.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong">Visit · {v.lead.name}</Txt>
                    <Txt v="caption" color="muted" numberOfLines={1}>
                      {new Date(v.scheduledAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · {v.listing?.title ?? v.address ?? ''}
                    </Txt>
                  </View>
                  <IconBtn onPress={() => Linking.openURL(`tel:${v.lead.phone}`)}>
                    <Phone size={18} color={c.brand} />
                  </IconBtn>
                </Card>
              ))}
              {d.todayFollowUps.map((f: any) => {
                const overdue = new Date(f.dueAt) < new Date();
                return (
                  <Card
                    key={f.id}
                    style={{ padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center', borderColor: overdue ? `${c.danger}66` : c.line }}
                    onPress={() => router.push(`/lead/${f.lead.id}`)}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: overdue ? `${c.danger}22` : c.brandSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AlarmClock size={20} color={overdue ? c.danger : c.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt v="bodyStrong">{f.lead.name}</Txt>
                      <Txt v="caption" color={overdue ? 'danger' : 'muted'} numberOfLines={1}>
                        {new Date(f.dueAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · {f.note ?? f.type}
                      </Txt>
                    </View>
                    <IconBtn onPress={() => Linking.openURL(`tel:${f.lead.phone}`)}>
                      <Phone size={18} color={c.brand} />
                    </IconBtn>
                    <IconBtn onPress={() => Linking.openURL(whatsappLink(f.lead.phone, `Hi ${f.lead.name}`))}>
                      <MessageCircle size={18} color="#16A34A" />
                    </IconBtn>
                  </Card>
                );
              })}
            </View>
          )}

          <SectionTitle
            title="Pipeline"
            action={
              <Txt v="small" color="brand" onPress={() => router.push('/pipeline')}>
                Kanban →
              </Txt>
            }
          />
          <Card style={{ padding: 14, gap: 10 }}>
            {(d?.pipeline ?? [])
              .filter((p: any) => p.stage !== 'LOST')
              .map((p: any, i: number) => (
                <View key={p.stage} style={{ gap: 4 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="small">{LEAD_STAGE_LABELS[p.stage as LeadStage]}</Txt>
                    <Txt v="small" color="muted">
                      {p.count}
                    </Txt>
                  </Row>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surface2 }}>
                    <Animated.View
                      entering={FadeInRight.delay(i * 60)}
                      style={{ height: 8, borderRadius: 4, width: `${(p.count / totalPipe) * 100}%`, backgroundColor: LEAD_STAGE_COLORS[p.stage as LeadStage] }}
                    />
                  </View>
                </View>
              ))}
            {!d?.pipeline?.length && (
              <Txt v="small" color="muted">
                अभी कोई lead नहीं
              </Txt>
            )}
          </Card>

          {!!d?.sources7d?.length && (
            <>
              <SectionTitle title="Lead sources (7 दिन)" />
              <Row wrap gap={8}>
                {d.sources7d.map((s: any) => (
                  <View
                    key={s.source}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 14,
                      backgroundColor: `${LEAD_SOURCE_COLORS[s.source as LeadSource] ?? '#64748B'}1c`,
                    }}
                  >
                    <Txt v="bodyStrong" color={LEAD_SOURCE_COLORS[s.source as LeadSource]}>
                      {s.count}
                    </Txt>
                    <Txt v="caption" color="muted">
                      {LEAD_SOURCE_LABELS[s.source as LeadSource] ?? s.source}
                    </Txt>
                  </View>
                ))}
              </Row>
            </>
          )}

          {/* Gurgaon Prime Sectors Ledger Distribution */}
          {d?.sectors?.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <SectionTitle
                title="Gurgaon Prime Sectors (Ledger)"
                subtitle={`${k?.totalInventory ?? 1698} verified register units`}
                action={
                  <Txt v="small" color="brand" onPress={() => router.push('/(broker)/inventory')}>
                    सब देखें
                  </Txt>
                }
              />
              <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                {d.sectors.map((s: any) => (
                  <PressableScale
                    key={s.sector}
                    onPress={() => router.push('/(broker)/inventory')}
                    style={{
                      width: '48.5%',
                      backgroundColor: c.surface,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: c.line,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Txt v="caption" style={{ fontWeight: '700' }} numberOfLines={1}>
                        {s.sector}
                      </Txt>
                      <Txt v="caption" color="muted">
                        Verified Units
                      </Txt>
                    </View>
                    <View style={{ backgroundColor: `${c.brand}18`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Txt v="caption" style={{ color: c.brand, fontWeight: '700' }}>
                        {s.count}
                      </Txt>
                    </View>
                  </PressableScale>
                ))}
              </Row>
            </View>
          )}

          <SectionTitle
            title="Recent leads"
            action={
              <Txt v="small" color="brand" onPress={() => router.push('/(broker)/leads')}>
                सब देखें
              </Txt>
            }
          />
          <View style={{ gap: 8 }}>
            {(d?.recentLeads ?? []).map((l: any) => (
              <Card key={l.id} style={{ padding: 12, gap: 6 }} onPress={() => router.push(`/lead/${l.id}`)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                    {l.name}
                  </Txt>
                  <Txt v="caption" color="subtle">
                    {timeAgo(l.createdAt)}
                  </Txt>
                </Row>
                <Row gap={6}>
                  <SourceBadge source={l.source} />
                  <StageBadge stage={l.stage} />
                  {!l.assignedTo && (
                    <Txt v="caption" color="warning">
                      Unassigned
                    </Txt>
                  )}
                </Row>
              </Card>
            ))}
          </View>
        </View>
      </Animated.ScrollView>
      {scrim.view}
    </View>
  );
}
