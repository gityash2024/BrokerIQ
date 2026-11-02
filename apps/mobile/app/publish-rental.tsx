import { LegacyDraftRecovery } from '@/launch/legacy-draft-recovery';
import { useEffect, useRef, useState } from 'react';
import { View, Switch } from 'react-native';
import { Image } from 'expo-image';
import { PublicationReview } from '@/launch/publication-review';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { inventoryPublishSchema, RENTABLE_TYPES, PROPERTY_TYPES, type LedgerItem, type LocalityListItem } from '@brokeriq/shared';
import { captureAccountContext, api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Screen, Header, Input, Button, Chip, Txt, Card, ErrorView } from '@/ui';
import { ChoiceField } from '@/launch/form';
import { editableDraft, decodeDraft, saveDraft, queueDraft, syncDrafts } from '@/launch/drafts';
export default function PublishRental() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const mutation = useRef(Crypto.randomUUID());
  const owner = useRef(captureAccountContext());
  const [startSeparate, setStartSeparate] = useState(false);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const item = useQuery({ queryKey: ['ledger-item', id], queryFn: () => api<LedgerItem>('/inventory/' + id, { ownerContext: owner.current }) });
  const locs = useQuery({ queryKey: ['localities-all'], queryFn: () => api<LocalityListItem[]>('/public/localities', { auth: false }) });
  const [value, setValue] = useState<Record<string, any>>({
    title: '',
    description: '',
    localityId: '',
    propertyType: '',
    price: '',
    contactName: '',
    contactPhone: '',
    photos: [],
  });
  const [ready, setReady] = useState(false),
    [preview, setPreview] = useState(false),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [localitySearch, setLocalitySearch] = useState('');

  useEffect(() => {
    if (!item.data) return;
    let active = true;
    editableDraft('PUBLIC_PUBLISH', id, owner.current, startSeparate)
      .then(async (row) => {
        if (!active) return;
        if (row) {
          mutation.current = row.id;
          const { inventoryId, confirmedAvailable, publicPreviewAccepted, expectedRevision, ...fields } = decodeDraft(row);
          setValue(fields);
        } else if (item.data?.publishedListingId) {
          const current = await api<any>('/listings/' + item.data.publishedListingId, { ownerContext: owner.current });
          if (!active) return;
          const fields = Object.fromEntries(
            [
              'title',
              'description',
              'localityId',
              'propertyType',
              'price',
              'address',
              'bedrooms',
              'bathrooms',
              'balconies',
              'carpetArea',
              'floor',
              'totalFloors',
              'furnishing',
              'securityDeposit',
              'amenities',
              'contactName',
              'contactPhone',
            ].flatMap((key) => (current[key] !== undefined ? [[key, current[key]]] : [])),
          );
          setValue({ ...fields, photos: current.media?.map((m: any) => ({ url: m.url, ...(m.kind ? { kind: m.kind } : {}) })) ?? [] });
        } else {
          setValue((previous) => ({
            ...previous,
            propertyType: item.data?.propertyType ?? '',
            localityId: item.data?.localityId ?? '',
            price: (item.data?.purpose === 'SALE' ? item.data.totalSalePrice : item.data?.monthlyRent) ?? '',
            title: item.data?.sector ? `Property in ${item.data.sector}` : '',
          }));
        }
        setReady(true);
      })
      .catch((e) => setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [id, item.data?.publishedListingId, !!item.data, startSeparate]);
  useEffect(() => {
    if (!ready) return;
    writes.current = writes.current.then(() => saveDraft('PUBLIC_PUBLISH', id, value, mutation.current, owner.current)).catch((e) => setError(errorMessage(e)));
  }, [value, ready, id]);
  const set = (key: string, v: any) => {
    setPreview(false);
    setAccepted(false);
    setValue({ ...value, [key]: v });
  };
  const payload = () =>
    inventoryPublishSchema.safeParse({
      ...value,
      purpose: item.data?.purpose,
      price: Number(value.price),
      expectedRevision: item.data?.revision,
      confirmedAvailable: true,
      publicPreviewAccepted: true,
    });
  const available = item.data?.availability === 'AVAILABLE' && item.data?.status === 'ACTIVE' && ['RENT', 'SALE'].includes(item.data?.purpose || '');
  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <Header title="Publish property" subtitle="Public details · Required approval" />
      {item.data && (
        <PublicationReview
          item={item.data}
          onDone={() => {
            void item.refetch();
          }}
        />
      )}
      {item.error && <ErrorView error={item.error} />}
      <Txt v="small" color="muted">
        Only the details below become public. Private contacts, notes and register images stay in your ledger. Drafts are encrypted on this device.
      </Txt>
      {!available ? (
        <Txt color="muted">First confirm this active Rent/Sale property is available in Inventory.</Txt>
      ) : (
        <View style={{ gap: 14, marginTop: 16 }}>
          {[
            ['title', 'Public title'],
            ['price', item.data?.purpose === 'SALE' ? 'Total sale price ₹' : 'Monthly rent ₹'],
            ['contactName', 'Public contact name'],
            ['contactPhone', 'Public phone (+91)'],
          ].map(([key, label]) => (
            <Input
              key={key}
              label={label}
              value={String(value[key] ?? '')}
              onChangeText={(v) => set(key, v)}
              keyboardType={key === 'price' ? 'decimal-pad' : key === 'contactPhone' ? 'phone-pad' : 'default'}
            />
          ))}
          <ChoiceField
            label="Property type"
            choices={[...(item.data?.purpose === 'SALE' ? PROPERTY_TYPES : RENTABLE_TYPES)]}
            value={value.propertyType}
            onChange={(v) => set('propertyType', v)}
          />
          <Input label="Find locality" value={localitySearch} onChangeText={setLocalitySearch} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {locs.data
              ?.filter((l) => !localitySearch || l.name.toLowerCase().includes(localitySearch.toLowerCase()))
              .slice(0, 12)
              .map((l) => (
                <Chip key={l.id} label={l.name} active={value.localityId === l.id} onPress={() => set('localityId', l.id)} />
              ))}
          </View>
          <Input label="Public description" value={value.description} onChangeText={(v) => set('description', v)} multiline />
          {!!item.data?.photoUrls?.length && (
            <View style={{ gap: 10 }}>
              <Txt v="title">Choose public property photos</Txt>
              {item.data.photoUrls.map((url) => (
                <View key={url} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Image source={{ uri: url }} style={{ width: 90, height: 90, borderRadius: 10 }} contentFit="cover" />
                  <Switch
                    value={value.photos.some((p: { url: string }) => p.url === url)}
                    onValueChange={(selected) =>
                      set('photos', selected ? [...value.photos, { url }] : value.photos.filter((p: { url: string }) => p.url !== url))
                    }
                  />
                  <Txt v="small">Publish photo</Txt>
                </View>
              ))}
            </View>
          )}
          <Button
            title="Review public preview"
            variant="secondary"
            onPress={() => {
              const p = payload();
              if (!p.success) setError(p.error.issues[0].message);
              else {
                setError('');
                setPreview(true);
              }
            }}
          />
          {preview && (
            <Card style={{ gap: 12, padding: 16 }}>
              <Txt v="label" color="brand">
                CUSTOMER PREVIEW
              </Txt>
              <Txt v="h3">{value.title}</Txt>
              <Txt>{'₹' + Number(value.price).toLocaleString('en-IN') + (item.data?.purpose === 'RENT' ? '/month' : '')}</Txt>
              <Txt v="small">{locs.data?.find((l) => l.id === value.localityId)?.name}</Txt>
              <Txt>{value.description}</Txt>
              <Txt v="small">{value.contactName + ' ' + value.contactPhone}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Switch value={accepted} onValueChange={setAccepted} />
                <Txt v="caption" style={{ flex: 1 }}>
                  I confirmed availability and approve these public details.
                </Txt>
              </View>
              <Button
                title="Publish / submit for required review"
                disabled={!accepted || busy}
                loading={busy}
                onPress={async () => {
                  const parsed = payload();
                  if (!parsed.success) return;
                  setBusy(true);
                  try {
                    await writes.current;
                    await saveDraft('PUBLIC_PUBLISH', id, { ...parsed.data, inventoryId: id }, mutation.current, owner.current);
                    await queueDraft(mutation.current, owner.current);
                    await syncDrafts();
                    router.replace('/drafts');
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </Card>
          )}
        </View>
      )}
      <LegacyDraftRecovery
        error={error}
        onStart={() => {
          setError('');
          setStartSeparate(true);
        }}
      />
      {!!error && <Txt color="danger">{error}</Txt>}
    </Screen>
  );
}
