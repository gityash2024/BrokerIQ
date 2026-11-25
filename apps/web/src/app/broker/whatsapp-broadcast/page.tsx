'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BROADCAST_API,
  META_WHATSAPP_BILLING,
  META_WHATSAPP_PRICING,
  broadcastHeaderType,
  broadcastMediaType,
  hasDelegatedAccess,
  parseBroadcastContacts,
  type BroadcastDraftInput,
  type BroadcastGroup,
  type BroadcastQuote,
  type BroadcastWorkspace,
} from '@brokeriq/shared';
import { api, errorMessage, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/panel/shell';
import { ApiErrorState } from '@/components/ui/api-error';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/field';

const workspaceKey = ['whatsapp-broadcast'];
const formatMoney = (amount: number) => '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toggled = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((key) => key !== id) : [...ids, id]);

export default function WhatsAppBroadcastPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role !== 'BROKER_ADMIN' || !hasDelegatedAccess(user, 'inbox', 'view')) {
    return (
      <PageHeader
        title="WhatsApp Broadcast"
        subtitle="Broadcast access requires Broker Admin permissions."
        actions={
          <Link href="/broker" className="text-sm font-semibold text-primary">
            Return to workspace
          </Link>
        }
      />
    );
  }
  return <BroadcastWorkspaceView />;
}

