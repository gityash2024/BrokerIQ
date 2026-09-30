import { useState } from 'react';
import { FlatList, Share, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Crown, Send, Trophy, UserPlus } from 'lucide-react-native';
import { timeAgo } from '@brokeriq/shared';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { useTeam } from '@/components/crm';
import { Avatar, Badge, Button, Card, Chip, ErrorView, Header, IconBtn, Input, Row, Screen, Sheet, Skeleton, Txt } from '@/ui';

export default function Team() {
  const { c } = useTheme();
  const { isBrokerAdmin } = useAuth();
  const q = useTeam();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', role: 'BROKER_AGENT' });
  const invite = useApiMutation(() => post<{ link: string; emailed: boolean }>('/broker/team/invite', f), {
    invalidate: [['team']],
    success: (r) => (r.emailed ? 'Invite email भेजी गई' : 'Invite link बना — share करें'),
    onSuccess: (r) => {
      setOpen(false);
      Share.share({ message: `${f.name}, हमारी team join करें: ${r.link}` });
      setF({ name: '', email: '', role: 'BROKER_AGENT' });
    },
  });
  const members = [...(q.data?.members ?? [])].sort((a: any, b: any) => b.stats.won30d - a.stats.won30d);
  return (
    <Screen scroll={false} padded={false} edges={['top', 'bottom']}>
      <Header
        title="Team"
        right={
          isBrokerAdmin ? (
            <IconBtn onPress={() => setOpen(true)} style={{ backgroundColor: c.brand }}>
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
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={q.isLoading ? <Skeleton h={80} /> : null}
          ListFooterComponent={
            (q.data?.invites ?? []).length ? (
              <View style={{ gap: 8, marginTop: 10 }}>
                <Txt v="label" color="subtle">
                  Pending invites
                </Txt>
                {q.data.invites.map((i: any) => (
                  <Card key={i.id} style={{ padding: 12 }}>
                    <Txt v="bodyStrong">{i.name}</Txt>
                    <Txt v="caption" color="muted">
                      {i.email}
                    </Txt>
                  </Card>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item: m, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 40)}>
              <Card style={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', opacity: m.status === 'ACTIVE' ? 1 : 0.5 }}>
                <View>
                  <Avatar name={m.name} uri={m.avatarUrl} size={48} />
                  {index === 0 && members.length > 1 && m.stats.won30d > 0 && (
                    <View style={{ position: 'absolute', right: -4, top: -4 }}>
                      <Trophy size={18} color="#F59E0B" fill="#F59E0B" />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Row gap={6}>
                    <Txt v="bodyStrong">{m.name}</Txt>
                    {m.role === 'BROKER_ADMIN' && <Badge label="Admin" color={c.brand} icon={<Crown size={10} color={c.brand} />} />}
                  </Row>
                  <Txt v="caption" color="muted">
                    {m.stats.openLeads} open · {m.stats.won30d} won · {m.stats.activities30d} activities (30d)
                  </Txt>
                  <Txt v="caption" color="subtle">
                    Last login {m.lastLoginAt ? timeAgo(m.lastLoginAt) : '—'}
                  </Txt>
                </View>
              </Card>
            </Animated.View>
          )}
        />
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Member invite करें">
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
