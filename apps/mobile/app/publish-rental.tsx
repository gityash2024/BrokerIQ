import { useEffect, useRef, useState } from 'react';
import { View, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { inventoryPublishSchema, RENTABLE_TYPES, type LedgerItem, type LocalityListItem } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Screen, Header, Input, Button, Chip, Txt, Card, ErrorView } from '@/ui';
import { ChoiceField } from '@/launch/form';
import { editableDraft, decodeDraft, saveDraft, queueDraft, syncDrafts } from '@/launch/drafts';
export default function PublishRental() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const mutation = useRef(Crypto.randomUUID());
  const owner = useRef(user!.id);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const item = useQuery({ queryKey: ['ledger-item', id], queryFn: () => api<LedgerItem>('/inventory/' + id) });
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
    if (user?.role === 'BROKER_AGENT') {
      router.replace('/(broker)/leads');
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    editableDraft('PUBLIC_PUBLISH', id)
      .then((row) => {
        if (!active) return;
        if (row) {
          mutation.current = row.id;
          const { inventoryId, confirmedAvailable, publicPreviewAccepted, expectedRevision, ...fields } = decodeDraft(row);
          setValue(fields);
        }
        setReady(true);
      })
      .catch((e) => setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [id]);
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
      price: Number(value.price),
      expectedRevision: item.data?.revision,
      confirmedAvailable: true,
      publicPreviewAccepted: true,
    });
  const available = item.data?.availability === 'AVAILABLE' && item.data?.status === 'ACTIVE' && item.data?.purpose === 'RENT';
  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <Header title="Publish rental" subtitle="Public details · Admin review" />
      {item.error && <ErrorView error={item.error} />}
      <Txt v="small" color="muted">
        Only the details below become public. Private contacts, notes and register images stay in your ledger. Drafts are encrypted on this device.
      </Txt>
      {!available ? (
        <Txt color="muted">First confirm this active rental is available in Inventory.</Txt>
      ) : (
        <View style={{ gap: 14, marginTop: 16 }}>
          {[
            ['title', 'Public title'],
            ['price', 'Monthly rent ₹'],
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
          <ChoiceField label="Property type" choices={[...RENTABLE_TYPES]} value={value.propertyType} onChange={(v) => set('propertyType', v)} />
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
              <Txt>{'₹' + Number(value.price).toLocaleString('en-IN') + '/month'}</Txt>
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
                title="Submit for review"
                disabled={!accepted || busy}
                loading={busy}
                onPress={async () => {
                  const parsed = payload();
                  if (!parsed.success) return;
                  setBusy(true);
                  try {
                    await writes.current;
                    await saveDraft('PUBLIC_PUBLISH', id, { ...parsed.data, inventoryId: id }, mutation.current, owner.current);
                    await queueDraft(mutation.current);
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
      {!!error && <Txt color="danger">{error}</Txt>}
    </Screen>
  );
}
