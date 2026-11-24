import { LegacyDraftRecovery } from '@/launch/legacy-draft-recovery';
import { NativeInventoryFolderControls, useInventoryFolderDefinitions } from '@/launch/inventory-folder-controls';
import { useEffect, useRef, useState } from 'react';
import { View, Keyboard, Linking, Switch } from 'react-native';
import { ScrollView } from '@/components/keyboard-scroll-view';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import {
  INVENTORY_PROPERTY_TYPES as PROPERTY_TYPES,
  inventoryInputSchema,
  prepareInventoryEditorInput,
  inventoryEditorPatch,
  inventoryNavigation,
  inventoryMonth,
  inventoryMonthSchema,
  inventoryFolderDefaults,
  missingInventoryFolderFields,
  isPendingSurvey,
  surveySectors,
  ownerCreatePropertySchema,
  ownerEditPropertySchema,
  ownerPropertyValues,
  inventoryUnitBatchSchema,
  inventoryUnitConfiguration,
  inventoryUnitConfigurationFields,
  inventoryUnitLimit,
  surveyConfigurationChoices,
  type UnitConfiguration,
} from '@brokeriq/shared';
import { captureAccountContext, api, errorMessage } from '@/lib/api';
import { hasDelegatedAccess } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Txt, Input, Button, Row, Screen, Header } from '@/ui';
import { toast } from '@/lib/toast';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { NativePropertyExtras } from '@/launch/property-extras';
import { NativePropertyMedia } from '@/launch/property-media';
import { PropertyDateField } from '@/launch/property-date-field';
import { ChoiceField } from '@/launch/form';
import { SurveyContactFields } from '@/launch/survey-contact-fields';
import { SurveyLocationField } from '@/launch/survey-location-field';
import { InventoryUnitFields, type InventoryUnitDraft } from '@/launch/inventory-unit-fields';
import { editableDraft, getLocalDraft, decodeDraft, saveDraft, queueDraft, syncDrafts } from '@/launch/drafts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
const numeric = ['bhk', 'area', 'monthlyRent', 'totalSalePrice', 'ratePerArea', 'securityDeposit'];
export default function InventoryEditor() {
  return <InventoryEditorForm />;
}

