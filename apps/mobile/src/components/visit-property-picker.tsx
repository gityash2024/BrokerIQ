import { InlineLoader } from '@/components/request-loader';
import { useState } from 'react';

import { ScrollView } from '@/components/keyboard-scroll-view';
import { useInfiniteQuery } from '@tanstack/react-query';
import { visitInventoryDetails, visitInventoryTitle, type LedgerItem } from '@brokeriq/shared';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { Button, ErrorView, Input, PressableScale, Txt } from '@/ui';

type Result = { items: LedgerItem[]; total: number; totalPages: number };
export function VisitPropertyPicker({
  open,
  value,
  onChange,
  purpose = 'visit',
  excluded = [],
}: {
  open: boolean;
  value: LedgerItem | null;
  onChange: (item: LedgerItem | null) => void;
  purpose?: 'visit' | 'photos';
  excluded?: readonly string[];
}) {
  const { c } = useTheme();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const term = useDebounced(search);
  const list = useInfiniteQuery({
    queryKey: ['visit-inventory-picker', user?.id, term],
    initialPageParam: 1,
    enabled: open,
    queryFn: ({ pageParam }) => api<Result>(`/inventory${qs({ page: pageParam, pageSize: 25, search: term })}`),
    getNextPageParam: (last, pages) => (pages.length < last.totalPages ? pages.length + 1 : undefined),
  });
  if (value)
    return (
      <>
        <Txt v="bodyStrong">{visitInventoryTitle(value)}</Txt>
        <Txt v="caption" color="muted">
          {visitInventoryDetails(value)}
        </Txt>
        <Button title={purpose === 'photos' ? 'Change property' : 'Change / custom address'} variant="secondary" onPress={() => onChange(null)} />
      </>
    );
  return (
    <>
      <Input value={search} onChangeText={setSearch} accessibilityLabel="Search properties" placeholder="House / floor / sector / address" />
      {list.isError ? (
        <ErrorView error={list.error} />
      ) : (
        <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
          {list.data?.pages
            .flatMap((page) => page.items)
            .filter((item) => !excluded.includes(item.id))
            .map((item) => (
              <PressableScale key={item.id} onPress={() => onChange(item)} style={{ padding: 12, borderBottomWidth: 1, borderColor: c.line }}>
                <Txt v="bodyStrong">{visitInventoryTitle(item)}</Txt>
                <Txt v="caption" color="muted">
                  {visitInventoryDetails(item)}
                </Txt>
              </PressableScale>
            ))}
          {list.isPending && <InlineLoader />}
          {list.data?.pages[0].total === 0 && (
            <Txt color="muted">{purpose === 'photos' ? 'No matching property.' : 'No matching property. Enter a custom meeting address below.'}</Txt>
          )}
          {list.hasNextPage && <Button title="Load more" variant="secondary" loading={list.isFetchingNextPage} onPress={() => list.fetchNextPage()} />}
        </ScrollView>
      )}
    </>
  );
}
