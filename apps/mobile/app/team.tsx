import { DelegatedPermissions } from '@/components/delegated-permissions';
import { firmRoleLabel } from '@brokeriq/shared';
import { useState } from 'react';
import { ChoiceField } from '@/launch/form';
import { ManagementExport } from '@/components/management-export';
import { FlatList, Share, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Crown, Search, Send, Trophy, UserPlus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { timeAgo } from '@brokeriq/shared';
import { post } from '@/lib/api';
import { hasDelegatedAccess } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { useTeam } from '@/components/crm';
import { Avatar, Badge, Button, Card, Chip, ErrorView, Header, IconBtn, Input, Row, Screen, Sheet, Skeleton, Txt } from '@/ui';

export default function Team() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const { user, isBrokerAdmin } = useAuth();
  const q = useTeam();
  const inv = [['team']];

  const [inviteOpen, setInviteOpen] = useState(false);

  // Invite form state
  const [f, setF] = useState({ name: '', email: '', role: 'BROKER_AGENT' });
  const [permissions, setPermissions] = useState<string[]>([]);
  const invite = useApiMutation(() => post<{ link: string; emailed: boolean }>('/broker/team/invite', { ...f, ...(f.role === 'SUB_BROKER_ADMIN' ? { delegatedPermissions: permissions } : {}) }), {
    invalidate: inv,
    success: (r) => (r.emailed ? 'Invite email भेजी गई' : 'Invite link बना — share करें'),
    onSuccess: (r) => {
      setInviteOpen(false);
      setPermissions([]);
      Share.share({ message: `${f.name}, हमारी BrokerIQ team join करें: ${r.link}` });
      setF({ name: '', email: '', role: 'BROKER_AGENT' });
    },
  });

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'BROKER_ADMIN' | 'BROKER_AGENT' | 'SUB_BROKER_ADMIN'>('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [kycFilter, setKycFilter] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<string | null>('NAME');
  const [descending, setDescending] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const members = q.data?.members ?? [];
  const day = (date: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
  const validDate = (date: string) =>
    !date || (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date);
  const invalidDates = !validDate(from) || !validDate(to) || !!(from && to && from > to);
  const filteredMembers = members
    .filter((member) => {
      if (
        invalidDates ||
        (roleFilter !== 'ALL' && member.role !== roleFilter) ||
        (statusFilter !== 'ALL' && member.status !== statusFilter) ||
        (kycFilter && member.kycStatus !== kycFilter) ||
        (memberFilter && member.id !== memberFilter)
      )
        return false;
      if ((from && day(member.createdAt) < from) || (to && day(member.createdAt) > to)) return false;
      const text = search.trim().toLowerCase();
      return !text || [member.name, member.email, member.phone].some((value) => value?.toLowerCase().includes(text));
    })
    .sort((a, b) => {
      const diff =
        sort === 'WON'
          ? (a.fulfillment?.dealsWonMonth ?? 0) - (b.fulfillment?.dealsWonMonth ?? 0)
          : sort === 'LEADS'
            ? a.stats.openLeads - b.stats.openLeads
            : sort === 'JOINED'
              ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
              : sort === 'ROLE'
                ? a.role.localeCompare(b.role)
                : sort === 'KYC'
                  ? a.kycStatus.localeCompare(b.kycStatus)
                  : a.name.localeCompare(b.name);
      return (descending ? -diff : diff) || a.id.localeCompare(b.id);
    });
  const exportIds = filteredMembers.filter((member) => !selected.size || selected.has(member.id)).map((member) => member.id);

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

      {/* Filter and Search Bar */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 8 }}>
        <Input
          placeholder="खोजें — नाम, ईमेल, फ़ोन..."
          value={search}
          onChangeText={setSearch}
          icon={<Search size={16} color={c.muted} />}
          style={{ minHeight: 40 }}
        />

        <Row gap={8}>
          <Button title={`Filters / Sort · ${filteredMembers.length}`} variant="secondary" size="sm" onPress={() => setFilterOpen(true)} />
          <Button
            title={selected.size ? 'Selection हटाएँ' : 'दिखे records चुनें'}
            variant="ghost"
            size="sm"
            onPress={() => setSelected(selected.size ? new Set() : new Set(filteredMembers.map((member) => member.id)))}
          />
        </Row>
        {invalidDates && <Txt color="danger">सही date range भरें: YYYY-MM-DD</Txt>}
      </View>

      {q.isError ? (
        <ErrorView error={q.error} />
      ) : (
        <FlatList
          data={filteredMembers}
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
                      {i.email} · {firmRoleLabel(i.role)}
                    </Txt>
                  </Card>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item: m, index }) => {
            const memberAny = m as any;
            const loc = memberAny.lastLocation;
            const dealsTarget = memberAny.targets?.monthlyDeals;
            const dealsWon = memberAny.fulfillment?.dealsWonMonth ?? m.stats?.won30d ?? 0;
            const dealsPct = memberAny.fulfillment?.dealsPercent ?? (dealsTarget > 0 ? Math.min(100, Math.round((dealsWon / dealsTarget) * 100)) : 0);

            return (
              <Animated.View entering={FadeInDown.delay(index * 40)}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => router.push(`/team-member/${encodeURIComponent(m.id)}` as any)}
                  onLongPress={() =>
                    setSelected((old) => {
                      const next = new Set(old);
                      if (next.has(m.id)) next.delete(m.id);
                      else next.add(m.id);
                      return next;
                    })
                  }
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
                            <Txt v="bodyStrong">
                              {selected.has(m.id) ? '✓ ' : ''}
                              {m.name}
                            </Txt>
                            {m.id === user?.id && (
                              <Txt v="caption" color="muted">
                                (आप)
                              </Txt>
                            )}
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
                          <Badge label={m.role === 'SUB_BROKER_ADMIN' ? 'Sub-Broker Admin' : 'Agent'} color="#3B82F6" />
                        )}
                        {m.status === 'SUSPENDED' && <Badge label="Suspended" color="#EF4444" />}
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
                              पिछली लोकेशन: {timeAgo(loc.capturedAt)}
                            </Txt>
                          </Row>
                        ) : (
                          <Row gap={6} align="center">
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.muted }} />
                            <Txt v="caption" color="muted">
                              Offline
                            </Txt>
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
                          <Txt v="caption" color="muted">
                            मासिक डील्स लक्ष्य:
                          </Txt>
                          <Txt v="caption" style={{ fontWeight: '800' }}>
                            {dealsWon} won · {dealsTarget == null ? 'Target not set' : `${dealsTarget} target (${dealsPct}%)`}
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

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Team filters / exports">
        <ChoiceField
          label="Role"
          value={roleFilter === 'ALL' ? null : roleFilter}
          choices={['BROKER_ADMIN', 'BROKER_AGENT', 'SUB_BROKER_ADMIN']}
          emptyLabel="All roles"
          onChange={(value) => setRoleFilter((value || 'ALL') as any)}
        />
        <ChoiceField
          label="Account status"
          value={statusFilter === 'ALL' ? null : statusFilter}
          choices={['ACTIVE', 'SUSPENDED']}
          emptyLabel="All statuses"
          onChange={(value) => setStatusFilter(value || 'ALL')}
        />
        <ChoiceField
          label="KYC status"
          value={kycFilter}
          choices={['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED']}
          emptyLabel="All KYC"
          onChange={setKycFilter}
        />
        <ChoiceField
          label="Member"
          value={memberFilter}
          choices={members.map((member) => member.id)}
          labels={Object.fromEntries(members.map((member) => [member.id, member.name]))}
          emptyLabel="All members"
          onChange={setMemberFilter}
        />
        <Input label="Joined from (IST)" placeholder="YYYY-MM-DD" value={from} onChangeText={setFrom} />
        <Input label="Joined to (IST)" placeholder="YYYY-MM-DD" value={to} onChangeText={setTo} />
        <ChoiceField label="Sort by" value={sort} choices={['NAME', 'ROLE', 'KYC', 'JOINED', 'WON', 'LEADS']} onChange={setSort} />
        <Button title={descending ? 'Descending ↓' : 'Ascending ↑'} variant="secondary" onPress={() => setDescending(!descending)} />
        {hasDelegatedAccess(user, 'team', 'export') && <ManagementExport endpoint="/broker/team/export" ids={exportIds} label={selected.size ? 'Selected + filtered' : 'Filtered'} />}
        <Txt color="muted">किसी card को long press करके अलग records चुनें।</Txt>
        <Button
          title="Filters reset"
          variant="ghost"
          onPress={() => {
            setRoleFilter('ALL');
            setStatusFilter('ALL');
            setKycFilter(null);
            setMemberFilter(null);
            setFrom('');
            setTo('');
            setSearch('');
            setSelected(new Set());
          }}
        />
        <Button title="सूची देखें" onPress={() => setFilterOpen(false)} />
      </Sheet>
      {/* Invite Member Sheet */}
      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title="Team member invite करें">
        <Input label="नाम" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Input label="Email" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} keyboardType="email-address" autoCapitalize="none" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Agent" active={f.role === 'BROKER_AGENT'} onPress={() => setF({ ...f, role: 'BROKER_AGENT' })} />
          <Chip label="Admin" active={f.role === 'BROKER_ADMIN'} onPress={() => setF({ ...f, role: 'BROKER_ADMIN' })} />
          <Chip label="Sub-Broker Admin" active={f.role === 'SUB_BROKER_ADMIN'} onPress={() => setF({ ...f, role: 'SUB_BROKER_ADMIN' })} />
        </View>
        {f.role === 'SUB_BROKER_ADMIN' && <DelegatedPermissions value={permissions} onChange={setPermissions} />}
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
