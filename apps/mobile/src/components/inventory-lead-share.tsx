import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { propertyPhotoDraft, type LeadInboxChannel } from '@brokeriq/shared';
import { api, assertAccountContext, captureAccountContext, errorMessage, qs } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { openLeadInbox } from '@/lib/inbox-composer';
import { toast } from '@/lib/toast';
import { Button, Chip, ErrorView, Input, PressableScale, Txt } from '@/ui';

type Lead = { id: string; name: string; phone: string; email?: string | null };
type Page = { items: Lead[]; totalPages: number; total: number };

/** Opens an editable encrypted Inbox draft; choosing a channel never sends it. */
export function InventoryLeadShare({ message, photoUrls }: { message: string; photoUrls?: string[] }) {
  const owner = useRef(captureAccountContext()).current;
  const [includePhotos, setIncludePhotos] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [channel, setChannel] = useState<LeadInboxChannel>('WHATSAPP');
  const term = useDebounced(search);
  const draft = includePhotos ? propertyPhotoDraft(message, photoUrls) : message;
  const leads = useInfiniteQuery({
    queryKey: ['inventory-share-lead', owner.scope, term],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page>(`/leads${qs({ q: term, page: pageParam, pageSize: 20 })}`, { ownerContext: owner }),
    getNextPageParam: (last, pages) => (pages.length < last.totalPages ? pages.length + 1 : undefined),
    enabled: !!owner.userId && !selected,
  });
  const open = async () => {
    try {
      assertAccountContext(owner);
      if (!selected) throw new Error('Choose a CRM lead first.');
      await openLeadInbox(selected.id, draft, channel);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <Txt color="muted">Choose a CRM lead and review the property message in Inbox before sending.</Txt>
      {selected ? (
        <>
          <Txt v="bodyStrong">
            {selected.name || 'Lead'} · {selected.phone}
          </Txt>
          <Button title="Choose another lead" variant="secondary" onPress={() => setSelected(null)} />
        </>
      ) : (
        <>
          <Input placeholder="Lead name / phone" value={search} onChangeText={setSearch} />
          {leads.isError ? (
            <ErrorView error={leads.error} onRetry={() => leads.refetch()} />
          ) : (
            <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
              {leads.data?.pages
                .flatMap((page) => page.items)
                .map((lead) => (
                  <PressableScale key={lead.id} onPress={() => setSelected(lead)} style={{ padding: 12 }}>
                    <Txt v="bodyStrong">{lead.name || 'Lead'}</Txt>
                    <Txt v="caption" color="muted">
                      {lead.phone}
                    </Txt>
                  </PressableScale>
                ))}
              {leads.isPending && <Txt color="muted">Loading…</Txt>}
              {leads.data?.pages[0].total === 0 && <Txt color="muted">No matching lead.</Txt>}
              {leads.hasNextPage && (
                <Button title="Load more leads" variant="secondary" loading={leads.isFetchingNextPage} onPress={() => leads.fetchNextPage()} />
              )}
            </ScrollView>
          )}
        </>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['WHATSAPP', 'SMS', 'EMAIL'] as const).map((value) => (
          <Chip key={value} label={value === 'EMAIL' ? 'Email' : value} active={channel === value} onPress={() => setChannel(value)} />
        ))}
      </View>
      {!!photoUrls?.length && <Chip label="Include property photo links" active={includePhotos} onPress={() => setIncludePhotos(!includePhotos)} />}
      <Txt v="caption" color="muted">
        {draft}
      </Txt>
      <Button title={`Open ${channel === 'EMAIL' ? 'Email' : channel} Inbox`} disabled={!selected || (channel === 'EMAIL' && !selected.email)} onPress={open} />
      {selected && channel === 'EMAIL' && !selected.email && <Txt color="muted">Add the client's email to their lead before opening Email Inbox.</Txt>}
    </View>
  );
}
