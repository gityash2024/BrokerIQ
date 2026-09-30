import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Ban, CheckCircle2, ShieldAlert } from 'lucide-react-native';
import { LISTING_STATUS_LABELS, formatPriceShort, isStaff, type ListingStatus } from '@brokeriq/shared';
import { api, img, patch, post, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Empty, ErrorView, Header, Input, Row, Screen, Segmented, Sheet, Skeleton, Txt } from '@/ui';

type Tab = 'review' | 'reports' | 'listings';

/** BrokerIQ team on the phone: approve/reject new listings, act on reports, block/unblock any listing. */
export default function AdminScreen() {
  const { c } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('review');
  const [q, setQ] = useState('');
  const [reasonFor, setReasonFor] = useState<null | { id: string; title: string; kind: 'reject' | 'block'; reportId?: string }>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const staff = isStaff(user?.role);
  const pending = useQuery({ queryKey: ['m-admin-pending'], queryFn: () => api<any>('/admin/pending'), enabled: staff });
  const review = useQuery({ queryKey: ['m-admin-review'], queryFn: () => api<any>('/admin/moderation/listings'), enabled: staff && tab === 'review' });
  const reports = useQuery({ queryKey: ['m-admin-reports'], queryFn: () => api<any[]>('/admin/reports'), enabled: staff && tab === 'reports' });
  const listings = useQuery({ queryKey: ['m-admin-listings', q], queryFn: () => api<any>(`/admin/listings${qs({ q })}`), enabled: staff && tab === 'listings' });
  const refresh = () => Promise.all([pending.refetch(), review.refetch(), reports.refetch(), listings.refetch()]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const confirmReason = () => {
    const r = reasonFor!;
    const text = reason.trim();
    act(async () => {
      if (r.kind === 'reject') await post(`/admin/moderation/listings/${r.id}`, { action: 'reject', reason: text });
      else await post(`/admin/listings/${r.id}/block`, { reason: text });
      if (r.reportId) await patch(`/admin/reports/${r.reportId}`, { status: 'RESOLVED', resolution: `Listing blocked: ${text}` });
    }, r.kind === 'reject' ? 'Listing reject हुई' : 'Listing block हुई').then(() => (setReasonFor(null), setReason('')));
  };

  if (!staff)
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Admin" />
        <Empty icon={<ShieldAlert size={28} color={c.brand} />} title="यह BrokerIQ team के लिए है" />
      </Screen>
    );

  const p = pending.data;
  const data = tab === 'review' ? review.data?.items : tab === 'reports' ? reports.data : listings.data?.items;
  const query = tab === 'review' ? review : tab === 'reports' ? reports : listings;
  return (
    <Screen scroll={false} padded={false} edges={['top', 'bottom']}>
      <Header title="Admin" subtitle={p ? `${p.pendingListings} review · ${p.reportsOpen} reports · ${p.errorsOpen} errors` : undefined} />
      <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 10 }}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'review', label: 'Review', count: p?.pendingListings }, { value: 'reports', label: 'Reports', count: p?.reportsOpen }, { value: 'listings', label: 'Listings' }]} />
        {tab === 'listings' && <Input placeholder="Title या slug खोजें" value={q} onChangeText={setQ} />}
        <Button size="sm" variant="secondary" title="Field verification (GPS photo)" icon={<BadgeCheck size={16} color={c.fg} />} onPress={() => router.push('/field-verify')} />
      </View>
      {query.isError ? (
        <ErrorView error={query.error} />
      ) : (
        <FlatList
          data={(data ?? []) as any[]}
          keyExtractor={(x) => x.id}
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={query.isLoading ? <Skeleton h={140} /> : <Empty icon={<CheckCircle2 size={28} color={c.success} />} title="सब साफ़ है 🎉" />}
          renderItem={({ item }) => {
            if (tab === 'reports') {
              const r = item;
              return (
                <Card style={{ padding: 14, gap: 6 }}>
                  <Txt v="bodyStrong" numberOfLines={1} onPress={() => router.push(`/property/${r.listing.slug}`)}>{r.listing.title}</Txt>
                  <Txt v="small" color="danger">{r.reason}{r.details ? ` — ${r.details}` : ''}</Txt>
                  <Txt v="caption" color="subtle">{r.user?.name ?? 'Anonymous'} · {LISTING_STATUS_LABELS[r.listing.status as ListingStatus] ?? r.listing.status}</Txt>
                  <Row style={{ marginTop: 4 }}>
                    <Button size="sm" variant="danger" title="Listing block" disabled={busy} onPress={() => setReasonFor({ id: r.listing.id, title: r.listing.title, kind: 'block', reportId: r.id })} style={{ flex: 1 }} />
                    <Button size="sm" variant="secondary" title="Dismiss" disabled={busy} onPress={() => act(() => patch(`/admin/reports/${r.id}`, { status: 'DISMISSED' }), 'Report dismiss')} />
                  </Row>
                </Card>
              );
            }
            const l = item;
            const cover = l.coverUrl ?? l.media?.[0]?.url;
            return (
              <Card style={{ overflow: 'hidden' }}>
                {!!cover && <Image source={{ uri: img(cover, 600) }} style={{ height: 130, width: '100%' }} contentFit="cover" />}
                <View style={{ padding: 14, gap: 4 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="bodyStrong" numberOfLines={1} style={{ flex: 1 }} onPress={() => router.push(`/property/${l.slug}`)}>{l.title}</Txt>
                    <Badge label={LISTING_STATUS_LABELS[l.status as ListingStatus] ?? l.status} color={l.status === 'BLOCKED' ? c.danger : undefined} />
                  </Row>
                  <Txt v="small" color="muted">{formatPriceShort(l.price)}/month · {l.locality?.name} · {l.organization?.name ?? l.postedBy?.name}</Txt>
                  {!!l.moderationFlags?.length && <Txt v="caption" color="danger">⚠️ {l.moderationFlags.join(', ')}</Txt>}
                  {!!l.blockedReason && <Txt v="caption" color="danger">{l.blockedReason}</Txt>}
                  <Row style={{ marginTop: 6 }}>
                    {tab === 'review' ? (
                      <>
                        <Button size="sm" variant="success" title="Approve" disabled={busy} onPress={() => act(() => post(`/admin/moderation/listings/${l.id}`, { action: 'approve' }), 'Listing live')} style={{ flex: 1 }} />
                        <Button size="sm" variant="secondary" title="Reject" disabled={busy} onPress={() => setReasonFor({ id: l.id, title: l.title, kind: 'reject' })} />
                      </>
                    ) : l.status === 'BLOCKED' ? (
                      <Button size="sm" variant="success" title="Unblock" disabled={busy} onPress={() => act(() => post(`/admin/listings/${l.id}/unblock`, {}), 'Listing वापस चालू')} style={{ flex: 1 }} />
                    ) : (
                      <Button size="sm" variant="danger" title="Block" icon={<Ban size={14} color="#fff" />} disabled={busy} onPress={() => setReasonFor({ id: l.id, title: l.title, kind: 'block' })} style={{ flex: 1 }} />
                    )}
                  </Row>
                </View>
              </Card>
            );
          }}
        />
      )}
      <Sheet open={!!reasonFor} onClose={() => (setReasonFor(null), setReason(''))} title={reasonFor?.kind === 'reject' ? 'Reject का कारण' : 'Block का कारण'}>
        <Txt v="small" color="muted" numberOfLines={2}>{reasonFor?.title}</Txt>
        <Input multiline placeholder="जैसे: fake photos, गलत rent, spam…" value={reason} onChangeText={setReason} containerStyle={{ marginTop: 10 }} />
        <Button title={reasonFor?.kind === 'reject' ? 'Reject करें' : 'Block करें'} variant="danger" loading={busy} disabled={reason.trim().length < 3} onPress={confirmReason} style={{ marginTop: 12 }} />
      </Sheet>
    </Screen>
  );
}
