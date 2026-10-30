import { useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  ScrollView,
  Share,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Compass,
  Crown,
  Eye,
  Mail,
  MapPin,
  Navigation,
  Percent,
  Phone,
  Save,
  Send,
  Shield,
  ShieldCheck,
  Target,
  Trophy,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { timeAgo } from '@brokeriq/shared';
import { patch, post, del } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { useTeam } from '@/components/crm';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  ErrorView,
  Header,
  IconBtn,
  Input,
  Row,
  Screen,
  Sheet,
  Skeleton,
  Txt,
} from '@/ui';

export default function Team() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const { user, isBrokerAdmin } = useAuth();
  const q = useTeam();
  const inv = [['team']];

  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  // Invite form state
  const [f, setF] = useState({ name: '', email: '', role: 'BROKER_AGENT' });
  const invite = useApiMutation(() => post<{ link: string; emailed: boolean }>('/broker/team/invite', f), {
    invalidate: inv,
    success: (r) => (r.emailed ? 'Invite email भेजी गई' : 'Invite link बना — share करें'),
    onSuccess: (r) => {
      setInviteOpen(false);
      Share.share({ message: `${f.name}, हमारी BrokerIQ team join करें: ${r.link}` });
      setF({ name: '', email: '', role: 'BROKER_AGENT' });
    },
  });

  // Action mutations
  const updateMember = useApiMutation(({ id, ...b }: any) => patch(`/broker/team/${id}`, b), {
    invalidate: inv,
    success: 'सदस्य का विवरण अपडेट हो गया ✅',
    onSuccess: () => {
      setSelectedMember(null);
    },
  });

  const removeMember = useApiMutation((id: string) => del(`/broker/team/${id}`), {
    invalidate: inv,
    success: 'सदस्य को टीम से हटा दिया गया',
    onSuccess: () => {
      setSelectedMember(null);
    },
  });

  const members = [...(q.data?.members ?? [])].sort(
    (a, b) => (b.stats?.won30d ?? 0) - (a.stats?.won30d ?? 0),
  );

  return (
    <Screen scroll={false} padded={false} edges={['top', 'bottom']}>
      <Header
        title="Team & Agents"
        right={
          isBrokerAdmin ? (
            <IconBtn onPress={() => setInviteOpen(true)} style={{ backgroundColor: c.brand }}>
              <UserPlus size={20} color="#fff" />
            </IconBtn>
          ) : undefined
        }
      />

      {q.isError ? (
        <ErrorView error={q.error} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}
          ListEmptyComponent={q.isLoading ? <Skeleton h={100} /> : null}
          ListFooterComponent={
            (q.data?.invites ?? []).length ? (
              <View style={{ gap: 8, marginTop: 10 }}>
                <Txt v="label" color="subtle">
                  लंबित इनवाइट्स (Pending invites)
                </Txt>
                {(q.data?.invites ?? []).map((i) => (
                  <Card key={i.id} style={{ padding: 12 }}>
                    <Txt v="bodyStrong">{i.name}</Txt>
                    <Txt v="caption" color="muted">
                      {i.email} · {i.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'}
                    </Txt>
                  </Card>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item: m, index }) => {
            const memberAny = m as any;
            const loc = memberAny.lastLocation;
            const dealsTarget = memberAny.targets?.monthlyDeals || 5;
            const dealsWon = memberAny.fulfillment?.dealsWonMonth ?? m.stats?.won30d ?? 0;
            const dealsPct = memberAny.fulfillment?.dealsPercent ?? (dealsTarget > 0 ? Math.min(100, Math.round((dealsWon / dealsTarget) * 100)) : 0);

            return (
              <Animated.View entering={FadeInDown.delay(index * 40)}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setSelectedMember(m)}
                >
                  <Card
                    style={{
                      padding: 14,
                      gap: 10,
                      opacity: m.status === 'ACTIVE' ? 1 : 0.5,
                      borderLeftWidth: 3,
                      borderLeftColor: m.role === 'BROKER_ADMIN' ? c.brand : '#3B82F6',
                    }}
                  >
                    {/* Top Row: Avatar & Name & Role */}
                    <Row justify="space-between" align="center">
                      <Row gap={12} align="center">
                        <View>
                          <Avatar name={m.name} uri={m.avatarUrl} size={46} />
                          {index === 0 && members.length > 1 && (m.stats?.won30d ?? 0) > 0 && (
                            <View style={{ position: 'absolute', right: -4, top: -4 }}>
                              <Trophy size={16} color="#F59E0B" fill="#F59E0B" />
                            </View>
                          )}
                        </View>
                        <View style={{ gap: 2 }}>
                          <Row gap={6} align="center">
                            <Txt v="bodyStrong">{m.name}</Txt>
                            {m.id === user?.id && <Txt v="caption" color="muted">(आप)</Txt>}
                          </Row>
                          <Txt v="caption" color="muted">
                            {m.phone || m.email}
                          </Txt>
                        </View>
                      </Row>

                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        {m.role === 'BROKER_ADMIN' ? (
                          <Badge label="Admin" color={c.brand} icon={<Crown size={10} color={c.brand} />} />
                        ) : (
                          <Badge label="Agent" color="#3B82F6" />
                        )}
                        {m.status === 'SUSPENDED' && (
                          <Badge label="Suspended" color="#EF4444" />
                        )}
                      </View>
                    </Row>

                    {/* Middle Row: Live Location & Target Progress */}
                    <View
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        backgroundColor: isDark ? '#141829' : '#F8FAFC',
                        gap: 6,
                      }}
                    >
                      <Row justify="space-between" align="center">
                        {/* Live Location pill */}
                        {loc ? (
                          <Row gap={6} align="center">
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                            <Txt v="caption" style={{ fontWeight: '700', color: '#10B981' }}>
                              Live ({timeAgo(loc.capturedAt)})
                            </Txt>
                          </Row>
                        ) : (
                          <Row gap={6} align="center">
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.muted }} />
                            <Txt v="caption" color="muted">Offline</Txt>
                          </Row>
                        )}

                        {/* KYC status */}
                        <Txt
                          v="caption"
                          style={{
                            fontWeight: '700',
                            color: m.kycStatus === 'VERIFIED' ? '#10B981' : m.kycStatus === 'PENDING' ? '#F59E0B' : c.muted,
                          }}
                        >
                          KYC: {m.kycStatus || 'Not Submitted'}
                        </Txt>
                      </Row>

                      {/* Target Progress Bar */}
                      <View style={{ gap: 3, marginTop: 2 }}>
                        <Row justify="space-between">
                          <Txt v="caption" color="muted">मासिक डील्स लक्ष्य:</Txt>
                          <Txt v="caption" style={{ fontWeight: '800' }}>
                            {dealsWon} / {dealsTarget} won ({dealsPct}%)
                          </Txt>
                        </Row>
                        <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? '#232A42' : '#E2E8F0', overflow: 'hidden' }}>
                          <View
                            style={{
                              height: '100%',
                              width: `${dealsPct}%`,
                              backgroundColor: dealsPct >= 100 ? '#10B981' : dealsPct >= 50 ? '#F59E0B' : c.brand,
                              borderRadius: 3,
                            }}
                          />
                        </View>
                      </View>
                    </View>

                    {/* Bottom Row: Leads & Activity stats */}
                    <Row justify="space-between" align="center">
                      <Txt v="caption" color="muted">
                        {m.stats?.openLeads ?? 0} open · {m.stats?.won30d ?? 0} won · {m.stats?.activities30d ?? 0} activities
                      </Txt>
                      <Txt v="caption" color="brand" style={{ fontWeight: '800' }}>
                        विवरण देखें ➔
                      </Txt>
                    </Row>
                  </Card>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}

      {/* Member Detail & Edit Sheet */}
      <MemberDetailSheet
        member={selectedMember}
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        isBrokerAdmin={isBrokerAdmin}
        currentUserId={user?.id}
        onUpdate={(data) => updateMember.mutate({ id: selectedMember?.id, ...data })}
        onRemove={(id) => removeMember.mutate(id)}
      />

      {/* Invite Member Sheet */}
      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title="Team member invite करें">
        <Input label="नाम" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Input label="Email" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} keyboardType="email-address" autoCapitalize="none" />
        <Row>
          <Chip label="Agent" active={f.role === 'BROKER_AGENT'} onPress={() => setF({ ...f, role: 'BROKER_AGENT' })} />
          <Chip label="Admin" active={f.role === 'BROKER_ADMIN'} onPress={() => setF({ ...f, role: 'BROKER_ADMIN' })} />
        </Row>
        <Button
          title="Invite भेजें"
          icon={<Send size={17} color="#fff" />}
          loading={invite.isPending}
          disabled={!f.name || !f.email}
          onPress={() => invite.mutate(undefined)}
        />
      </Sheet>
    </Screen>
  );
}