export function InventoryEditorForm({ ownerMode = false }: { ownerMode?: boolean }) {
  const {
    id,
    draft: requestedDraft,
    makeAvailable,
    makeRented,
    directoryMonth,
    folderRoom,
    furnishing,
    survey,
    sector: surveySector,
    customFolderId,
  } = useLocalSearchParams<{
    id?: string;
    draft?: string;
    makeAvailable?: string;
    makeRented?: string;
    directoryMonth?: string;
    folderRoom?: string;
    furnishing?: string;
    survey?: string;
    sector?: string;
    customFolderId?: string;
  }>();
  const defaultFolder = inventoryMonthSchema.safeParse(directoryMonth);
  const selectedMonth = defaultFolder.success ? defaultFolder.data : inventoryMonth();
  const markRented = !ownerMode && Boolean(id && makeRented === '1');
  const availabilityReview = !ownerMode && Boolean(id && makeAvailable === '1' && !markRented);
  const createSurvey = !ownerMode && !id && survey === '1';
  const directoryEnabled = !ownerMode && !createSurvey && (makeAvailable === '1' || (!id && !requestedDraft));
  const { user } = useAuth();
  const { c } = useTheme();
  const qc = useQueryClient();
  const delegated = user?.role === 'SUB_BROKER_ADMIN';
  const canAssign = user?.role === 'BROKER_ADMIN' || (delegated && hasDelegatedAccess(user, 'inventory', 'assign'));
  const team = useQuery({
    queryKey: ['broker-team', 'inventory-assignees', user?.id],
    queryFn: () => api<any>(delegated ? '/inventory/assignees' : '/broker/team'),
    enabled: canAssign,
  });
  const [form, setForm] = useState<Record<string, any>>({
    availability: 'UNKNOWN',
    status: 'DRAFT',
    contacts: [],
    ...(!delegated || canAssign ? { assignedToId: user?.id } : {}),
  });
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [contactOptions, setContactOptions] = useState(false);
  const [ready, setReady] = useState(false);
  const [startSeparate, setStartSeparate] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [unitUploading, setUnitUploading] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [readingLocation, setReadingLocation] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const draftId = useRef(Crypto.randomUUID());
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const owner = useRef(captureAccountContext());
  const baseline = useRef<Record<string, any> | null>(null);
  const kind = ownerMode ? (id ? 'OWNER_PROPERTY_EDIT' : 'OWNER_PROPERTY_CREATE') : id ? 'PROPERTY_EDIT' : 'PROPERTY_CREATE';
  const key = id ?? ((createSurvey ? 'new-survey:' + (surveySector?.trim() ?? '') : 'new-property') + (customFolderId ? ':' + customFolderId : ''));
  const compactSurvey = !ownerMode && (createSurvey || Boolean(id && !availabilityReview && form.sourceType === 'SURVEY' && form.status === 'DRAFT'));
  const allowUnits = !ownerMode && !id && !compactSurvey;
  const units: InventoryUnitDraft[] = allowUnits ? (form._additionalUnits ?? []) : [];
  const configuration = inventoryUnitConfiguration(form);
  const customConfiguration = form._customConfiguration ?? (!configuration && !!form.roomKind);
  const formRef = useRef(form);
  formRef.current = form;
  const localities = useQuery({
    queryKey: ['localities-all'],
    queryFn: () => api<{ name: string }[]>('/public/localities', { auth: false }),
    enabled: compactSurvey,
    staleTime: 600_000,
  });
  const folders = useInventoryFolderDefinitions(!ownerMode);
  const customFolders = (folders.data ?? []).filter(({ kind }) => kind === 'CUSTOM');
  const savedSectors = (folders.data ?? []).filter(({ kind }) => kind === 'SECTOR').map(({ label }) => label);
  const photoUrls = useRef<string[]>([]);
  photoUrls.current = form.photoUrls ?? [];
  const navigation = inventoryNavigation(form);
  const changeDetail = (name: string, value: string | null) => change('details', { ...form.details, [name]: value });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const draft = requestedDraft ? await getLocalDraft(requestedDraft, owner.current) : await editableDraft(kind, key, owner.current, startSeparate);
        if (requestedDraft && (!draft || draft.kind !== kind || draft.draft_key !== key || !['DRAFT', 'FAILED'].includes(draft.state)))
          throw new Error('This draft cannot be edited in its current state. Its data is preserved.');
        let initial: any;
        if (draft) {
          initial = decodeDraft(draft);
          draftId.current = draft.id;
        } else
          initial = id
            ? await api<any>(`${ownerMode ? '/owner/properties' : '/inventory'}/${encodeURIComponent(id)}`, { ownerContext: owner.current })
            : {
                availability: 'UNKNOWN',
                status: 'DRAFT',
                contacts: [{ name: '', phone: '', role: 'OWNER' }],
                ...(!delegated || canAssign ? { assignedToId: user?.id } : {}),
                ...(createSurvey ? { survey: true, purpose: 'RENT' } : {}),
                ...(!ownerMode && surveySector ? { sector: surveySector.trim() } : {}),
                ...(!ownerMode && customFolderId ? { customFolderId } : {}),
                ...(directoryEnabled || ownerMode ? { purpose: 'RENT', ...inventoryFolderDefaults(folderRoom, furnishing) } : {}),
              };
        if (id && initial.canEdit === false) throw new Error('This property is read-only. Open its details to request access.');
        if (active) {
          baseline.current = initial._editorBaseline ?? (!draft && id ? initial : null);
          setForm({
            ...initial,
            ...(ownerMode && initial.pendingChanges?.changes
              ? {
                  ...initial.pendingChanges.changes,
                  details: { ...initial.details, ...initial.pendingChanges.changes.details },
                }
              : {}),
            ...(initial.availability !== 'AVAILABLE' && !draft ? { availableSince: null } : {}),
            monthlyRent:
              ownerMode && initial.pendingChanges?.changes?.monthlyRent !== undefined
                ? initial.pendingChanges.changes.monthlyRent
                : (initial.monthlyRent ?? (initial.purpose === 'RENT' ? initial.rent : undefined)),
            ...(id ? { id, expectedRevision: initial.expectedRevision ?? initial.revision } : {}),
            ...(directoryEnabled
              ? {
                  directoryMonth: (draft || initial.availability === 'AVAILABLE') && initial.directoryMonth ? initial.directoryMonth : selectedMonth,
                  _activateInDirectory: availabilityReview || (initial._activateInDirectory ?? true),
                }
              : {}),
          });
          setReady(true);
          setDraftStatus(draft ? 'Draft restored' : ownerMode && initial.pendingChanges ? 'Editing the changes you sent for review' : '');
        }
      } catch (e) {
        if (active) setError(errorMessage(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [
    id,
    kind,
    key,
    requestedDraft,
    user?.id,
    startSeparate,
    directoryEnabled,
    availabilityReview,
    folderRoom,
    furnishing,
    selectedMonth,
    createSurvey,
    surveySector,
    ownerMode,
  ]);
  function persist(next: Record<string, any>) {
    setDraftStatus('Saving draft…');
    writes.current = writes.current
      .catch(() => undefined)
      .then(() => saveDraft(kind, key, { ...next, ...(baseline.current ? { _editorBaseline: baseline.current } : {}) }, draftId.current, owner.current))
      .then(() => setDraftStatus('Draft saved on this device'))
      .catch((e) => {
        setError(errorMessage(e));
        throw e;
      });
    void writes.current.catch(() => undefined);
  }
  function change(name: string, value: any) {
    applyChanges({ ...(name === 'purpose' && value === 'SALE' ? { rent: null, monthlyRent: null } : {}), [name]: value });
  }
  function applyChanges(patch: Record<string, unknown>) {
    const next = { ...formRef.current, ...patch };
    formRef.current = next;
    setForm(next);
    if (ready) persist(next);
  }
  async function save() {
    if (!ready || saving || uploading || unitUploading !== null || readingLocation) return;
    setSaving(true);
    setError('');
    Keyboard.dismiss();
    try {
      const effective = { ...form };
      if (createSurvey && Number(form.bhk) > 0) Object.assign(effective, { roomKind: 'BHK', category: 'RESIDENTIAL' });
      if (baseline.current?.availability === 'AVAILABLE' || markRented || (!form._activateInDirectory && form.availability !== 'AVAILABLE'))
        delete effective.availableSince;
      if (!id || (compactSurvey && Array.isArray(form.contacts)))
        effective.contacts = (form.contacts ?? []).filter((contact: any) => contact.name?.trim() || contact.phone?.trim() || contact.note?.trim());
      if (!markRented && form._activateInDirectory) {
        if (!inventoryMonthSchema.safeParse(form.directoryMonth).success) throw new Error('Choose the year and month for this property.');
        const missing = missingInventoryFolderFields(effective);
        if (missing.length) {
          setAdditionalOpen(true);
          throw new Error('Fill these fields to make the property Available: ' + missing.join(', '));
        }
      } else {
        delete effective.directoryMonth;
      }
      const input = id && baseline.current ? inventoryEditorPatch(effective, baseline.current) : prepareInventoryEditorInput(effective);
      if (!markRented && form._activateInDirectory) input.directoryMonth = form.directoryMonth;
      if (markRented) {
        const missing = missingInventoryFolderFields(effective);
        if (missing.length && !isPendingSurvey({ status: form.status, sourceType: form.sourceType }))
          throw new Error('Fill these fields to mark the property Rented out: ' + missing.join(', '));
        input.availability = 'RENTED';
        input.status = 'RENTED';
      }
      if (ownerMode) {
        const parsed = id
          ? ownerEditPropertySchema.safeParse({
              clientMutationId: draftId.current,
              expectedRevision: form.expectedRevision,
              changes: ownerPropertyValues(input),
            })
          : ownerCreatePropertySchema.safeParse({ ...ownerPropertyValues(input), clientMutationId: draftId.current });
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
        // Persist the complete editor, including its baseline, for validation retries after a failed sync.
        await writes.current.catch(() => undefined);
        await saveDraft(kind, key, { ...form, _editorBaseline: baseline.current, _ownerSubmission: parsed.data }, draftId.current, owner.current);
        await queueDraft(draftId.current, owner.current);
        await syncDrafts();
        const saved = await getLocalDraft(draftId.current, owner.current);
        if (saved?.state === 'FAILED') throw new Error(saved.error ?? 'Save failed. Your draft is saved on this device.');
        toast.success(saved?.state === 'SYNCED' ? 'Sent to your broker' : 'Saved on this device. Sync will resume when connected.');
        await qc.invalidateQueries({ queryKey: ['owner-properties'] });
        router.back();
        return;
      }
      const checked = inventoryInputSchema.safeParse(input);
      if (!checked.success) {
        const issue = checked.error.issues[0];
        throw new Error(`${issue.path.join('.') || 'Property'}: ${issue.message}`);
      }
      if (!id && !checked.data.sector && !checked.data.address) throw new Error('Sector/locality or address required');
      const batch = units.length
        ? inventoryUnitBatchSchema.safeParse({
            property: checked.data,
            units: units.map(({ configuration, ...fields }) => ({ ...prepareInventoryEditorInput(fields), configuration })),
            clientMutationId: draftId.current,
          })
        : null;
      if (batch && !batch.success) throw new Error(batch.error.issues[0].message);
      await writes.current.catch(() => undefined);
      await saveDraft(
        kind,
        key,
        { ...checked.data, ...(id ? { id } : {}), ...(batch ? { _additionalUnits: batch.data.units } : {}) },
        draftId.current,
        owner.current,
      );
      await queueDraft(draftId.current, owner.current);
      await syncDrafts();
      const saved = await getLocalDraft(draftId.current, owner.current);
      if (saved?.state === 'FAILED') throw new Error(saved.error ?? 'Save failed. Your changes remain in Saved drafts.');
      toast.success(saved?.state === 'SYNCED' ? 'Property saved' : 'Saved on this device. Sync will resume when connected.');
      await Promise.all(
        [
          'ledger',
          'ledger-item',
          'ledger-stats',
          'inventory-folders',
          'inventory-folder-items',
          'broker-today',
          'agent-assignments',
          'agent-assignment-records',
          'local-drafts',
        ].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      );
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  const field = (name: string, label: string, multiline = false, paired = false) => (
    <Input
      key={name}
      label={label}
      containerStyle={paired ? { flex: 1 } : undefined}
      value={form[name] == null ? '' : String(form[name])}
      onChangeText={(value) => change(name, value)}
      editable={ready && !saving}
      keyboardType={numeric.includes(name) ? 'decimal-pad' : 'default'}
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      style={multiline ? { minHeight: 90 } : undefined}
    />
  );
  const Shell = ownerMode ? OwnerEditorScreen : BrokerScreen;
  return (
    <Shell
      title={availabilityReview ? 'Review property availability' : id ? 'Edit property' : createSurvey ? 'Add survey property' : 'Add property'}
      subtitle={availabilityReview ? 'Review the saved details before making this property available.' : 'Missing fields can stay unknown.'}
      back
    >
      <View style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, paddingTop: 0, gap: 8, paddingBottom: 16 }}>
          {!!draftStatus && (
            <Txt v="caption" color="muted">
              {draftStatus}
            </Txt>
          )}
          {markRented && <Txt color="muted">Check the property details. Saving as rented out withdraws its public listing.</Txt>}
          <NativeCard>
            <PropertyDateField label="Possession date" value={form.details?.possessionDate} onChange={(date) => changeDetail('possessionDate', date)} />
          </NativeCard>
          {!ownerMode && <NativeCard>
            <ChoiceField label="Custom folder" value={form.customFolderId} choices={customFolders.map(({ id }) => id)}
              labels={Object.fromEntries(customFolders.map(({ id, label }) => [id, label]))} emptyLabel="None" onChange={(value) => change('customFolderId', value)} />
            <NativeInventoryFolderControls onCreated={(folder) => change(folder.kind === 'CUSTOM' ? 'customFolderId' : 'sector', folder.kind === 'CUSTOM' ? folder.id : folder.label)} />
          </NativeCard>}
          {compactSurvey ? (
            <NativeCard style={{ gap: 10 }}>
              <Row align="flex-start">
                <ChoiceField
                  paired
                  label="Sector / locality"
                  value={form.sector}
                  access={ready && !saving}
                  choices={surveySectors([...(form.sector ? [String(form.sector)] : []), ...savedSectors, ...(localities.data ?? []).map((item) => item.name)])}
                  onChange={(value) => change('sector', value)}
                />
                {field('houseNo', 'House / plot no.', false, true)}
              </Row>
              {localities.isError && <Button title="Retry sectors" size="sm" variant="ghost" onPress={() => void localities.refetch()} />}
              <SurveyLocationField
                value={form.directionsUrl}
                onChange={(link) => change('directionsUrl', link)}
                disabled={!ready || saving}
                onReading={setReadingLocation}
              />
              <SurveyContactFields
                contacts={form.contacts ?? (form.ownerPhone ? [{ name: form.ownerName, phone: form.ownerPhone, role: 'OWNER' }] : [])}
                onChange={(contacts) => change('contacts', contacts)}
                disabled={!ready || saving}
              />
              <Row align="flex-start">
                {field('bhk', 'Bedrooms', false, true)}
                {field('floor', 'Floor', false, true)}
              </Row>
              <ChoiceField
                label="Furnishing"
                value={form.furnishing}
                choices={['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']}
                onChange={(value) => change('furnishing', value)}
              />
              <ChoiceField
                label="Food preference"
                value={form.details?.foodPreference}
                choices={['VEGETARIAN_ONLY', 'NO_RESTRICTION']}
                onChange={(value) => changeDetail('foodPreference', value)}
              />
              <ChoiceField
                label="Pets allowed"
                value={form.details?.petFriendly == null ? null : String(form.details.petFriendly)}
                choices={['true', 'false']}
                labels={{ true: 'Allowed', false: 'Not allowed' }}
                onChange={(value) => change('details', { ...form.details, petFriendly: value == null ? null : value === 'true' })}
              />
              <NativePropertyMedia
                photos={form.photoUrls ?? []}
                onlyPhotos
                camera
                disabled={!ready || saving || !form.sector?.trim()}
                onUploading={setUploading}
                onAdd={(_, url) => {
                  photoUrls.current = [...photoUrls.current, url];
                  change('photoUrls', photoUrls.current);
                }}
                onRemove={(_, index) =>
                  change(
                    'photoUrls',
                    photoUrls.current.filter((_, i) => i !== index),
                  )
                }
              />
            </NativeCard>
          ) : (
            <>
              {!ownerMode && (
                <NativeCard style={{ gap: 10 }}>
                  <Txt v="h3">Owner details</Txt>
                  {(form.contacts ?? []).map((contact: any, index: number) => (
                    <View key={index} style={{ gap: 8 }}>
                      <Row align="flex-start">
                        <Input
                          containerStyle={{ flex: 1 }}
                          label={contact.role === 'OWNER' ? 'Owner name' : 'Contact name'}
                          value={contact.name ?? ''}
                          onChangeText={(name) =>
                            change(
                              'contacts',
                              form.contacts.map((item: any, i: number) => (i === index ? { ...item, name } : item)),
                            )
                          }
                        />
                        <Input
                          containerStyle={{ flex: 1 }}
                          label={contact.role === 'OWNER' ? 'Owner phone' : 'Phone'}
                          keyboardType="phone-pad"
                          value={contact.phone ?? ''}
                          onChangeText={(phone) =>
                            change(
                              'contacts',
                              form.contacts.map((item: any, i: number) => (i === index ? { ...item, phone } : item)),
                            )
                          }
                        />
                      </Row>
                      {contactOptions && (
                        <>
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
                          <Input
                            label="Contact note"
                            multiline
                            value={contact.note ?? ''}
                            onChangeText={(note) =>
                              change(
                                'contacts',
                                form.contacts.map((item: any, i: number) => (i === index ? { ...item, note } : item)),
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
                        </>
                      )}
                    </View>
                  ))}
                  <Row wrap>
                    <Button
                      title="Add contact"
                      variant="ghost"
                      size="sm"
                      onPress={() => change('contacts', [...(form.contacts ?? []), { name: '', phone: '', role: 'OWNER' }])}
                    />
                    {!!form.contacts?.length && (
                      <Button
                        title={contactOptions ? 'Hide contact options' : 'Contact options'}
                        variant="ghost"
                        size="sm"
                        onPress={() => setContactOptions(!contactOptions)}
                      />
                    )}
                  </Row>
                </NativeCard>
              )}
              <NativeCard style={{ gap: 10 }}>
                <Txt v="h3">Address details</Txt>
                <Row align="flex-start">
                  {field('sector', 'Sector / locality', false, true)}
                  {field('houseNo', 'House / plot no.', false, true)}
                </Row>
                {field('address', 'Address')}
              </NativeCard>
              <NativeCard style={{ gap: 10 }}>
                <Txt v="h3">{units.length ? 'Property details · Unit 1' : 'Property details'}</Txt>
                <ChoiceField label="Property type" value={form.propertyType} choices={PROPERTY_TYPES} onChange={(v) => change('propertyType', v)} />
                {allowUnits && (
                  <ChoiceField
                    label="Property configuration"
                    value={customConfiguration ? 'CUSTOM' : configuration}
                    choices={[...surveyConfigurationChoices, 'CUSTOM']}
                    labels={{ CUSTOM: 'Other configuration' }}
                    onChange={(value) => {
                      if (value === 'CUSTOM') applyChanges({ _customConfiguration: true });
                      else
                        applyChanges({
                          _customConfiguration: false,
                          ...inventoryUnitConfigurationFields((value ?? undefined) as UnitConfiguration | undefined),
                        });
                    }}
                  />
                )}
                {(!allowUnits || customConfiguration) && (
                  <Row align="flex-start">
                    <ChoiceField
                      paired
                      label={allowUnits ? 'Room kind' : 'Property configuration'}
                      value={form.roomKind}
                      choices={['BHK', 'RK', 'STUDIO']}
                      onChange={(v) => change('roomKind', v)}
                    />
                    {field('bhk', 'BHK / rooms', false, true)}
                  </Row>
                )}
                <Row align="flex-start">
                  <ChoiceField
                    paired
                    label="Furnishing"
                    value={form.furnishing}
                    choices={['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']}
                    onChange={(v) => change('furnishing', v)}
                  />
                  {field('floor', 'Floor', false, true)}
                </Row>
              </NativeCard>
              <NativeCard style={{ gap: 10 }}>
                <Txt v="h3">Price & rental terms</Txt>
                <ChoiceField label="Purpose" value={form.purpose} choices={['RENT', 'SALE']} onChange={(v) => change('purpose', v)} />
                {form.purpose === 'RENT' ? (
                  field('monthlyRent', 'Monthly rent ₹')
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
                <Row align="flex-start">
                  <ChoiceField
                    paired
                    label="Tenant type"
                    value={form.details?.tenantType}
                    choices={['FAMILY', 'BACHELORS', 'GIRLS', 'BOYS', 'COMPANY', 'ANY']}
                    onChange={(value) => changeDetail('tenantType', value)}
                  />
                  <ChoiceField
                    paired
                    label="Food preference"
                    value={form.details?.foodPreference}
                    choices={['VEGETARIAN_ONLY', 'NO_RESTRICTION']}
                    onChange={(value) => changeDetail('foodPreference', value)}
                  />
                </Row>
                {!ownerMode && field('brokerage', 'Brokerage')}
              </NativeCard>
              <NativeCard style={{ gap: 10 }}>
                {field('directionsUrl', 'Directions link or latitude, longitude')}
                <Row wrap>
                  {navigation.pinSearch && (
                    <Button
                      title="Find property pin"
                      variant="secondary"
                      size="sm"
                      onPress={() => void Linking.openURL(navigation.pinSearch!).catch(() => toast.error('Unable to open Maps'))}
                    />
                  )}
                  {navigation.sectorMap && (
                    <Button
                      title="Sector map"
                      variant="secondary"
                      size="sm"
                      onPress={() => void Linking.openURL(navigation.sectorMap!).catch(() => toast.error('Unable to open sector map'))}
                    />
                  )}
                </Row>
              </NativeCard>
              <NativePropertyExtras
                quickEntry={{ open: additionalOpen, onToggle: setAdditionalOpen }}
                value={form}
                disabled={!ready || saving || unitUploading !== null}
                onUploading={setUploading}
                onChange={(next) => {
                  formRef.current = next;
                  setForm(next);
                  persist(next);
                }}
              >
                {!markRented && (directoryEnabled || form._activateInDirectory) && (
                  <NativeCard style={{ gap: 10 }}>
                    {!availabilityReview && (
                      <Row gap={10}>
                        <Txt v="bodyStrong" style={{ flex: 1 }}>
                          Make available
                        </Txt>
                        <Switch
                          accessibilityLabel="Make property available"
                          value={!!form._activateInDirectory}
                          disabled={!ready || saving}
                          onValueChange={(value) => change('_activateInDirectory', value)}
                        />
                      </Row>
                    )}
                    {form._activateInDirectory && (
                      <Input
                        label="Inventory year and month (YYYY-MM)"
                        value={form.directoryMonth ?? selectedMonth}
                        editable={ready && !saving}
                        maxLength={7}
                        onChangeText={(value) => change('directoryMonth', value)}
                      />
                    )}
                  </NativeCard>
                )}
                {field('unitLabel', 'Unit')}
                <ChoiceField
                  label="Category"
                  value={form.category}
                  choices={['RESIDENTIAL', 'COMMERCIAL', 'PLOT', 'LAND']}
                  onChange={(v) => change('category', v)}
                />
                <Row align="flex-start">
                  {field('area', 'Area', false, true)}
                  <ChoiceField
                    paired
                    label="Area unit"
                    value={form.areaUnit}
                    choices={['SQ_FT', 'SQ_YD', 'SQ_M', 'ACRE', 'HECTARE']}
                    onChange={(v) => change('areaUnit', v)}
                  />
                </Row>

                {form.purpose === 'RENT' && field('securityDeposit', 'Deposit ₹')}
                {!ownerMode && !markRented && !form._activateInDirectory && (
                  <ChoiceField
                    label="Availability"
                    value={form.availability}
                    choices={['UNKNOWN', 'AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE']}
                    onChange={(v) => change('availability', v ?? 'UNKNOWN')}
                  />
                )}
                {!ownerMode &&
                  (() => {
                    const isAdmin = canAssign;
                    const teamMembers: any[] = (Array.isArray(team.data) ? team.data : (team.data as any)?.members) || [];
                    if (!isAdmin) {
                      return (
                        <View style={{ gap: 4 }}>
                          <Txt v="caption" color="muted">
                            Assignee
                          </Txt>
                          <View style={{ padding: 12, borderRadius: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.line }}>
                            <Txt v="bodyStrong">{user?.name || 'You (Agent)'} (Assigned)</Txt>
                            <Txt v="caption" color="muted">
                              Only Broker Admin can re-assign property
                            </Txt>
                          </View>
                        </View>
                      );
                    }
                    if (teamMembers.length === 0) return null;
                    return (
                      <ChoiceField
                        label="Assignee"
                        emptyLabel="Unassigned / Current User"
                        value={form.assignedToId || form.assignedTo?.id || null}
                        choices={teamMembers.map((m: any) => m.id)}
                        labels={Object.fromEntries(
                          teamMembers.map((m: any) => [m.id, `${m.name || m.email || m.phone || 'Member'} (${m.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'})`]),
                        )}
                        onChange={(v) => change('assignedToId', v ?? null)}
                      />
                    );
                  })()}
                {field('tenantPreference', 'Tenant notes')}
                {!ownerMode && field('notes', 'Notes', true)}
              </NativePropertyExtras>
              {allowUnits && (
                <>
                  {units.map((unit, index) => (
                    <InventoryUnitFields
                      key={index}
                      unit={unit}
                      number={index + 2}
                      purpose={form.purpose}
                      locked={!ready || saving || uploading || (unitUploading !== null && unitUploading !== index)}
                      uploading={unitUploading !== null || uploading}
                      onChange={(update) => {
                        const rows: InventoryUnitDraft[] = formRef.current._additionalUnits ?? [];
                        change(
                          '_additionalUnits',
                          rows.map((row, i) => (i === index ? update(row) : row)),
                        );
                      }}
                      onUploading={(active) => setUnitUploading(active ? index : null)}
                      onRemove={() =>
                        change(
                          '_additionalUnits',
                          units.filter((_, i) => i !== index),
                        )
                      }
                    />
                  ))}
                  <Button
                    title="+ Add unit"
                    variant="secondary"
                    disabled={!ready || saving || uploading || unitUploading !== null || units.length >= inventoryUnitLimit - 1}
                    onPress={() => change('_additionalUnits', [...units, {}])}
                  />
                </>
              )}
            </>
          )}
          <LegacyDraftRecovery
            error={error}
            onStart={() => {
              setError('');
              setStartSeparate(true);
            }}
          />
        </ScrollView>
        <View style={{ gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface }}>
          {error && (
            <Txt color="danger" accessibilityRole="alert">
              {error}
            </Txt>
          )}
          <Button
            title={
              ownerMode
                ? id
                  ? 'Send changes to broker'
                  : 'Submit property'
                : markRented
                  ? 'Save as rented out'
                  : availabilityReview
                    ? 'Confirm availability'
                    : compactSurvey
                      ? 'Save to Survey'
                      : 'Save property'
            }
            loading={saving}
            disabled={!ready || uploading || unitUploading !== null || readingLocation}
            onPress={save}
          />
        </View>
      </View>
    </Shell>
  );
}

function OwnerEditorScreen({ title, subtitle, children }: { title: string; subtitle?: string; back?: boolean; children: React.ReactNode }) {
  return (
    <Screen>
      <Header title={title} subtitle={subtitle} back />
      {children}
    </Screen>
  );
}
