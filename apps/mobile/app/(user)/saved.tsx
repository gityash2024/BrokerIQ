import { useState } from 'react';
import { FlatList, Share, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Bell, BellOff, Columns3, Heart, Search, Share2, Trash2 } from 'lucide-react-native';
import { api, del, patch, post } from '@/lib/api';
import { useFlag } from '@/lib/config';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { showError, useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { ListingRow, SaveButton } from '@/components/listing';
import { LoginPrompt } from '@/components/login-prompt';
import { Button, Card, Empty, ErrorView, IconBtn, Row, Screen, Segmented, Skeleton, Txt } from '@/ui';

export default function Saved() {
  const { user } = useAuth();
  const { c } = useTheme();
  const [tab, setTab] = useState<'homes' | 'searches' | 'recent'>('homes');
  const saved = useQuery({ queryKey: ['saved'], queryFn: () => api<any[]>('/listings/saved'), enabled: !!user });
  const recent = useQuery({ queryKey: ['recent'], queryFn: () => api<any[]>('/listings/recent'), enabled: !!user && tab === 'recent' });
  const searches = useQuery({ queryKey: ['saved-searches'], queryFn: () => api<any[]>('/me/saved-searches'), enabled: !!user && tab === 'searches' });
  const toggle = useApiMutation((s: any) => patch(`/me/saved-searches/${s.id}`, { alertsEnabled: !s.alertsEnabled }), { invalidate: [['saved-searches']] });
  const remove = useApiMutation((id: string) => del(`/me/saved-searches/${id}`), { success: 'Search हटाई', invalidate: [['saved-searches']] });
  const shortlistOn = useFlag('compare_shortlist');
  const [picked, setPicked] = useState<string[] | null>(null);
  if (!user)
    return <LoginPrompt title="अपनी पसंदीदा properties save करें" text="Login करें — saved homes, searches और price alerts सब devices पर sync होंगे।" />;
  const listQ = tab === 'recent' ? recent : saved;
  const homesTools = tab === 'homes' && shortlistOn && (saved.data?.length ?? 0) > 0;
  const togglePick = (id: string) =>
    setPicked((p) => (!p ? p : p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? (toast.error('ज़्यादा से ज़्यादा 4 घर'), p) : [...p, id]));
  const shareShortlist = async () => {
    try {
      const r = await post<{ url: string }>('/me/shortlist/share');
      await Share.share({ message: `मेरी shortlist के घर देखो: ${r.url}` });
    } catch (e) {
      showError(e);
    }
  };
  const rows = (listQ.data ?? []).map((x: any) => x.listing ?? x);
  return (
    <Screen scroll={false} padded={false}>
      <View style={{ padding: 16, gap: 14 }}>
        <Txt v="h1">Saved</Txt>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'homes', label: 'Homes', count: saved.data?.length },
            { value: 'searches', label: 'Searches & alerts' },
            { value: 'recent', label: 'Recently viewed' },
          ]}
        />
        {homesTools && (
          <Row wrap>
            {picked ? (
              <>
                <Button
                  title={`Compare (${picked.length})`}
                  size="sm"
                  disabled={picked.length < 2}
                  onPress={() => (router.push({ pathname: '/compare', params: { ids: picked.join(',') } }), setPicked(null))}
                />
                <Button title="Cancel" size="sm" variant="ghost" onPress={() => setPicked(null)} />
              </>
            ) : (
              <>
                {(saved.data?.length ?? 0) > 1 && (
                  <Button title="Compare करें" size="sm" variant="secondary" icon={<Columns3 size={14} color={c.fg} />} onPress={() => setPicked([])} />
                )}
                <Button title="Family के साथ share" size="sm" variant="secondary" icon={<Share2 size={14} color={c.fg} />} onPress={shareShortlist} />
              </>
            )}
          </Row>
        )}
      </View>
      {tab === 'searches' ? (
        <FlatList
          data={searches.data ?? []}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10, paddingBottom: 120 }}
          ListEmptyComponent={
            searches.isLoading ? (
              <Skeleton h={80} />
            ) : (
              <Empty
                icon={<Search size={28} color={c.brand} />}
                title="कोई saved search नहीं"
                text="Explore में filters लगाकर 'Alert' दबाएँ — नई listing आते ही notification मिलेगा।"
              />
            )
          }
          renderItem={({ item }) => (
            <Card style={{ padding: 14 }} onPress={() => router.push({ pathname: '/(user)/search', params: item.filters })}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong">{item.name}</Txt>
                  <Txt v="caption" color="muted">
                    {item.alertsEnabled ? 'Alerts ON' : 'Alerts OFF'}
                  </Txt>
                </View>
                <IconBtn onPress={() => toggle.mutate(item)}>
                  {item.alertsEnabled ? <Bell size={20} color={c.brand} /> : <BellOff size={20} color={c.subtle} />}
                </IconBtn>
                <IconBtn onPress={() => remove.mutate(item.id)}>
                  <Trash2 size={18} color={c.danger} />
                </IconBtn>
              </Row>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10, paddingBottom: 120 }}
          refreshing={listQ.isRefetching}
          onRefresh={() => listQ.refetch()}
          ListEmptyComponent={
            listQ.isLoading ? (
              <Skeleton h={112} />
            ) : listQ.isError ? (
              <ErrorView error={listQ.error} />
            ) : (
              <Empty
                icon={<Heart size={28} color={c.brand} />}
                title={tab === 'recent' ? 'अभी कुछ नहीं देखा' : 'कोई saved property नहीं'}
                text="Properties पर ♥ दबाकर यहाँ save करें।"
                action={<Button title="Explore करें" onPress={() => router.push('/(user)/search')} />}
              />
            )
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 40)}>
              <ListingRow
                l={item}
                right={tab === 'homes' && !picked ? <SaveButton id={item.id} /> : undefined}
                onPress={picked && tab === 'homes' ? () => togglePick(item.id) : undefined}
                selected={!!picked?.includes(item.id)}
              />
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );
}