function BroadcastWorkspaceView() {
  const cache = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [contactText, setContactText] = useState('');
  const [group, setGroup] = useState<BroadcastGroup | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [template, setTemplate] = useState('');
  const [parameters, setParameters] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [paid, setPaid] = useState(false);
  const [quote, setQuote] = useState<BroadcastQuote | null>(null);
  const [tab, setTab] = useState<'compose' | 'contacts' | 'history'>('compose');
  const [billingRetry, setBillingRetry] = useState<{ id: string; name: string; count: number } | null>(null);
  const [remove, setRemove] = useState<{ path: string; name: string } | null>(null);
  const workspace = useInfiniteQuery({
    queryKey: [...workspaceKey, search],
    queryFn: ({ pageParam }) => api<BroadcastWorkspace>(BROADCAST_API + '?' + new URLSearchParams({ search, ...(pageParam ? { after: pageParam } : {}) })),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next ?? undefined,
    refetchInterval: tab === 'history' ? 6000 : false,
  });
  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => void cache.invalidateQueries({ queryKey: workspaceKey }),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const data = workspace.data?.pages[0];
  const contacts = workspace.data?.pages.flatMap((page) => page.contacts) ?? [];
  const selected = data?.templates.find((entry) => entry.name + ':' + entry.language === template);
  const header = broadcastHeaderType(selected);
  const can = (action: 'create' | 'edit' | 'delete' | 'send') => hasDelegatedAccess(user, 'inbox', 'view', action);

  async function preview() {
    let file: { type: 'image' | 'document' | 'video' | 'audio'; url: string } | undefined;
    if (attachment) {
      const kind = broadcastMediaType(attachment.type);
      if (selected && header !== kind) throw new Error('Choose the attachment type required by the approved template');
      file = { type: kind, url: (await uploadFile(attachment, 'whatsappattachment')).url };
    }
    const message: BroadcastDraftInput['message'] = selected
      ? {
          type: 'template',
          name: selected.name,
          language: selected.language,
          params: parameters
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
          ...(file && header ? { header: { type: header, url: file.url } } : {}),
        }
      : file
        ? { ...file, caption: text || undefined }
        : { type: 'text', text };
    setQuote(
      await api<BroadcastQuote>(BROADCAST_API + '/preview', {
        method: 'POST',
        body: { name, groupIds: groups, message, allowMetaCharges: paid },
      }),
    );
  }

  return (
    <>
      <PageHeader
        title="WhatsApp Broadcast"
        subtitle="Manage opted-in contacts and send through your firm’s own WhatsApp number."
        actions={
          <Link href="/broker/inbox" className="text-sm font-semibold text-primary">
            Back to Inbox
          </Link>
        }
      />
      {workspace.error && <ApiErrorState error={workspace.error} onRetry={() => void workspace.refetch()} />}
      {data && (
        <>
          <div role="group" aria-label="Broadcast workspace" className="mb-4 flex flex-wrap gap-2">
            {(['compose', 'contacts', 'history'] as const).map((item) => (
              <Button key={item} variant={tab === item ? 'primary' : 'secondary'} onClick={() => setTab(item)}>
                {item === 'compose' ? 'Compose' : item === 'contacts' ? 'Contacts & groups' : 'Delivery history'}
              </Button>
            ))}
          </div>
          {tab === 'compose' && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
              <section className="card grid gap-4 p-4 sm:p-5">
                <label className="text-sm font-medium">
                  Broadcast name
                  <Input value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-semibold">Contact groups</legend>
                  {data.groups.length ? (
                    data.groups.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={groups.includes(item.id)} onChange={() => setGroups(toggled(groups, item.id))} />
                        {item.name} <span className="text-muted">· {item.contactIds.length}</span>
                      </label>
                    ))
                  ) : (
                    <button type="button" onClick={() => setTab('contacts')} className="text-left text-sm text-primary">
                      Create a group
                    </button>
                  )}
                </fieldset>
                <label className="grid gap-1 text-sm font-medium">
                  Message type
                  <select
                    className="rounded-xl border border-line bg-surface px-3 py-2"
                    value={template}
                    onChange={(event) => {
                      setTemplate(event.target.value);
                      setAttachment(null);
                    }}
                  >
                    <option value="">Service reply · open customer window</option>
                    {data.templates.map((task) => (
                      <option key={task.name + ':' + task.language} value={task.name + ':' + task.language}>
                        {task.name} · {task.category} · {task.language}
                      </option>
                    ))}
                  </select>
                </label>
                {selected ? (
                  <>
                    <p className="rounded-xl bg-surface-2 p-3 text-sm">{selected.body}</p>
                    <label className="text-sm font-medium">
                      Template values, one per line
                      <Textarea value={parameters} onChange={(event) => setParameters(event.target.value)} />
                    </label>
                  </>
                ) : (
                  <label className="text-sm font-medium">
                    Message or attachment caption
                    <Textarea value={text} onChange={(event) => setText(event.target.value)} />
                    <span className="text-xs text-muted">Use a Meta-approved marketing template for promotions.</span>
                  </label>
                )}
                {(!selected || header) && (
                  <label className="text-sm">
                    Attachment
                    <Input
                      type="file"
                      accept="image/*,video/mp4,audio/*,.pdf,.txt,.docx,.xlsx,.pptx"
                      onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} />
                  Allow estimated Meta charges for this broadcast
                </label>
                <Button
                  disabled={!can('send') || !data.connected || action.isPending || !groups.length || !name.trim() || (!text.trim() && !attachment && !selected)}
                  onClick={() => action.mutate(preview)}
                >
                  Preview recipients and cost
                </Button>
              </section>
              <aside className="card self-start p-4 sm:p-5">
                <h2 className="font-semibold">Direct Meta billing</h2>
                <p className="mt-2 text-sm text-muted">BrokerIQ platform fee ₹0. Meta shows available funds and payment methods for your account.</p>
                <ol className="my-3 list-decimal space-y-2 pl-5 text-sm">
                  <li>Open Meta Billing and select your firm’s WhatsApp account.</li>
                  <li>Add a payment method, or add funds if a prepaid balance is offered.</li>
                  <li>Return here to preview and confirm the broadcast.</li>
                </ol>
                <a href={META_WHATSAPP_BILLING} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary">
                  Open Meta Billing
                </a>
                <a href={META_WHATSAPP_PRICING} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm text-primary">
                  Meta rate card
                </a>
                {!data.connected && (
                  <Link href="/broker/connectors" className="mt-3 block text-sm font-semibold text-primary">
                    Connect your firm’s WhatsApp number
                  </Link>
                )}
                {data.connected && can('create') && (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    disabled={action.isPending}
                    onClick={() => action.mutate(() => api('/whatsapp/templates/sync', { method: 'POST' }))}
                  >
                    Sync approved templates
                  </Button>
                )}
              </aside>
            </div>
          )}
          {tab === 'contacts' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="card grid gap-3 p-4 sm:p-5">
                <h2 className="font-semibold">Contacts</h2>
                {can('create') && (
                  <>
                    <label className="text-sm">
                      Paste contacts as name, phone, optional WhatsApp consent evidence
                      <Textarea value={contactText} onChange={(event) => setContactText(event.target.value)} />
                    </label>
                    <label className="text-sm">
                      Import CSV
                      <Input
                        type="file"
                        accept=".csv,.tsv,text/csv"
                        onChange={(event) => {
                          const input = event.target.files?.[0];
                          if (input)
                            void input
                              .text()
                              .then(setContactText)
                              .catch((error) => toast.error(errorMessage(error)));
                        }}
                      />
                    </label>
                    <Button
                      disabled={!contactText.trim() || action.isPending}
                      onClick={() =>
                        action.mutate(async () => {
                          const rows = parseBroadcastContacts(contactText);
                          if (!rows.length) throw new Error('Add at least one contact');
                          for (let index = 0; index < rows.length; index += 500)
                            await api(BROADCAST_API + '/contacts', { method: 'POST', body: { contacts: rows.slice(index, index + 500) } });
                          setContactText('');
                          toast.success('Contacts saved');
                        })
                      }
                    >
                      Save contacts
                    </Button>
                  </>
                )}
                <Input aria-label="Search contacts" placeholder="Search contacts" value={search} onChange={(event) => setSearch(event.target.value)} />
                <ul className="divide-y divide-line">
                  {contacts.map((contact) => (
                    <li className="flex items-center justify-between gap-2 py-2 text-sm" key={contact.id}>
                      <div>
                        <p className="font-medium">
                          {contact.name} · +{contact.phone}
                        </p>
                        <p className="text-xs text-muted">{contact.optedOutAt ? 'Opted out' : contact.consentAt ? 'Opted in' : 'Consent required'}</p>
                      </div>
                      {can('delete') && (
                        <Button size="sm" variant="ghost" onClick={() => setRemove({ path: '/contacts/' + contact.id, name: contact.name })}>
                          Archive
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {workspace.hasNextPage && (
                  <Button variant="secondary" onClick={() => void workspace.fetchNextPage()}>
                    Load more contacts
                  </Button>
                )}
              </section>
              <section className="card self-start p-4 sm:p-5">
                <h2 className="font-semibold">Groups</h2>
                <ul className="my-3 divide-y divide-line">
                  {data.groups.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span>
                        {item.name} · {item.contactIds.length} contacts
                      </span>
                      <div className="flex gap-1">
                        {can('edit') && (
                          <Button size="sm" variant="ghost" onClick={() => setGroup(item)}>
                            Edit
                          </Button>
                        )}
                        {can('delete') && (
                          <Button size="sm" variant="ghost" onClick={() => setRemove({ path: '/groups/' + item.id, name: item.name })}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {can('create') && (
                  <Button variant="secondary" onClick={() => setGroup({ id: '', name: '', contactIds: [] })}>
                    Create group
                  </Button>
                )}
              </section>
            </div>
          )}
          {tab === 'history' && (
            <section className="card p-4 sm:p-5">
              <h2 className="font-semibold">Delivery history</h2>
              {!data.broadcasts.length && <p className="mt-2 text-sm text-muted">No broadcasts queued.</p>}
              <ul className="mt-2 divide-y divide-line">
                {data.broadcasts.map((item) => (
                  <li key={item.id} className="py-3 text-sm">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted">
                      {Object.entries(item.counts)
                        .map(([status, count]) => `${count} ${status.toLowerCase().replaceAll('_', ' ')}`)
                        .join(' · ')}
                    </p>
                    {can('send') && item.counts.BILLING_ACTION_NEEDED > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <a href={META_WHATSAPP_BILLING} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary">
                          Open Meta Billing
                        </a>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setBillingRetry({ id: item.id, name: item.name, count: item.counts.BILLING_ACTION_NEEDED })}
                        >
                          Retry after payment setup
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <Dialog
        open={!!group}
        title={group?.id ? 'Edit contact group' : 'Create contact group'}
        onOpenChange={(open) => {
          if (!open) setGroup(null);
        }}
        footer={
          <Button
            disabled={!group?.name.trim() || action.isPending}
            onClick={() =>
              group &&
              action.mutate(async () => {
                await api(BROADCAST_API + '/groups' + (group.id ? '/' + group.id : ''), {
                  method: group.id ? 'PATCH' : 'POST',
                  body: { name: group.name, contactIds: group.contactIds },
                });
                setGroup(null);
              })
            }
          >
            Save group
          </Button>
        }
      >
        {group && (
          <div className="grid gap-2">
            <Input aria-label="Group name" placeholder="Group name" value={group.name} onChange={(event) => setGroup({ ...group, name: event.target.value })} />
            <Input aria-label="Find group contacts" placeholder="Search contacts" value={search} onChange={(event) => setSearch(event.target.value)} />
            <p className="text-sm text-muted">{group.contactIds.length} selected</p>
            <ul className="max-h-60 space-y-2 overflow-auto">
              {contacts.map((item) => (
                <li key={item.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={group.contactIds.includes(item.id)}
                      onChange={() => setGroup({ ...group, contactIds: toggled(group.contactIds, item.id) })}
                    />
                    {item.name} · +{item.phone}
                  </label>
                </li>
              ))}
            </ul>
            {workspace.hasNextPage && (
              <Button variant="secondary" onClick={() => void workspace.fetchNextPage()}>
                Load more
              </Button>
            )}
          </div>
        )}
      </Dialog>
      <Dialog
        open={!!quote}
        title="Confirm broadcast"
        onOpenChange={(open) => {
          if (!open) setQuote(null);
        }}
        footer={
          <Button
            disabled={!quote?.id || action.isPending || (quote.allowMetaCharges && quote.estimatedCost === null)}
            onClick={() =>
              quote?.id &&
              action.mutate(async () => {
                const result = await api<{ queued: number }>(BROADCAST_API + '/' + quote.id + '/queue', { method: 'POST' });
                setQuote(null);
                setTab('history');
                toast.success(result.queued + ' recipients queued');
              })
            }
          >
            Confirm and queue
          </Button>
        }
      >
        {quote && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>Unique contacts</dt>
            <dd>{quote.selected}</dd>
            <dt>Ready to send</dt>
            <dd>{quote.canQueue}</dd>
            <dt>Skipped</dt>
            <dd>{quote.skipped}</dd>
            <dt>Estimated Meta cost</dt>
            <dd>{quote.estimatedCost === null ? 'Check rate card' : formatMoney(quote.estimatedCost) + ' before tax'}</dd>
            <dt>Available balance</dt>
            <dd>
              <a href={META_WHATSAPP_BILLING} target="_blank" rel="noopener noreferrer" className="text-primary">
                View in Meta
              </a>
            </dd>
            <dt>Remaining balance</dt>
            <dd>Available in Meta after delivery</dd>
          </dl>
        )}
      </Dialog>
      <Dialog
        open={!!billingRetry}
        title="Retry after Meta Billing setup"
        onOpenChange={(open) => {
          if (!open) setBillingRetry(null);
        }}
        footer={
          <Button
            disabled={action.isPending}
            onClick={() =>
              billingRetry &&
              action.mutate(async () => {
                await api(BROADCAST_API + '/' + billingRetry.id + '/retry-billing', { method: 'POST' });
                setBillingRetry(null);
              })
            }
          >
            Confirm retry
          </Button>
        }
      >
        {billingRetry && (
          <p className="text-sm">
            {billingRetry.name} · Retry {billingRetry.count} billing failures using the original Meta charge approval.
          </p>
        )}
      </Dialog>
      <Dialog
        open={!!remove}
        title={remove?.path.startsWith('/groups') ? 'Delete group?' : 'Archive contact?'}
        onOpenChange={(open) => {
          if (!open) setRemove(null);
        }}
        footer={
          <Button
            disabled={action.isPending}
            onClick={() =>
              remove &&
              action.mutate(async () => {
                await api(BROADCAST_API + remove.path, { method: 'DELETE' });
                setRemove(null);
              })
            }
          >
            Confirm
          </Button>
        }
      >
        {remove?.name}
      </Dialog>
    </>
  );
}
