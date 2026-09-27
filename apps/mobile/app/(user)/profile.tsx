import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Briefcase, Building2, Calculator, ChevronRight, HelpCircle, LogIn, LogOut, MessageSquareHeart, Moon, PlusCircle, Send, ShieldCheck, Sun, SunMoon, UserCog } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import { useTheme, useThemeMode } from '@/lib/theme';
import { Avatar, Badge, Card, PressableScale, Row, Txt } from '@/ui';

function Item({ icon, label, sub, onPress, tint, right }: { icon: React.ReactNode; label: string; sub?: string; onPress?: () => void; tint?: string; right?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${tint ?? c.brand}1c`, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Txt v="bodyStrong">{label}</Txt>
        {!!sub && <Txt v="caption" color="muted">{sub}</Txt>}
      </View>
      {right ?? <ChevronRight size={18} color={c.subtle} />}
    </PressableScale>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      {!!title && <Txt v="label" color="subtle" style={{ marginLeft: 6, marginBottom: 8 }}>{title}</Txt>}
      <Card style={{ paddingVertical: 4 }}>{children}</Card>
    </View>
  );
}

export default function Profile() {
  const { c } = useTheme();
  const { user, logout, isBroker } = useAuth();
  const { app } = useConfig();
  const mode = useThemeMode((s) => s.mode);
  const setMode = useThemeMode((s) => s.setMode);
  const nextMode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Animated.ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1E1B4B', '#4F46E5']} style={{ borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
          <SafeAreaView edges={['top']} style={{ padding: 20, paddingBottom: 30 }}>
            {user ? (
              <Row gap={14}>
                <Avatar name={user.name} uri={user.avatarUrl} size={64} />
                <View style={{ flex: 1 }}>
                  <Txt v="h2" color="white">{user.name}</Txt>
                  <Txt v="small" color="rgba(255,255,255,0.75)">{user.email}</Txt>
                  {user.emailVerified && <Badge label="Verified email" color="#6EE7B7" icon={<ShieldCheck size={11} color="#6EE7B7" />} />}
                </View>
              </Row>
            ) : (
              <View style={{ gap: 12 }}>
                <Txt v="h1" color="white">{app.siteName} में आपका स्वागत है</Txt>
                <Txt color="rgba(255,255,255,0.8)">Login करके properties save करें, brokers से chat करें और अपनी property free post करें।</Txt>
                <PressableScale onPress={() => router.push('/login')} style={{ alignSelf: 'flex-start', backgroundColor: '#F59E0B', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <LogIn size={18} color="#111" />
                  <Txt v="bodyStrong" color="#111">Login / Sign up</Txt>
                </PressableScale>
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>
        <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 16 }}>
          {isBroker && (
            <Card onPress={() => router.replace('/(broker)/dashboard')} style={{ marginTop: 18, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: c.brandSoft, borderColor: c.brand }}>
              <Briefcase size={24} color={c.brand} />
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong" color="brand">Broker mode पर जाएँ</Txt>
                <Txt v="caption" color="muted">Leads, WhatsApp inbox, follow-ups</Txt>
              </View>
              <ChevronRight size={18} color={c.brand} />
            </Card>
          )}
          <Group title="Property">
            <Item icon={<PlusCircle size={20} color={c.accent} />} tint={c.accent} label="Property post करें (FREE)" sub="Owners के लिए — सीधे buyers/tenants से leads" onPress={() => router.push(user ? '/post-property' : '/login')} />
            <Item icon={<Building2 size={20} color={c.brand} />} label="मेरी listings" onPress={() => router.push(user ? '/my-listings' : '/login')} />
            <Item icon={<Send size={20} color={c.info} />} tint={c.info} label="मेरी enquiries" onPress={() => router.push(user ? '/enquiries' : '/login')} />
            <Item icon={<Calculator size={20} color={c.success} />} tint={c.success} label="EMI, stamp duty & affordability" onPress={() => router.push('/tools')} />
          </Group>
          <Group title="Account">
            {user && <Item icon={<Bell size={20} color={c.brand} />} label="Notifications" onPress={() => router.push('/notifications')} />}
            {user && <Item icon={<UserCog size={20} color={c.brand} />} label="Profile, password & KYC" onPress={() => router.push('/edit-profile')} />}
            <Item
              icon={mode === 'dark' ? <Moon size={20} color={c.brand} /> : mode === 'light' ? <Sun size={20} color={c.brand} /> : <SunMoon size={20} color={c.brand} />}
              label="Theme"
              sub={mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light'}
              onPress={() => setMode(nextMode)}
            />
            {user && !isBroker && app.auth?.allowBrokerSignup !== false && <Item icon={<Briefcase size={20} color={c.accent} />} tint={c.accent} label="Broker हैं? Free CRM शुरू करें" sub="सारी portal leads एक app में" onPress={() => router.push('/broker-onboarding')} />}
          </Group>
          <Group title="Help">
            <Item icon={<MessageSquareHeart size={20} color="#E11D48" />} tint="#E11D48" label="Feedback & new features" sub="सुझाव दें, roadmap पर vote करें" onPress={() => router.push('/feedback')} />
            {!!(app.supportWhatsApp || app.supportPhone) && <Item icon={<HelpCircle size={20} color={c.info} />} tint={c.info} label="Support से बात करें" onPress={() => Linking.openURL(app.supportWhatsApp ? `https://wa.me/${app.supportWhatsApp.replace(/\D/g, '')}` : `tel:${app.supportPhone}`)} />}
            {user && <Item icon={<LogOut size={20} color={c.danger} />} tint={c.danger} label="Logout" onPress={logout} right={<View />} />}
          </Group>
          <Txt v="caption" color="subtle" style={{ textAlign: 'center', marginTop: 20 }}>{app.siteName} v{Constants.expoConfig?.version}</Txt>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}
