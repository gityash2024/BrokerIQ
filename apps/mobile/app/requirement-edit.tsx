import { useEffect, useRef, useState } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { BrokerScreen } from '@/launch/screen';
import { EntityFields, prepareEntity } from '@/launch/entity-fields';
import { editableDraft, getLocalDraft, decodeDraft, saveDraft, queueDraft, syncDrafts } from '@/launch/drafts';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { Button, Txt } from '@/ui';
export default function RequirementEditor() {
  const { draft, leadId } = useLocalSearchParams<{ draft?: string; leadId?: string }>();
  const { user } = useAuth();
  const id = useRef(Crypto.randomUUID());
  const owner = useRef(user!.id);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const [value, setValue] = useState<any>({ leadId: leadId ?? null, localityNames: [], propertyTypes: [], bedrooms: [], status: 'OPEN' });
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const row = draft ? await getLocalDraft(draft) : await editableDraft('REQUIREMENT_CREATE', leadId ?? 'new-requirement');
        if (row) {
          id.current = row.id;
          if (active) setValue(decodeDraft(row));
        }
        if (active) setReady(true);
      } catch (e) {
        if (active) setError(errorMessage(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [draft, leadId]);
  function change(next: any) {
    setValue(next);
    setStatus('Saving draft…');
    writes.current = writes.current
      .catch(() => undefined)
      .then(() => saveDraft('REQUIREMENT_CREATE', leadId ?? 'new-requirement', next, id.current, owner.current))
      .then(() => setStatus('Draft saved on this device'))
      .catch((e) => {
        setError(errorMessage(e));
      });
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const parsed: any = prepareEntity(value, true);
      if (!parsed.purpose || !parsed.localityNames.length) throw new Error('Purpose and preferred locality required');
      await writes.current;
      await saveDraft('REQUIREMENT_CREATE', leadId ?? 'new-requirement', parsed, id.current, owner.current);
      await queueDraft(id.current);
      await syncDrafts();
      router.replace('/drafts');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <BrokerScreen title="Add requirement" subtitle="Each requirement is saved separately." back>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 15, paddingBottom: 40 }}>
          <Txt v="caption" color="muted">
            {status}
          </Txt>
          {ready && <EntityFields value={value} requirement onChange={change} />}
          {error && <Txt color="danger">{error}</Txt>}
        </ScrollView>
        <View style={{ padding: 16 }}>
          <Button title="Save requirement" disabled={!ready} loading={busy} onPress={save} />
        </View>
      </KeyboardAvoidingView>
    </BrokerScreen>
  );
}
