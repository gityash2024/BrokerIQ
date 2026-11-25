import { JumpFlatList } from '@/components/list-jump';
import { NativeInventoryTabs } from '@/launch/inventory-tabs';
import { InlineLoader } from '@/components/request-loader';
import { View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { LedgerItem } from '@brokeriq/shared';
import { hasDelegatedAccess } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { BrokerScreen } from '@/launch/screen';
import { PublicationReview } from '@/launch/publication-review';
import { Txt, ErrorView } from '@/ui';
export default function PublicationQueue() {
  const { user } = useAuth();
  const allowed = user?.role === 'BROKER_ADMIN' || (user?.role === 'SUB_BROKER_ADMIN' && hasDelegatedAccess(user, 'inventory', 'view', 'approve'));
  const query = useInfiniteQuery({
    queryKey: ['publication-queue', user?.id],
    queryFn: ({ pageParam }) =>
      api<{ items: NonNullable<LedgerItem['publishedListing']>[]; page: number; totalPages: number }>(`/inventory/publications/queue?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (p) => (p.page < p.totalPages ? p.page + 1 : undefined),
    enabled: allowed,
  });
  return (
    <BrokerScreen title="Publication Review" subtitle="Review public details · Verified firm Admin approval" back>
      <View style={{ paddingHorizontal: 16 }}>
        <NativeInventoryTabs active="/broker/publications" />
      </View>
      {!allowed ? (
        <Txt>Broker Admin review access required.</Txt>
      ) : (
        <JumpFlatList
          data={query.data?.pages.flatMap((p) => p.items) ?? []}
          keyExtractor={(item) => item.id + item.updatedAt}
          contentContainerStyle={{ padding: 20, gap: 16 }}
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListEmptyComponent={
            query.error ? (
              <ErrorView error={query.error} onRetry={() => query.refetch()} />
            ) : query.isPending ? (
              <InlineLoader />
            ) : (
              <Txt>No publications await your approval.</Txt>
            )
          }
          renderItem={({ item }) => (
            <PublicationReview
              listing={item}
              onDone={() => {
                void query.refetch();
              }}
            />
          )}
        />
      )}
    </BrokerScreen>
  );
}
