import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { type CapturedEntity } from '@brokeriq/shared';
import { api, API_URL, authStore, errorMessage } from '@/lib/api';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { ChoiceField } from '@/launch/form';
import { EntityFields, prepareEntity } from '@/launch/entity-fields';
import { editableDraft, decodeDraft, saveDraft, completeReviewDraft } from '@/launch/drafts';
import { Button, Txt, ErrorView } from '@/ui';
export default function ImportReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const [sourcePage, setSourcePage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const q = useQuery({
    queryKey: ['import', id, page, sourcePage],
    queryFn: () => api<any>(`/imports/${id}?page=${page}${sourcePage ? `&sourcePage=${sourcePage}` : ''}`),
    refetchInterval: 5000,
  });
  return (
    <BrokerScreen title="Review capture" subtitle={q.data ? `${q.data.total} entries · ${q.data.pending} need review` : 'Source saved, loading…'} back>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 50 }}>
        {q.data?.metadata?.pages?.length > 0 && (
          <ChoiceField
            label="Register page"
            value={sourcePage}
            choices={q.data.metadata.pages.map((p: any) => String(p.pageNo))}
            onChange={(value) => {
              setSourcePage(value);
              setPage(1);
            }}
          />
        )}
        {q.error && <ErrorView error={q.error} />}
        {error && <Txt color="danger">{error}</Txt>}
        {q.data?.lastError && (
          <NativeCard>
            <Txt color="danger">{q.data.lastError}</Txt>
            <Button
              title="Retry extraction"
              onPress={async () => {
                try {
                  await api(`/imports/${id}/retry`, { body: {} });
                  await q.refetch();
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            />
          </NativeCard>
        )}
        {['PENDING', 'PROCESSING'].includes(q.data?.status) && <Txt>Source saved. Extraction is processing…</Txt>}
        {q.data?.entries.map((entry: any) => (
          <Entry key={entry.id} batchId={id} entry={entry} image={q.data.sourceType === 'IMAGE'} />
        ))}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button title="Previous" variant="secondary" disabled={page === 1} onPress={() => setPage(page - 1)} />
          <Button title="Next" variant="secondary" disabled={!q.data || page >= q.data.totalPages} onPress={() => setPage(page + 1)} />
        </View>
      </ScrollView>
    </BrokerScreen>
  );
}
function Entry({ batchId, entry, image }: { batchId: string; entry: any; image: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <NativeCard>
      <Txt v="h3">
        {entry.pageNo ? `Page ${entry.pageNo} · ` : ''}Entry {entry.rowNo ?? ''}
      </Txt>
      <Txt v="caption" color="muted">
        {entry.reviewState}
      </Txt>
      <Txt v="small" numberOfLines={open ? undefined : 3}>
        {entry.rawText}
      </Txt>
      <Button title={open ? 'Collapse' : 'Review source & fields'} size="sm" variant="secondary" onPress={() => setOpen(!open)} />
      {open && <EntryEditor batchId={batchId} entry={entry} image={image} />}
    </NativeCard>
  );
}
function EntryEditor({ batchId, entry, image }: { batchId: string; entry: any; image: boolean }) {
  const qc = useQueryClient();
  const [entities, setEntities] = useState<any[]>(entry.extracted ?? []);
  const [version, setVersion] = useState(entry.updatedAt);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const draftId = useRef(Crypto.randomUUID());
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const done = entry.reviewState !== 'NEEDS_REVIEW';
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const row = await editableDraft('IMPORT_REVIEW', entry.id);
        if (row) {
          const saved = decodeDraft(row);
          draftId.current = row.id;
          if (active) {
            setEntities(saved.entities);
            setVersion(saved.expectedUpdatedAt);
          }
        }
        if (active) setReady(true);
      } catch (e) {
        if (active) setError(errorMessage(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [entry.id]);
  function change(next: any[]) {
    setEntities(next);
    setStatus('Saving draft…');
    writes.current = writes.current
      .catch(() => undefined)
      .then(() => saveDraft('IMPORT_REVIEW', entry.id, { batchId, entryId: entry.id, entities: next, expectedUpdatedAt: version }, draftId.current))
      .then(() => setStatus('Draft saved on this device'))
      .catch((e) => {
        setError(errorMessage(e));
      });
  }
  async function save(approve = false, ignore = false) {
    setBusy(true);
    setError('');
    try {
      const next: CapturedEntity[] = ignore
        ? []
        : entities.map((e) =>
            e.kind === 'INVENTORY'
              ? { ...e, inventory: prepareEntity(e.inventory ?? {}) }
              : e.kind === 'REQUIREMENT'
                ? { ...e, requirement: prepareEntity(e.requirement ?? {}, true) }
                : e,
          );
      await writes.current;
      await saveDraft('IMPORT_REVIEW', entry.id, { batchId, entryId: entry.id, entities: next, expectedUpdatedAt: version }, draftId.current);
      const response = await api<any>(`/imports/entries/${entry.id}${approve ? '/approve' : ''}`, {
        method: approve ? 'POST' : 'PATCH',
        body: { entities: next, ignore, expectedUpdatedAt: version },
      });
      if (response.updatedAt) {
        setVersion(response.updatedAt);
        await saveDraft('IMPORT_REVIEW', entry.id, { batchId, entryId: entry.id, entities: next, expectedUpdatedAt: response.updatedAt }, draftId.current);
      }
      if (approve || ignore) await completeReviewDraft(draftId.current, entry.id);
      setStatus(approve ? 'Reviewed and saved' : 'Review saved');
      await Promise.all(['import', 'ledger', 'broker-requirements'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 15 }}>
      {(image || entry.pageNo) && (
        <Image
          source={{
            uri: `${API_URL}/imports/${batchId}/source${entry.pageNo ? `?pageNo=${entry.pageNo}&entryId=${entry.id}` : ''}`,
            headers: { Authorization: `Bearer ${authStore.get()?.accessToken}` },
          }}
          contentFit="contain"
          style={{ height: 260, width: '100%' }}
          cachePolicy="none"
        />
      )}
      {ready &&
        entities.map((e, index) => (
          <View key={index} style={{ gap: 12 }}>
            <Txt v="h3">
              {e.kind} · {index + 1}
            </Txt>
            {e.warnings?.map((warning: string, i: number) => (
              <Txt key={i} v="small" color="warning">
                {warning}
              </Txt>
            ))}
            {!done && e.kind !== 'UNRELATED' && (
              <EntityFields
                requirement={e.kind === 'REQUIREMENT'}
                value={e.kind === 'REQUIREMENT' ? (e.requirement ?? {}) : (e.inventory ?? {})}
                onChange={(value) =>
                  change(entities.map((item, n) => (n === index ? { ...item, [e.kind === 'REQUIREMENT' ? 'requirement' : 'inventory']: value } : item)))
                }
              />
            )}
            {!done && <Button title="Remove draft record" variant="ghost" size="sm" onPress={() => change(entities.filter((_, n) => n !== index))} />}
          </View>
        ))}
      {!done && ready && (
        <>
          <Button
            title="Add property / unit"
            variant="secondary"
            onPress={() => change([...entities, { kind: 'INVENTORY', inventory: { availability: 'UNKNOWN', contacts: [] }, warnings: [] }])}
          />
          <Button
            title="Add requirement"
            variant="secondary"
            onPress={() =>
              change([...entities, { kind: 'REQUIREMENT', requirement: { localityNames: [], propertyTypes: [], bedrooms: [], status: 'OPEN' }, warnings: [] }])
            }
          />
          <Txt v="caption" color="muted">
            {status}
          </Txt>
          {error && <Txt color="danger">{error}</Txt>}
          <Button title="Save review" loading={busy} onPress={() => save()} />
          <Button
            title="Approve reviewed records"
            variant="secondary"
            loading={busy}
            disabled={!entities.some((e) => e.kind !== 'UNRELATED')}
            onPress={() => save(true)}
          />
          <Button title="Ignore unrelated source" variant="ghost" loading={busy} onPress={() => save(true, true)} />
        </>
      )}
    </View>
  );
}
