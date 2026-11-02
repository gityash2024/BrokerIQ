import { LegacyDraftRecovery } from '@/launch/legacy-draft-recovery';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { offeredRequirement, brokerRequirementSchema, inventoryInputSchema } from '@brokeriq/shared';
import { BrokerScreen } from '@/launch/screen';
import { EntityFields, prepareEntity } from '@/launch/entity-fields';
import { editableDraft, getLocalDraft, decodeDraft, saveDraft, queueDraft, syncDrafts } from '@/launch/drafts';
import { useAuth } from '@/lib/auth';
import { captureAccountContext, api, errorMessage } from '@/lib/api';
import { Button, Txt } from '@/ui';
export default function RequirementEditor() {
  const { draft, leadId, id: recordId } = useLocalSearchParams<{ draft?: string; leadId?: string; id?: string }>();
  const kind = recordId ? 'REQUIREMENT_EDIT' : 'REQUIREMENT_CREATE';
  const key = recordId || leadId || 'new-requirement';
  const { user } = useAuth();
  const id = useRef(Crypto.randomUUID());
  const owner = useRef(captureAccountContext());
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const [value, setValue] = useState<any>({ leadId: leadId ?? null, localityNames: [], propertyTypes: [], bedrooms: [], status: 'OPEN' });
  const [ready, setReady] = useState(false);
  const [startSeparate, setStartSeparate] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const row = draft ? await getLocalDraft(draft, owner.current) : await editableDraft(kind, key, owner.current, startSeparate);
        if (draft && (!row || row.kind !== kind || row.draft_key !== key || !['DRAFT', 'FAILED'].includes(row.state)))
          throw new Error('This draft cannot be edited here; its data is preserved');
        if (row) {
          id.current = row.id;
          if (active) setValue(decodeDraft(row));
        } else if (recordId) {
          const current = await api<any>(`/broker-requirements/${recordId}`, { ownerContext: owner.current });
          if (active) setValue({ ...current, expectedRevision: current.revision });
        }
        if (active) setReady(true);
      } catch (e) {
        if (active) setError(errorMessage(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [draft, kind, key, recordId, startSeparate]);
  function change(next: any) {
    setValue(next);
    setStatus('Saving draft…');
    writes.current = writes.current
      .catch(() => undefined)
      .then(() => saveDraft(kind, key, next, id.current, owner.current))
      .then(() => setStatus('Draft saved on this device'))
      .catch((e) => {
        setError(errorMessage(e));
      });
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const intent = value.intent || 'DEMAND';
      const fields =
        intent === 'OFFER'
          ? { ...offeredRequirement(inventoryInputSchema.parse(prepareEntity(value.offerDetails || {}, false))), leadId: value.leadId }
          : intent === 'UNKNOWN'
            ? brokerRequirementSchema.parse({ intent: 'UNKNOWN', title: value.title, notes: value.notes })
            : prepareEntity({ ...value, intent: 'DEMAND', offerDetails: null }, true);
      const parsed: any = { ...fields, ...(recordId ? { id: recordId, expectedRevision: value.expectedRevision ?? value.revision } : {}) };
      if (intent === 'DEMAND' && (!parsed.purpose || !parsed.localityNames.length)) throw new Error('Purpose and preferred locality required');
      await writes.current;
      await saveDraft(kind, key, parsed, id.current, owner.current);
      await queueDraft(id.current, owner.current);
      await syncDrafts();
      router.replace('/drafts');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <BrokerScreen title={recordId ? 'Review requirement' : 'Add requirement'} subtitle="Independent source records; conversion is a separate review." back>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 15, paddingBottom: 40 }}>
          <Txt v="caption" color="muted">
            {status}
          </Txt>
          {ready && <EntityFields value={value} requirement onChange={change} />}
          <LegacyDraftRecovery
            error={error}
            onStart={() => {
              setError('');
              setStartSeparate(true);
            }}
          />
          {error && <Txt color="danger">{error}</Txt>}
        </ScrollView>
        <View style={{ padding: 16 }}>
          <Button title="Save requirement" disabled={!ready} loading={busy} onPress={save} />
        </View>
      </KeyboardAvoidingView>
    </BrokerScreen>
  );
}
