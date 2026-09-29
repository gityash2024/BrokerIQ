import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlarmClock, BarChart3, Bell, CalendarCheck, CircleDollarSign, Handshake, KanbanSquare, MessageSquareHeart, Plug, ScanLine, Settings, Users, UserRound, ShieldCheck, Languages, UserPlus } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Avatar, Card, PressableScale, Row, Txt } from '@/ui';
import { LanguageSwitch } from '@/components/language';

export default function More() {
  const { c } = useTheme();
  const { user, isBrokerAdmin, logout } = useAuth();
  const tiles = [
    { label: 'Follow-ups', icon: AlarmClock, to: '/follow-ups', tint: c.danger },
    { label: 'Site visits', icon: CalendarCheck, to: '/visits', tint: c.accent },
    { label: 'Pipeline', icon: KanbanSquare, to: '/pipeline', tint: c.brand },
    { label: 'Deals', icon: Handshake, to: '/deals', tint: c.success },
    { label: 'AI book scan', icon: ScanLine, to: '/scanner', tint: '#7C3AED' },
    { label: 'Analytics', icon: BarChart3, to: '/analytics', tint: c.info },
    { label: 'Team', icon: Users, to: '/team', tint: '#0D9488' },
    { label: 'Brokers को invite करें', icon: UserPlus, to: '/invite-brokers', tint: '#7C3AED' },
    ...(isBrokerAdmin ? [{ label: 'Lead connectors', icon: Plug, to: '/connectors', tint: '#E11D48' }] : []),
    { label: 'Notifications', icon: Bell, to: '/notifications', tint: c.brand },
    { label: 'Feedback', icon: MessageSquareHeart, to: '/feedback', tint: '#DB2777' },
    ...(isBrokerAdmin ? [{ label: 'Firm profile', icon: Settings, to: '/broker-onboarding', tint: c.muted }] : []),
    { label: 'Plan & billing', icon: CircleDollarSign, to: '/billing', tint: '#D97706' },
  ];
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <Animated.ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }}>
        <Card style={{ padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }} onPress={() => router.push('/edit-profile')}>
          <Avatar name={user?.name} uri={user?.avatarUrl} size={54} />
          <View style={{ flex: 1 }}>
            <Txt v="h3">{user?.name}</Txt>
            <Txt v="small" color="muted">{user?.organization?.name} · {isBrokerAdmin ? 'Admin' : 'Agent'}</Txt>
          </View>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          {tiles.map((t, i) => (
            <Animated.View key={t.label} entering={FadeInDown.delay(i * 30)} style={{ width: '31.5%' }}>
              <PressableScale onPress={() => router.push(t.to as any)} style={{ aspectRatio: 1, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${t.tint}1f`, alignItems: 'center', justifyContent: 'center' }}><t.icon size={22} color={t.tint} /></View>
                <Txt v="caption" style={{ textAlign: 'center' }}>{t.label}</Txt>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
        <Card style={{ marginTop: 16 }}>
          <PressableScale onPress={() => router.replace('/(user)/home')} style={{ padding: 16 }}>
            <Row><UserRound size={20} color={c.brand} /><Txt v="bodyStrong">Marketplace (buyer view) देखें</Txt></Row>
          </PressableScale>
          <PressableScale onPress={() => router.push('/privacy')} style={{ padding: 16, borderTopWidth: 1, borderColor: c.line }}>
            <Row><ShieldCheck size={20} color={c.brand} /><Txt v="bodyStrong">Privacy & data sharing</Txt></Row>
          </PressableScale>
          <LanguageSwitch
            render={(label, open) => (
              <PressableScale onPress={open} style={{ padding: 16, borderTopWidth: 1, borderColor: c.line }}>
                <Row><Languages size={20} color={c.brand} /><Txt v="bodyStrong" style={{ flex: 1 }}>भाषा / Language</Txt><Txt v="small" color="muted">{label}</Txt></Row>
              </PressableScale>
            )}
          />
          <PressableScale onPress={logout} style={{ padding: 16, borderTopWidth: 1, borderColor: c.line }}>
            <Txt v="bodyStrong" color="danger">Logout</Txt>
          </PressableScale>
        </Card>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
