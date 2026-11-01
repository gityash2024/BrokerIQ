import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Sheet, Txt } from '@/ui';
import { KycMedia } from './kyc-media';
export function KycHistory({ member }: { member?: string }) {
  const [open, setOpen] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['kyc-history', member],
    enabled: open,
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api<{ items: any[]; nextCursor: string | null }>(
        `/broker/team/agent-kyc/history?member=${encodeURIComponent(member ?? '')}&cursor=${encodeURIComponent(pageParam)}`,
      ),
    getNextPageParam: (last) => last.nextCursor || undefined,
  });
  return (
    <>
      <Button title="पिछली KYC submissions" size="sm" variant="secondary" onPress={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="KYC इतिहास">
        <ScrollView contentContainerStyle={{ gap: 14 }}>
          {q.isError ? (
            <>
              <Txt>{q.error.message}</Txt>
              <Button title="Retry" onPress={() => q.refetch()} />
            </>
          ) : q.isPending ? (
            <Txt>इतिहास खुल रहा है…</Txt>
          ) : (
            <>
              {!q.data?.pages.some((p) => p.items.length) && <Txt>पिछली submission नहीं है।</Txt>}
              {q.data?.pages
                .flatMap((p) => p.items)
                .map((d) => (
                  <View key={d.id} style={{ gap: 8 }}>
                    <Txt v="caption">
                      {d.docType} · {d.docNumber?.startsWith('LIVELINESS_') ? d.docNumber : ''} · {d.status} · {new Date(d.createdAt).toLocaleString()}
                    </Txt>
                    {!!d.reviewNote && <Txt>{d.reviewNote}</Txt>}
                    <KycMedia uri={d.fileUrl} style={{ height: 250 }} />
                  </View>
                ))}
              {q.hasNextPage && <Button title="और देखें" loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} />}
            </>
          )}
        </ScrollView>
      </Sheet>
    </>
  );
}
