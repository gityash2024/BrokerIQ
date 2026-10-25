import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES, inventoryInputSchema, prepareInventoryEditorInput, preparePropertyDetails } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Txt, Input, Button } from '@/ui';
import { toast } from '@/lib/toast';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { NativePropertyExtras } from '@/launch/property-extras';
import { ChoiceField } from '@/launch/form';
import { editableDraft, getLocalDraft, decodeDraft, saveDraft, queueDraft, syncDrafts } from '@/launch/drafts';
import { useQueryClient } from '@tanstack/react-query';
const numeric = ['bhk', 'area', 'monthlyRent', 'totalSalePrice', 'ratePerArea', 'securityDeposit'];
export default function InventoryEditor() {
  const { id, draft: requestedDraft } = useLocalSearchParams<{ id?: string; draft?: string }>();
  const { user } = useAuth();
  const { c } = useTheme();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({ availability: 'UNKNOWN', status: 'DRAFT', contacts: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const draftId = useRef(Crypto.randomUUID());
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const owner = useRef(user?.id ?? 'UNASSIGNED');
  const kind = id ? 'PROPERTY_EDIT' : 'PROPERTY_CREATE';
  const key = id ?? 'new-property';
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const draft = requestedDraft ? await getLocalDraft(requestedDraft) : await editableDraft(kind, key);
        if (requestedDraft && (!draft || draft.kind !== kind || draft.draft_key !== key || !['DRAFT', 'FAILED'].includes(draft.state)))
          throw new Error('This draft cannot be edited in its current state. Its data is preserved.');
        let initial: any;
        if (draft) {
          initial = decodeDraft(draft);
          draftId.current = draft.id;
        } else initial = id ? await api<any>(`/inventory/${id}`) : { availability: 'UNKNOWN', status: 'DRAFT', contacts: [] };
        if (active) {
          setForm({ ...initial, ...(id ? { id, expectedRevision: initial.expectedRevision ?? initial.revision } : {}) });
          setReady(true);
          setDraftStatus(draft ? 'Draft restored' : '');
        }
      } catch (e) {
        if (active) setError(errorMessage(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [id, kind, key, requestedDraft]);
  function persist(next: Record<string, any>) {
    setDraftStatus('Saving draft…');
    writes.current = writes.current
      .catch(() => undefined)
      .then(() => saveDraft(kind, key, next, draftId.current, owner.current))
      .then(() => setDraftStatus('Draft saved on this device'))
      .catch((e) => {
        setError(errorMessage(e));
        throw e;
      });
    void writes.current.catch(() => undefined);
  }
  function change(name: string, value: any) {
    const next = { ...form, ...(name === 'purpose' && value === 'SALE' ? { rent: null, monthlyRent: null } : {}), [name]: value };
    setForm(next);
    if (ready) persist(next);
  }
  async function save() {
    setSaving(true);
    setError('');
    Keyboard.dismiss();
    try {
      const input: any = prepareInventoryEditorInput(form);
      for (const field of numeric) input[field] = input[field] === '' || input[field] == null ? null : Number(input[field]);
      input.details = preparePropertyDetails(input.details);
      const checked = inventoryInputSchema.safeParse(input);
      if (!checked.success) throw new Error(checked.error.issues[0].message);
      if (!checked.data.sector && !checked.data.address) throw new Error('Sector/locality or address required');
      await writes.current.catch(() => undefined);
      await saveDraft(kind, key, { ...checked.data, ...(id ? { id } : {}) }, draftId.current, owner.current);
      await queueDraft(draftId.current);
      toast.success('Saved locally. Sync status is shown in Saved drafts.');
      await syncDrafts();
      await Promise.all(['ledger', 'ledger-stats', 'local-drafts'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  const field = (name: string, label: string, multiline = false) => (
    <Input
      key={name}
      label={label}
      value={form[name] == null ? '' : String(form[name])}
      onChangeText={(value) => change(name, value)}
      editable={ready && !saving}
      keyboardType={numeric.includes(name) ? 'decimal-pad' : 'default'}
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      style={multiline ? { minHeight: 90 } : undefined}
    />
  );
  return (
    <BrokerScreen title={id ? 'Edit property' : 'Add property'} subtitle="Missing fields can stay unknown." back>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 14, paddingBottom: 30 }}>
          <Txt v="caption" color="muted">
            {draftStatus}
          </Txt>
          <NativeCard style={{ gap: 14 }}>
          <Txt v="h3">Location</Txt>
          {field('sector', 'Sector / locality')}
          {field('houseNo', 'House / plot no.')}
          {field('unitLabel', 'Unit')}
          {field('address', 'Address')}
          {field('floor', 'Floor')}
          </NativeCard>
          <NativeCard style={{ gap: 14 }}>
          <Txt v="h3">Property details</Txt>
          <ChoiceField label="Purpose" value={form.purpose} choices={['RENT', 'SALE']} onChange={(v) => change('purpose', v)} />
          <ChoiceField label="Category" value={form.category} choices={['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'LAND']} onChange={(v) => change('category', v)} />
          <ChoiceField label="Property type" value={form.propertyType} choices={PROPERTY_TYPES} onChange={(v) => change('propertyType', v)} />
          <ChoiceField label="Room kind" value={form.roomKind} choices={['BHK', 'RK', 'STUDIO']} onChange={(v) => change('roomKind', v)} />
          {field('bhk', 'Rooms')}
          <ChoiceField
            label="Furnishing"
            value={form.furnishing}
            choices={['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']}
            onChange={(v) => change('furnishing', v)}
          />
          </NativeCard>
          <NativeCard style={{ gap: 14 }}>
          <Txt v="h3">Price & area</Txt>
          {form.purpose === 'RENT' ? (
            <>
              {field('monthlyRent', 'Monthly rent ₹')}
              {field('securityDeposit', 'Deposit ₹')}
            </>
          ) : (
            <>
              {field('totalSalePrice', 'Total sale price ₹')}
              {field('ratePerArea', 'Rate per area ₹')}
              <ChoiceField
                label="Rate unit"
                value={form.rateAreaUnit}
                choices={['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE']}
                onChange={(v) => change('rateAreaUnit', v)}
              />
            </>
          )}
          {field('area', 'Area')}
          <ChoiceField
            label="Area unit"
            value={form.areaUnit}
            choices={['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE']}
            onChange={(v) => change('areaUnit', v)}
          />
          <ChoiceField
            label="Availability"
            value={form.availability}
            choices={['UNKNOWN', 'AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE']}
            onChange={(v) => change('availability', v ?? 'UNKNOWN')}
          />
          </NativeCard>
          <NativeCard style={{ gap: 14 }}>
          <Txt v="h3">Contacts</Txt>
          {(form.contacts ?? []).map((contact: any, index: number) => (
            <View key={index} style={{ gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.line }}>
              <Input
                label="Contact name"
                value={contact.name ?? ''}
                onChangeText={(name) =>
                  change(
                    'contacts',
                    form.contacts.map((item: any, i: number) => (i === index ? { ...item, name } : item)),
                  )
                }
              />
              <Input
                label="Phone"
                keyboardType="phone-pad"
                value={contact.phone ?? ''}
                onChangeText={(phone) =>
                  change(
                    'contacts',
                    form.contacts.map((item: any, i: number) => (i === index ? { ...item, phone } : item)),
                  )
                }
              />
              <ChoiceField
                label="Contact role"
                value={contact.role}
                choices={['UNKNOWN', 'OWNER', 'BROKER']}
                onChange={(role) =>
                  change(
                    'contacts',
                    form.contacts.map((item: any, i: number) => (i === index ? { ...item, role: role ?? 'UNKNOWN' } : item)),
                  )
                }
              />
              <Button
                title="Remove contact"
                variant="ghost"
                size="sm"
                onPress={() =>
                  change(
                    'contacts',
                    form.contacts.filter((_: any, i: number) => i !== index),
                  )
                }
              />
            </View>
          ))}
          <Button
            title="Add contact"
            variant="secondary"
            onPress={() => change('contacts', [...(form.contacts ?? []), { name: '', phone: '', role: 'UNKNOWN' }])}
          />
          </NativeCard>
          <NativePropertyExtras
            value={form}
            onChange={(next) => {
              setForm(next);
              persist(next);
            }}
          />
          {field('notes', 'Notes', true)}
          {error && <Txt color="danger">{error}</Txt>}
        </ScrollView>
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface }}>
          <Button title="Save property" loading={saving} disabled={!ready} onPress={save} />
        </View>
      </KeyboardAvoidingView>
    </BrokerScreen>
  );
}
