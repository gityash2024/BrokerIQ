import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { BROADCAST_API, META_WHATSAPP_BILLING, META_WHATSAPP_PRICING, broadcastHeaderType, broadcastMediaType, hasDelegatedAccess,
  parseBroadcastContacts, type BroadcastDraftInput, type BroadcastGroup, type BroadcastQuote, type BroadcastWorkspace } from '@brokeriq/shared';
import { api, errorMessage, uploadUri } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BrokerScreen, NativeCard } from '@/launch/screen';
import { Button, ErrorView, Input, Row, Segmented, Sheet, Txt } from '@/ui';

const workspaceKey = ['whatsapp-broadcast'];
const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
type Tab = 'compose' | 'contacts' | 'history';

export default function WhatsAppBroadcast() {
  const { user } = useAuth();
  if (user?.role !== 'BROKER_ADMIN' || !hasDelegatedAccess(user, 'inbox', 'view')) {
    return <BrokerScreen title="WhatsApp Broadcast" subtitle="Broadcast access requires Broker Admin permissions." back><View /></BrokerScreen>;
  }
  return <Workspace />;
}

function Workspace() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [tab, setTab] = useState<Tab>('compose');
  const [search, setSearch] = useState('');
  const [contactText, setContactText] = useState('');
  const [group, setGroup] = useState<BroadcastGroup | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [template, setTemplate] = useState('');
  const [parameters, setParameters] = useState('');
  const [attachment, setAttachment] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [paid, setPaid] = useState(false);
  const [quote, setQuote] = useState<BroadcastQuote | null>(null);
  const workspace = useInfiniteQuery({
    queryKey: [...workspaceKey, search],
    queryFn: ({ pageParam }) => api<BroadcastWorkspace>(BROADCAST_API + '?' + new URLSearchParams({ search, ...(pageParam ? { after: pageParam } : {}) }).toString()),
    initialPageParam: null as string | null,
    getNextPageParam: (result) => result.next ?? undefined,
    refetchInterval: tab === 'history' ? 6000 : false,
  });
  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => void cache.invalidateQueries({ queryKey: workspaceKey }),
    onError: (error) => Alert.alert('WhatsApp Broadcast', errorMessage(error)),
  });
  const data = workspace.data?.pages[0];
  const contacts = workspace.data?.pages.flatMap((page) => page.contacts) ?? [];
  const selected = data?.templates.find(({ name, language }) => name + ':' + language === template);
  const header = broadcastHeaderType(selected);
  const can = (grant: 'create' | 'edit' | 'send' | 'delete') => hasDelegatedAccess(user, 'inbox', 'view', grant);
  const billing = () => void Linking.openURL(META_WHATSAPP_BILLING).catch((error) => Alert.alert('Meta Billing', errorMessage(error)));

  async function pickAttachment() {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'video/mp4', 'audio/*', 'application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.*'] });
    if (!picked.canceled) setAttachment(picked.assets[0]);
  }

  async function preview() {
    const mime = attachment?.mimeType;
    if (attachment && !mime) throw new Error('Choose a file with a recognized MIME type');
    const uploaded = attachment && mime ? { type: broadcastMediaType(mime), url: (await uploadUri(attachment.uri, 'whatsappattachment', mime)).url } : null;
    if (selected && uploaded && uploaded.type !== header) throw new Error('Choose the attachment type required by the template');
    const message: BroadcastDraftInput['message'] = selected ? {
      type: 'template', name: selected.name, language: selected.language,
      params: parameters.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      ...(header && uploaded ? { header: { type: header, url: uploaded.url } } : {}),
    } : uploaded ? { ...uploaded, caption: text || undefined } : { type: 'text', text };
    setQuote(await api<BroadcastQuote>(BROADCAST_API + '/preview', { method: 'POST', body: { name, groupIds: groups, message, allowMetaCharges: paid } }));
  }

  function remove(path: string, title: string) {
    Alert.alert(title, 'Confirm this change?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: () => action.mutate(() => api(BROADCAST_API + path, { method: 'DELETE' })) },
    ]);
  }

  return <BrokerScreen title="WhatsApp Broadcast" back>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Segmented value={tab} onChange={(value) => setTab(value as Tab)} options={[
        { value: 'compose', label: 'Compose' }, { value: 'contacts', label: 'Contacts' }, { value: 'history', label: 'History' },
      ]} />
      {workspace.error && <ErrorView error={workspace.error} onRetry={() => void workspace.refetch()} />}
      {workspace.isPending && <Txt color="muted">Loading broadcast workspace…</Txt>}
      {data && tab === 'compose' && <>
        <NativeCard>
          <Input label="Broadcast name" value={name} onChangeText={setName} />
          <Txt v="h3">Contact groups</Txt>
          {data.groups.map((item) => <Choice key={item.id} selected={groups.includes(item.id)}
            label={item.name + ' · ' + item.contactIds.length} onPress={() => setGroups(toggle(groups, item.id))} />)}
          {!data.groups.length && <Button title="Create a group" variant="secondary" onPress={() => setTab('contacts')} />}
          <Txt v="h3">Message type</Txt>
          <Choice selected={!template} label="Service reply · open customer window" onPress={() => { setTemplate(''); setAttachment(null); }} />
          {data.templates.map((item) => {
            const key = item.name + ':' + item.language;
            return <Choice key={key} selected={template === key} label={item.name + ' · ' + item.category}
              onPress={() => { setTemplate(key); setAttachment(null); }} />;
          })}
          {selected ? <>
            <Txt color="muted">{selected.body}</Txt>
            <Input label="Template values, one per line" multiline value={parameters} onChangeText={setParameters} />
          </> : <Input label="Message or attachment caption" multiline value={text} onChangeText={setText} />}
          {(!selected || header) && <Button title={attachment?.name ?? 'Choose attachment'} variant="secondary"
            onPress={() => void pickAttachment().catch((error) => Alert.alert('Attachment', errorMessage(error)))} />}
          {attachment && <Button title="Remove attachment" variant="ghost" onPress={() => setAttachment(null)} />}
          <Choice selected={paid} label="Allow estimated Meta charges for this broadcast" onPress={() => setPaid(!paid)} />
          <Button title="Preview recipients and cost" disabled={!can('send') || !data.connected || !name.trim() || !groups.length || (!text.trim() && !attachment && !selected)}
            loading={action.isPending} onPress={() => action.mutate(preview)} />
        </NativeCard>
        <NativeCard>
          <Txt v="h3">Direct Meta billing</Txt>
          <Txt color="muted">BrokerIQ fee ₹0. Open Meta Billing, select your firm’s account and add funds or a payment method there. Then return to preview the broadcast.</Txt>
          <Button title="Open Meta Billing" variant="secondary" onPress={billing} />
          <Button title="Meta rate card" variant="ghost" onPress={() => void Linking.openURL(META_WHATSAPP_PRICING)} />
          {!data.connected && <Button title="Connect your firm number" variant="secondary" onPress={() => router.push('/connectors')} />}
          {data.connected && can('create') && <Button title="Sync approved templates" variant="secondary"
            disabled={action.isPending} onPress={() => action.mutate(() => api('/whatsapp/templates/sync', { method: 'POST' }))} />}
        </NativeCard>
      </>}
      {data && tab === 'contacts' && <>
        <NativeCard>
          <Txt v="h3">Contacts</Txt>
          {can('create') && <>
            <Input label="Paste name, phone, optional WhatsApp consent evidence" multiline value={contactText} onChangeText={setContactText} />
            <Button title="Import CSV" variant="secondary" onPress={() => action.mutate(async () => {
              const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/plain', 'text/tab-separated-values', 'application/csv'] });
              if (!picked.canceled) setContactText(await new File(picked.assets[0].uri).text());
            })} />
            <Button title="Save contacts" disabled={!contactText.trim() || action.isPending} onPress={() => action.mutate(async () => {
              const rows = parseBroadcastContacts(contactText);
              if (!rows.length) throw new Error('Add at least one contact');
              for (let offset = 0; offset < rows.length; offset += 500)
                await api(BROADCAST_API + '/contacts', { method: 'POST', body: { contacts: rows.slice(offset, offset + 500) } });
              setContactText('');
            })} />
          </>}
          <Input label="Search contacts" value={search} onChangeText={setSearch} />
          {contacts.map((contact) => <Row key={contact.id} style={{ justifyContent: 'space-between' }}>
            <View style={{ minWidth: 0, flex: 1 }}><Txt>{contact.name} · +{contact.phone}</Txt>
              <Txt v="caption" color="muted">{contact.optedOutAt ? 'Opted out' : contact.consentAt ? 'Opted in' : 'Consent required'}</Txt></View>
            {can('delete') && <Button title="Archive" size="sm" variant="ghost" onPress={() => remove('/contacts/' + contact.id, 'Archive contact?')} />}
          </Row>)}
          {workspace.hasNextPage && <Button title="Load more contacts" variant="secondary" onPress={() => void workspace.fetchNextPage()} />}
        </NativeCard>
        <NativeCard>
          <Txt v="h3">Groups</Txt>
          {data.groups.map((item) => <View key={item.id}>
            <Txt>{item.name} · {item.contactIds.length} contacts</Txt>
            <Row>{can('edit') && <Button title="Edit" variant="ghost" size="sm" onPress={() => setGroup(item)} />}
              {can('delete') && <Button title="Delete" variant="ghost" size="sm" onPress={() => remove('/groups/' + item.id, 'Delete group?')} />}</Row>
          </View>)}
          {can('create') && <Button title="Create group" variant="secondary" onPress={() => setGroup({ id: '', name: '', contactIds: [] })} />}
        </NativeCard>
      </>}
      {data && tab === 'history' && <NativeCard>
        <Txt v="h3">Delivery history</Txt>
        {!data.broadcasts.length && <Txt color="muted">No broadcasts queued.</Txt>}
        {data.broadcasts.map((item) => <View key={item.id}><Txt>{item.name}</Txt>
          <Txt color="muted" v="caption">{Object.entries(item.counts).map(([status, count]) => count + ' ' + status.toLowerCase().replaceAll('_', ' ')).join(' · ')}</Txt>
          {can('send') && item.counts.BILLING_ACTION_NEEDED > 0 && <>
            <Button title="Open Meta Billing" variant="ghost" onPress={billing} />
            <Button title="Retry after payment setup" variant="secondary" onPress={() => Alert.alert('Retry WhatsApp broadcast',
              `Retry ${item.counts.BILLING_ACTION_NEEDED} billing failures using the original Meta charge approval.`,
              [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm retry', onPress: () => action.mutate(() =>
                api(BROADCAST_API + '/' + item.id + '/retry-billing', { method: 'POST' })) }])} />
          </>}
        </View>)}
      </NativeCard>}
    </ScrollView>
    <Sheet open={!!group} onClose={() => setGroup(null)} title={group?.id ? 'Edit contact group' : 'Create contact group'}>
      {group && <View style={{ gap: 10 }}>
        <Input label="Group name" value={group.name} onChangeText={(value) => setGroup({ ...group, name: value })} />
        <Input label="Find contacts" value={search} onChangeText={setSearch} />
        <Txt color="muted">{group.contactIds.length} selected</Txt>
        <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
          {contacts.map((item) => <Choice key={item.id} selected={group.contactIds.includes(item.id)} label={item.name + ' · +' + item.phone}
            onPress={() => setGroup({ ...group, contactIds: toggle(group.contactIds, item.id) })} />)}
          {workspace.hasNextPage && <Button title="Load more" variant="secondary" onPress={() => void workspace.fetchNextPage()} />}
        </ScrollView>
        <Button title="Save group" disabled={!group.name.trim() || action.isPending} onPress={() => action.mutate(async () => {
          await api(BROADCAST_API + '/groups' + (group.id ? '/' + group.id : ''), { method: group.id ? 'PATCH' : 'POST',
            body: { name: group.name, contactIds: group.contactIds } });
          setGroup(null);
        })} />
      </View>}
    </Sheet>
    <Sheet open={!!quote} title="Confirm broadcast" onClose={() => setQuote(null)}>
      {quote && <View style={{ gap: 9 }}>
        <Txt>{quote.selected} unique contacts · {quote.canQueue} ready · {quote.skipped} skipped</Txt>
        <Txt>Estimated Meta cost {quote.estimatedCost === null ? 'requires current rate card' : '₹' + quote.estimatedCost.toFixed(2) + ' before tax'}</Txt>
        <Txt color="muted">Available and remaining balance are shown in Meta Billing.</Txt>
        <Button title="Open Meta Billing" variant="secondary" onPress={billing} />
        <Button title="Confirm and queue" disabled={!quote.id || action.isPending || (quote.allowMetaCharges && quote.estimatedCost === null)}
          onPress={() => action.mutate(async () => { await api(BROADCAST_API + '/' + quote.id + '/queue', { method: 'POST' }); setQuote(null); setTab('history'); })} />
      </View>}
    </Sheet>
  </BrokerScreen>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={{ paddingVertical: 7 }}>
    <Txt color={selected ? 'brand' : undefined}>{selected ? '☑' : '☐'} {label}</Txt>
  </Pressable>;
}
