import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Switch, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Plus } from 'lucide-react-native';
import { formatINR, type LocalityListItem } from '@brokeriq/shared';
import { api, del, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError, useApiMutation } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Chip, Empty, ErrorView, Header, Input, Loader, Row, Screen, SectionTitle, Sheet, Txt } from '@/ui';
import { ListingRow } from '@/components/listing';

/** "अपनी ज़रूरत बताएँ" — requirements with instant matches and alerts on new listings. */
export default function Requirements() {
  const { c } = useTheme();
  const list = useQuery({ queryKey: ['consumer-requirements'], queryFn: () => api<any[]>('/requirements/mine') });
  const [sel, setSel] = useState<string | null>(null);
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const active = sel ?? selected ?? list.data?.[0]?.id ?? null;
  const matches = useQuery({
    queryKey: ['consumer-requirement-matches', active],
    queryFn: () => api<any[]>(`/requirements/${active}/matches`),
    enabled: !!active,
  });
  const setStatus = useApiMutation((b: { id: string; status: string }) => patch(`/requirements/${b.id}`, { status: b.status }), {
    success: 'Updated',
    invalidate: [['consumer-requirements']],
  });
  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title="मेरी ज़रूरतें"
        subtitle="मिलती property आते ही बताएँगे"
        right={<Button title="नई" size="sm" icon={<Plus size={15} color="#fff" />} onPress={() => router.push('/customer-requirements/new')} />}
      />
      {list.isLoading ? (
        <Loader />
      ) : list.isError ? (
        <ErrorView error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <Empty
          icon={<ClipboardList size={26} color={c.brand} />}
          title="अपनी ज़रूरत बताएँ"
          text="BHK, budget और sector बताइए — हम मिलती properties ढूँढकर भेजेंगे।"
          action={<Button title="शुरू करें" onPress={() => router.push('/customer-requirements/new')} />}
        />
      ) : (
        <>
          {list.data.map((r) => (
            <Card key={r.id} onPress={() => setSel(r.id)} style={{ padding: 14, gap: 6, marginTop: 10, borderColor: active === r.id ? c.brand : c.line }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="bodyStrong">{`${r.bedrooms.length ? `${r.bedrooms.join('/')} BHK` : 'कोई भी BHK'}${r.maxBudget ? ` · ${formatINR(r.maxBudget)} तक` : ''}`}</Txt>
                <Badge label={r.status === 'ACTIVE' ? 'Alerts ON' : r.status} color={r.status === 'ACTIVE' ? c.success : c.muted} />
              </Row>
              <Txt v="caption" color="muted">{`${r.localityIds.length ? `${r.localityIds.length} इलाके` : 'पूरा Gurgaon'} · ${r.matchCount} alerts`}</Txt>
              <Row>
                <Button
                  title={r.status === 'ACTIVE' ? 'Alerts रोकें' : 'Alerts चालू'}
                  size="sm"
                  variant="secondary"
                  onPress={() => setStatus.mutate({ id: r.id, status: r.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
                />
                <Button
                  title="Delete"
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    del(`/requirements/${r.id}`)
                      .then(() => list.refetch())
                      .catch(showError)
                  }
                />
              </Row>
            </Card>
          ))}
          <SectionTitle title={`Matching properties${matches.data ? ` (${matches.data.length})` : ''}`} />
          {matches.isLoading ? (
            <Loader />
          ) : matches.isError ? (
            <ErrorView error={matches.error} onRetry={() => matches.refetch()} />
          ) : !matches.data?.length ? (
            <Txt v="small" color="muted">
              अभी कोई नहीं — आते ही बताएँगे।
            </Txt>
          ) : (
            <View style={{ gap: 10 }}>
              {matches.data.map((l) => (
                <ListingRow key={l.id} l={l} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
