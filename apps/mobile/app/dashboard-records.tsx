import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, View } from 'react-native';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Screen, Header, Txt, ErrorView, Button } from '@/ui';
import { useTheme } from '@/lib/theme';
export default function Records() {
  const params = useLocalSearchParams<Record<string, string>>();
  const { user } = useAuth();
  const { c } = useTheme();
  const [page, setPage] = useState(1);
  const role = params.view !== 'user' && user && ['BROKER_ADMIN', 'BROKER_AGENT'].includes(user.role) ? 'broker' : 'user';
  const q = useQuery({
    queryKey: ['native-records', user?.id, params, page],
    queryFn: () =>
      api<any>(
        (role === 'broker' ? '/broker/dashboard/records' : '/me/dashboard/records') +
          '?' +
          new URLSearchParams({ ...params, chart: params.chart || (role === 'broker' ? 'leads' : 'enquiries'), page: String(page) }),
      ),
  });
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Activity details" subtitle={params.value} />
      {q.error ? (
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Txt color="muted">Loading records…</Txt>
      ) : (
        <View style={{ gap: 10 }}>
          <Txt v="caption" color="muted">
            {q.data.total + ' matching records'}
          </Txt>
          {q.data.items.map((r: any) => (
            <Pressable
              key={r.id}
              onPress={() => {
                if (r.href.startsWith('/broker/leads/')) router.push(r.href.replace('/broker/leads/', '/lead/') as any);
                else if (r.href.startsWith('/user/property/')) router.push(r.href.replace('/user/property/', '/property/') as any);
                else if (r.href.startsWith('/user/account/visits')) router.push('/my-visits' as any);
                else router.push((role === 'broker' ? '/(broker)/inventory' : '/enquiries') as any);
              }}
              style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, gap: 5 }}
            >
              <Txt v="title">{r.label}</Txt>
              <Txt v="caption" color="muted">
                {r.detail?.replace(/_/g, ' ')}
              </Txt>
              <Txt v="caption" color="subtle">
                {new Date(r.at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </Txt>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Previous" variant="secondary" disabled={page === 1} onPress={() => setPage(page - 1)} />
            <Button title="Next" variant="secondary" disabled={page * 30 >= q.data.total} onPress={() => setPage(page + 1)} />
          </View>
          <Button title="Back to overview" variant="secondary" onPress={() => router.back()} />
        </View>
      )}
    </Screen>
  );
}