function MemberDetailSheet({
  member,
  open,
  onClose,
  isBrokerAdmin,
  currentUserId,
  onUpdate,
  onRemove,
}: {
  member: any | null;
  open: boolean;
  onClose: () => void;
  isBrokerAdmin: boolean;
  currentUserId?: string;
  onUpdate: (data: any) => void;
  onRemove: (id: string) => void;
}) {
  const { c, isDark } = useTheme();
  const router = useRouter();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [deals, setDeals] = useState('5');
  const [leads, setLeads] = useState('30');
  const [revenue, setRevenue] = useState('500000');
  const [commission, setCommission] = useState('10');

  // Initialize values when member opened
  useState(() => {
    if (member) {
      setName(member.name || '');
      setPhone(member.phone || '');
      setDeals(String(member.targets?.monthlyDeals ?? 5));
      setLeads(String(member.targets?.monthlyLeads ?? 30));
      setRevenue(String(member.targets?.monthlyRevenue ?? 500000));
      setCommission(String(member.targets?.commissionPct ?? 10));
    }
  });

  if (!member) return null;

  const loc = member.lastLocation;
  const isSelf = member.id === currentUserId;

  const handleSave = () => {
    onUpdate({
      name: name.trim(),
      phone: phone.trim() || null,
      targets: {
        monthlyDeals: Number(deals) || 0,
        monthlyRevenue: Number(revenue) || 0,
        monthlyLeads: Number(leads) || 0,
        commissionPct: Number(commission) || 0,
      },
    });
  };

  const openGoogleMaps = () => {
    if (!loc) return;
    const url = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Sheet open={open} onClose={onClose} title={`${member.name} • सदस्य विवरण`}>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Row gap={12} align="center" style={{ padding: 12, backgroundColor: isDark ? '#141829' : '#F1F5F9', borderRadius: 14 }}>
          <Avatar name={member.name} uri={member.avatarUrl} size={48} />
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong" style={{ fontSize: 16 }}>{member.name}</Txt>
            <Txt v="caption" color="muted">{member.email}</Txt>
            <Row gap={6} style={{ marginTop: 4 }}>
              <Badge label={member.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'} color={member.role === 'BROKER_ADMIN' ? c.brand : '#3B82F6'} />
              <Badge label={member.kycStatus || 'UNVERIFIED'} color={member.kycStatus === 'VERIFIED' ? '#10B981' : '#F59E0B'} />
            </Row>
          </View>
        </Row>

        {/* 1. Live Location Section */}
        <Card style={{ padding: 14, gap: 8 }}>
          <Row justify="space-between" align="center">
            <Row gap={6} align="center">
              <Compass size={16} color="#10B981" />
              <Txt v="bodyStrong">लाइव लोकेशन (Live Location)</Txt>
            </Row>
            {loc ? (
              <Txt v="caption" style={{ color: '#10B981', fontWeight: '800' }}>
                🟢 {timeAgo(loc.capturedAt)}
              </Txt>
            ) : (
              <Txt v="caption" color="muted">Offline</Txt>
            )}
          </Row>

          {loc ? (
            <View style={{ gap: 8 }}>
              <Txt v="caption" color="muted">
                GPS: {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)} · Accuracy: ±{Math.round(loc.accuracy || 10)}m
              </Txt>
              <Button
                title="Google Maps पर खोलें"
                icon={<Navigation size={15} color="#fff" />}
                style={{ backgroundColor: '#10B981' }}
                onPress={openGoogleMaps}
              />
            </View>
          ) : (
            <Txt v="caption" color="muted">
              एजेंट ने अभी तक लोकेशन शेयर नहीं की है। जब वे ऐप इस्तेमाल करेंगे, लोकेशन स्वतः अपडेट होगी।
            </Txt>
          )}
        </Card>

        {/* 2. Target Management & Fulfillment */}
        <Card style={{ padding: 14, gap: 10 }}>
          <Row gap={6} align="center">
            <Target size={16} color="#F59E0B" />
            <Txt v="bodyStrong">मासिक लक्ष्य (Monthly Targets)</Txt>
          </Row>

          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <Input
                label="Deals Target"
                value={deals}
                onChangeText={setDeals}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Leads Target"
                value={leads}
                onChangeText={setLeads}
                keyboardType="numeric"
              />
            </View>
          </Row>

          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <Input
                label="Revenue (₹)"
                value={revenue}
                onChangeText={setRevenue}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Commission %"
                value={commission}
                onChangeText={setCommission}
                keyboardType="numeric"
              />
            </View>
          </Row>
        </Card>

        {/* 3. Editable Profile Details */}
        {isBrokerAdmin && (
          <Card style={{ padding: 14, gap: 10 }}>
            <Txt v="bodyStrong">प्रोफाइल विवरण (Edit Profile)</Txt>
            <Input label="नाम" value={name} onChangeText={setName} />
            <Input label="फ़ोन नंबर" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </Card>
        )}

        {/* 4. Role & Team Actions */}
        {isBrokerAdmin && !isSelf && (
          <Card style={{ padding: 14, gap: 10 }}>
            <Txt v="bodyStrong">त्वरित कार्यवाहियाँ (Quick Actions)</Txt>
            <Row gap={8}>
              <Button
                title={member.role === 'BROKER_ADMIN' ? 'Agent बनाएँ' : 'Admin बनाएँ'}
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() =>
                  onUpdate({
                    role: member.role === 'BROKER_ADMIN' ? 'BROKER_AGENT' : 'BROKER_ADMIN',
                  })
                }
              />
              <Button
                title={member.status === 'ACTIVE' ? 'Suspend करें' : 'Reactivate'}
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() =>
                  onUpdate({
                    status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                  })
                }
              />
            </Row>

            <Button
              title="Team से हटाएँ"
              variant="secondary"
              icon={<UserMinus size={15} color="#EF4444" />}
              style={{ borderColor: '#EF4444' }}
              onPress={() => {
                Alert.alert(
                  'Team से हटाएँ?',
                  `क्या आप ${member.name} को टीम से हटाना चाहते हैं? उनकी सभी leads unassigned हो जाएँगी।`,
                  [
                    { text: 'रद्द करें', style: 'cancel' },
                    { text: 'हटाएँ', style: 'destructive', onPress: () => onRemove(member.id) },
                  ],
                );
              }}
            />
          </Card>
        )}

        {/* Save button */}
        {isBrokerAdmin && (
          <Button
            title="बदलाव सेव करें (Save Changes)"
            icon={<Save size={16} color="#fff" />}
            onPress={handleSave}
            style={{ backgroundColor: c.brand, marginTop: 4 }}
          />
        )}
      </ScrollView>
    </Sheet>
  );
}
