import { LegacyDraftRecovery } from '@/launch/legacy-draft-recovery';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SourceImage } from '@/launch/source-image';
import { WorkspaceHero, WorkspaceTag } from '@/launch/workspace';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { captureEntryTitle, capturePreviewFacts, type CapturedEntity } from '@brokeriq/shared';
import { assertAccountContext, captureAccountContext, api, API_URL, authStore, errorMessage } from '@/lib/api';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { ChoiceField } from '@/launch/form';
import { EntityFields, prepareEntity } from '@/launch/entity-fields';
import { editableDraft, decodeDraft, saveDraft, completeReviewDraft } from '@/launch/drafts';
import { Button, Txt, ErrorView, Chip } from '@/ui';
export default function ImportReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [openingPreview, setOpeningPreview] = useState(false);
  const [page, setPage] = useState(1);
  const [sourcePage, setSourcePage] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [error, setError] = useState('');
  const q = useQuery({
    queryKey: ['import', id, page, sourcePage, pendingOnly],
    queryFn: () => api<any>(`/imports/${id}?page=${page}${sourcePage ? `&sourcePage=${sourcePage}` : ''}${pendingOnly ? '&reviewState=NEEDS_REVIEW' : ''}`),
    refetchInterval: 5000,
  });
  useEffect(() => {
    if (q.data && page > Math.max(1, q.data.totalPages)) setPage(Math.max(1, q.data.totalPages));
  }, [q.data, page]);
  const previewOfImportId = q.data?.previewOfImportId as string | undefined;
  async function openPreview() {
    setOpeningPreview(true);
    setError('');
    try {
      const preview = await api<{ id: string }>(`/imports/${id}/preview`, { body: {} });
      router.push({ pathname: '/import-review/[id]', params: { id: preview.id } });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setOpeningPreview(false);
    }
  }
  return (
    <BrokerScreen title="Review capture" subtitle={q.data ? `${q.data.total} entries${previewOfImportId ? ' · Read-only preview' : ` · ${q.data.pending} need review`}` : 'Source saved, loading…'} back>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 50 }}>
        {previewOfImportId ? <NativeCard>
          <Txt>Review what the latest extraction found.</Txt>
          <Button title="Open original import" variant="secondary" onPress={() => router.replace({ pathname: '/import-review/[id]', params: { id: previewOfImportId } })} />
        </NativeCard> : <WorkspaceHero
          label="SOURCE REVIEW"
          title="Check every fact before saving."
          description="Originals stay preserved. Review extracted fields, add separate properties or requirements, then approve independent requirement records. Property offers require a separate conversion into Inventory."
        />}
        {q.data?.canPreview && <Button title="Preview latest extraction" variant="secondary" loading={openingPreview} onPress={openPreview} />}
        {q.data?.metadata?.requestedTarget && q.data.metadata.requestedTarget !== 'AUTO' && (
          <WorkspaceTag label={`Requested destination: ${q.data.metadata.requestedTarget === 'INVENTORY' ? 'Inventory' : 'Requirements'}`} />
        )}
        {!previewOfImportId && <View style={{ flexDirection: 'row', gap: 8 }}>
          {[true, false].map((pending) => (
            <Chip
              key={String(pending)}
              label={pending ? 'Pending only' : 'All entries'}
              active={pendingOnly === pending}
              onPress={() => {
                setPendingOnly(pending);
                setPage(1);
              }}
            />
          ))}
        </View>}
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
        {q.error && <ErrorView error={q.error} onRetry={() => q.refetch()} />}
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
        {q.data && !['PENDING', 'PROCESSING'].includes(q.data.status) && q.data.total === 0 && <Txt color="muted">No entries match this view.</Txt>}
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
      <Txt v="h3">{captureEntryTitle(entry.extracted ?? [])}</Txt>
      <Txt v="caption" color="muted">
        {entry.pageNo ? `Page ${entry.pageNo} · ` : ''}Source {entry.rowNo ?? ''} · {entry.reviewState}
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
  const [previewAttachment, setPreviewAttachment] = useState<number | null>(null);
  const qc = useQueryClient();
  const [entities, setEntities] = useState<any[]>(entry.extracted ?? []);
  const [version, setVersion] = useState(entry.updatedAt);
  const [ready, setReady] = useState(false);
  const [startSeparate, setStartSeparate] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const draftId = useRef(Crypto.randomUUID());
  const owner = useRef(captureAccountContext());
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const done = entry.reviewState !== 'NEEDS_REVIEW';
  useEffect(() => {
    if (entry.reviewState === 'PREVIEW') { setReady(true); return; }
    let active = true;
    (async () => {
      try {
        const row = await editableDraft('IMPORT_REVIEW', entry.id, owner.current, startSeparate);
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
  }, [entry.id, entry.reviewState, startSeparate]);
  function change(next: any[]) {
    setEntities(next);
    setStatus('Saving draft…');
    writes.current = writes.current
      .catch(() => undefined)
      .then(() =>
        saveDraft('IMPORT_REVIEW', entry.id, { batchId, entryId: entry.id, entities: next, expectedUpdatedAt: version }, draftId.current, owner.current),
      )
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
      await saveDraft('IMPORT_REVIEW', entry.id, { batchId, entryId: entry.id, entities: next, expectedUpdatedAt: version }, draftId.current, owner.current);
      const response = await api<any>(`/imports/entries/${entry.id}${approve ? '/approve' : ''}`, {
        method: approve ? 'POST' : 'PATCH',
        ownerContext: owner.current,
        body: { entities: next, ignore, expectedUpdatedAt: version },
      });
      if (response.updatedAt) {
        setVersion(response.updatedAt);
        await saveDraft(
          'IMPORT_REVIEW',
          entry.id,
          { batchId, entryId: entry.id, entities: next, expectedUpdatedAt: response.updatedAt },
          draftId.current,
          owner.current,
        );
      }
      if (approve || ignore) await completeReviewDraft(draftId.current, entry.id, owner.current);
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
        <SourceImage
          uri={`${API_URL}/imports/${batchId}/source?${entry.pageNo ? `pageNo=${entry.pageNo}&` : ''}entryId=${entry.id}`}
          token={authStore.get()?.accessToken}
        />
      )}
      {entry.ocr?.attachments?.map((attachment: { index: number; name: string; contentType: string; available: boolean; text?: string; warning?: string }) => (
        <View key={attachment.index} style={{ gap: 8 }}>
          <Txt v="caption">{attachment.name}</Txt>
          {attachment.available && attachment.contentType.startsWith('image/') && (
            <>
              <Button title={previewAttachment === attachment.index ? 'Hide photo' : 'Preview photo'} size="sm" variant="secondary"
                onPress={() => setPreviewAttachment((active) => active === attachment.index ? null : attachment.index)} />
              {previewAttachment === attachment.index && (
                <SourceImage uri={`${API_URL}/imports/${batchId}/entries/${entry.id}/attachments/${attachment.index}`} token={authStore.get()?.accessToken} />
              )}
            </>
          )}
          {attachment.available && attachment.contentType.startsWith('video/') && (
            <SourceVideo path={`/imports/${batchId}/entries/${entry.id}/attachments/${attachment.index}`} contentType={attachment.contentType} />
          )}
          {attachment.warning && <Txt v="caption" color="muted">{attachment.warning}</Txt>}
          {attachment.text && <Txt v="caption" selectable>{attachment.text}</Txt>}
        </View>
      ))}
      {entry.ocr?.attachmentWarnings?.map((warning: string) => <Txt key={warning} v="caption" color="muted">{warning}</Txt>)}
      {ready &&
        entities.map((e, index) => (
          <View key={index} style={{ gap: 12 }}>
            <Txt v="h3">
              {e.kind === 'INVENTORY' ? 'Property offer' : e.kind === 'REQUIREMENT' ? 'Requirement / review record' : 'Unclassified source'} · {index + 1}
            </Txt>
            {e.warnings?.map((warning: string, i: number) => (
              <Txt key={i} v="small" color="warning">
                {warning}
              </Txt>
            ))}
            {entry.reviewState === 'PREVIEW' && capturePreviewFacts(e).map(({ label, value }) => (
              <Txt key={label} v="small" selectable>{label} · {value}</Txt>
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
              change([
                ...entities,
                { kind: 'REQUIREMENT', requirement: { intent: 'DEMAND', localityNames: [], propertyTypes: [], bedrooms: [], status: 'OPEN' }, warnings: [] },
              ])
            }
          />
          <Txt v="caption" color="muted">
            {status}
          </Txt>
          <LegacyDraftRecovery
            error={error}
            onStart={() => {
              setError('');
              setStartSeparate(true);
            }}
          />
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

const videoExtensions: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
};

function SourceVideo({ path, contentType }: { path: string; contentType: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const extension = videoExtensions[contentType];
  if (!extension) return null;

  async function open() {
    const context = captureAccountContext();
    let file: File | undefined;
    setBusy(true);
    setError('');
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('No app is available to open this video.');
      const bytes = await api<Uint8Array>(path, { responseType: 'bytes', ownerContext: context });
      assertAccountContext(context);
      file = new File(Paths.cache, `brokeriq-source-${Crypto.randomUUID()}.${extension}`);
      file.create();
      file.write(bytes);
      await Sharing.shareAsync(file.uri, { mimeType: contentType, dialogTitle: 'Open source video' });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      if (file?.exists) file.delete();
      setBusy(false);
    }
  }

  return (
    <>
      <Button title="Open source video" size="sm" variant="secondary" loading={busy} onPress={open} />
      {!!error && <Txt v="caption" color="muted">{error}</Txt>}
    </>
  );
}
