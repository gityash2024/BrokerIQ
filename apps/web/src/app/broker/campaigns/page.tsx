'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, Mail, Megaphone, MessageCircle, Plus, Send, Trash2, Users } from 'lucide-react';
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  timeAgo,
  type CampaignSegment,
  type LocalityListItem,
  type WaTemplate,
} from '@brokeriq/shared';
import { api } from '@/lib/api';
import { del, post, useApiMutation, useDebounced } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Chip, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Badge, Empty, Skeleton, Stat } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/tabs';
import { ApiErrorState } from '@/components/ui/api-error';

const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  RUNNING: 'warning',
  DONE: 'success',
  CANCELLED: 'danger',
};
const CHANNEL_LABEL: Record<string, string> = { WHATSAPP: 'WhatsApp', EMAIL: 'Email', BOTH: 'WhatsApp + Email' };

/** Broadcasts to a segment of the firm's own leads — from the firm's own WhatsApp number, and/or free email. */
export default function CampaignsPage() {
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api<any[]>('/broker/campaigns'),
    refetchInterval: (q) => ((q.state.data as any[] | undefined)?.some((c) => c.status === 'RUNNING') ? 5000 : false),
  });
  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="चुने हुए leads को एक साथ WhatsApp template या email भेजें — आपके अपने WhatsApp number से। STOP लिखने वाले leads अपने-आप हट जाते हैं।"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> नया campaign
          </Button>
        }
      />
      {list.isError ? (
        <ApiErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data ? (
        <Skeleton className="h-48" />
      ) : !list.data.length ? (
        <Empty
          icon={<Megaphone className="size-6" />}
          title="अभी कोई campaign नहीं"
          text="नई listing, price drop या festival offer — सही leads को एक click में भेजें।"
          action={<Button onClick={() => setCreating(true)}>पहला campaign बनाएँ</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((c) => (
            <button key={c.id} onClick={() => setOpenId(c.id)} className="card p-4 text-left transition hover:border-brand-300">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold" data-no-i18n>
                  {c.name}
                </p>
                <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">
                {CHANNEL_LABEL[c.channel]} · {timeAgo(c.createdAt)}
              </p>
              {c.status !== 'DRAFT' && (
                <p className="mt-3 text-sm">
                  <b>{c.sent}</b>/{c.total} भेजे{c.failed ? ` · ${c.failed} failed` : ''}
                  {c.skipped ? ` · ${c.skipped} skipped` : ''}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
      {creating && <CampaignEditor onClose={() => setCreating(false)} onCreated={(id) => (setCreating(false), setOpenId(id))} />}
      {openId && <CampaignDetail id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function toggle<T>(arr: T[] | undefined, v: T) {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}

function CampaignEditor({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({
    name: '',
    channel: 'WHATSAPP',
    templateName: '',
    templateLanguage: '',
    params: [] as string[],
    emailSubject: '',
    emailBody: '',
  });
  const [seg, setSeg] = useState<CampaignSegment>({ stages: ['NEW', 'CONTACTED', 'INTERESTED'] });
  const [tag, setTag] = useState('');
  const segment = useDebounced(seg, 400);
  const preview = useQuery({ queryKey: ['campaign-preview', segment], queryFn: () => post<any>('/broker/campaigns/preview', { segment }) });
  const templates = useQuery({ queryKey: ['wa-templates'], queryFn: () => api<WaTemplate[]>('/whatsapp/templates'), enabled: f.channel !== 'EMAIL' });
  const localities = useQuery({
    queryKey: ['localities-all'],
    queryFn: () => api<LocalityListItem[]>('/public/localities', { auth: false }),
    staleTime: 600_000,
  });
  const approved = (templates.data ?? []).filter((t) => !t.status || t.status === 'APPROVED');
  const tpl = approved.find((t) => `${t.name}|${t.language}` === `${f.templateName}|${f.templateLanguage}`);
  const slots = tpl?.body ? (tpl.body.match(/\{\{\d+\}\}/g) ?? []).length : 0;
  const save = useApiMutation(
    () =>
      post<any>('/broker/campaigns', {
        ...f,
        params: f.params.slice(0, slots),
        segment: seg,
        templateName: f.channel === 'EMAIL' ? null : f.templateName || null,
        templateLanguage: f.channel === 'EMAIL' ? null : f.templateLanguage || null,
      }),
    { success: 'Campaign draft बना — भेजने से पहले एक बार देख लें', invalidate: [['campaigns']], onSuccess: (r) => onCreated(r.id) },
  );
  const wantsWa = f.channel !== 'EMAIL';
  const wantsEmail = f.channel !== 'WHATSAPP';
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="नया campaign"
      description="Segment चुनें, message लिखें, फिर draft में देखकर भेजें।"
      footer={
        <Button loading={save.isPending} disabled={f.name.trim().length < 2} onClick={() => save.mutate(undefined)}>
          Draft save करें
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Campaign का नाम" required>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="जैसे: Sector 65 नई listings — October" />
        </Field>
        <Field label="कैसे भेजें">
          <Segmented
            value={f.channel}
            onChange={(v) => setF({ ...f, channel: v })}
            options={[
              { value: 'WHATSAPP', label: 'WhatsApp' },
              { value: 'EMAIL', label: 'Email' },
              { value: 'BOTH', label: 'दोनों' },
            ]}
          />
        </Field>

        <div className="rounded-2xl border border-line p-4">
          <p className="mb-3 font-semibold">किन leads को?</p>
          <Field label="Stage">
            <div className="flex flex-wrap gap-2">
              {LEAD_STAGES.map((s) => (
                <Chip key={s} active={seg.stages?.includes(s)} onClick={() => setSeg({ ...seg, stages: toggle(seg.stages, s) })}>
                  {LEAD_STAGE_LABELS[s]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Temperature" className="mt-3">
            <div className="flex flex-wrap gap-2">
              {(['HOT', 'WARM', 'COLD'] as const).map((t) => (
                <Chip key={t} active={seg.temperatures?.includes(t)} onClick={() => setSeg({ ...seg, temperatures: toggle(seg.temperatures, t) })}>
                  {t === 'HOT' ? '🔥 Hot' : t === 'WARM' ? 'Warm' : 'Cold'}
                </Chip>
              ))}
            </div>
          </Field>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Source">
              <Select value="" onChange={(e) => e.target.value && setSeg({ ...seg, sources: toggle(seg.sources, e.target.value as any) })}>
                <option value="">+ Source जोड़ें</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_SOURCE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Locality (requirement)">
              <Select value="" onChange={(e) => e.target.value && setSeg({ ...seg, localityIds: toggle(seg.localityIds, e.target.value) })}>
                <option value="">+ Locality जोड़ें</option>
                {(localities.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="BHK">
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((b) => (
                  <Chip key={b} active={seg.bedrooms?.includes(b)} onClick={() => setSeg({ ...seg, bedrooms: toggle(seg.bedrooms, b) })}>
                    {b} BHK
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="पिछले कितने दिनों में active">
              <Select value={seg.activeWithinDays ?? ''} onChange={(e) => setSeg({ ...seg, activeWithinDays: e.target.value ? Number(e.target.value) : null })}>
                <option value="">कोई भी</option>
                <option value="7">7 दिन</option>
                <option value="30">30 दिन</option>
                <option value="90">90 दिन</option>
              </Select>
            </Field>
            <Field label="Tag">
              <Input
                value={tag}
                placeholder="Tag लिखकर Enter"
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tag.trim()) {
                    e.preventDefault();
                    setSeg({ ...seg, tags: [...new Set([...(seg.tags ?? []), tag.trim()])] });
                    setTag('');
                  }
                }}
              />
            </Field>
            <Field label="Budget (₹/month)">
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={seg.minBudget ?? ''}
                  onChange={(e) => setSeg({ ...seg, minBudget: e.target.value ? Number(e.target.value) : null })}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={seg.maxBudget ?? ''}
                  onChange={(e) => setSeg({ ...seg, maxBudget: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </Field>
          </div>
          {!!(seg.sources?.length || seg.localityIds?.length || seg.tags?.length) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {seg.sources?.map((s) => (
                <Chip key={s} active onClick={() => setSeg({ ...seg, sources: toggle(seg.sources, s) })}>
                  {LEAD_SOURCE_LABELS[s]} ✕
                </Chip>
              ))}
              {seg.localityIds?.map((id) => (
                <Chip key={id} active onClick={() => setSeg({ ...seg, localityIds: toggle(seg.localityIds, id) })}>
                  {localities.data?.find((l) => l.id === id)?.name ?? id} ✕
                </Chip>
              ))}
              {seg.tags?.map((t) => (
                <Chip key={t} active onClick={() => setSeg({ ...seg, tags: toggle(seg.tags, t) })}>
                  #{t} ✕
                </Chip>
              ))}
            </div>
          )}
          <p className="mt-4 flex items-center gap-2 text-sm">
            <Users className="size-4 text-brand-600" />
            {preview.data ? (
              <span>
                <b>{preview.data.total}</b> leads{wantsEmail ? ` · ${preview.data.withEmail} के पास email` : ''}
              </span>
            ) : (
              <span className="text-muted">गिन रहे हैं…</span>
            )}
          </p>
        </div>

        {wantsWa && (
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <MessageCircle className="size-4 text-emerald-600" /> WhatsApp template
            </p>
            {preview.data && !preview.data.whatsappConnected ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                पहले अपना WhatsApp Business number जोड़ें —{' '}
                <Link href="/broker/connectors" className="font-semibold underline">
                  Connectors
                </Link>
                । Campaign आपके number से जाते हैं, इसलिए Meta का template charge आपके account पर लगता है।
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs text-muted">Business-initiated messages के लिए Meta सिर्फ़ approved templates की अनुमति देता है।</p>
                <Select
                  value={f.templateName ? `${f.templateName}|${f.templateLanguage}` : ''}
                  onChange={(e) => {
                    const [templateName, templateLanguage] = e.target.value.split('|');
                    setF({ ...f, templateName: templateName ?? '', templateLanguage: templateLanguage ?? '', params: [] });
                  }}
                >
                  <option value="">Template चुनें</option>
                  {approved.map((t) => (
                    <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </Select>
                {templates.data && !approved.length && <p className="mt-2 text-xs text-muted">कोई approved template नहीं — Inbox → Templates में Sync करें।</p>}
                {tpl?.body && (
                  <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-wrap" data-no-i18n>
                    {tpl.body}
                  </p>
                )}
                {Array.from({ length: slots }).map((_, i) => (
                  <Field key={i} label={`{{${i + 1}}}`} hint={i === 0 ? '{name} लिखें तो हर lead का नाम आएगा' : undefined} className="mt-3">
                    <Input
                      value={f.params[i] ?? ''}
                      onChange={(e) => {
                        const params = [...f.params];
                        params[i] = e.target.value;
                        setF({ ...f, params });
                      }}
                    />
                  </Field>
                ))}
              </>
            )}
          </div>
        )}

        {wantsEmail && (
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-3 flex items-center gap-2 font-semibold">
              <Mail className="size-4 text-brand-600" /> Email
            </p>
            <Field label="Subject">
              <Input value={f.emailSubject} onChange={(e) => setF({ ...f, emailSubject: e.target.value })} placeholder="{name} जी, Sector 65 में नई 3 BHK" />
            </Field>
            <Field label="Message" hint="{name} = lead का नाम। नीचे unsubscribe link अपने-आप जुड़ता है।" className="mt-3">
              <Textarea rows={6} value={f.emailBody} onChange={(e) => setF({ ...f, emailBody: e.target.value })} />
            </Field>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function CampaignDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['campaign', id, page],
    queryFn: () => api<any>(`/broker/campaigns/${id}?page=${page}`),
    refetchInterval: (x) => ((x.state.data as any)?.status === 'RUNNING' ? 4000 : false),
  });
  const start = useApiMutation(() => post(`/broker/campaigns/${id}/start`), {
    success: 'Campaign शुरू — messages थोड़ी-थोड़ी देर में जा रहे हैं',
    invalidate: [['campaigns'], ['campaign', id]],
  });
  const cancel = useApiMutation(() => post(`/broker/campaigns/${id}/cancel`), { success: 'Campaign रोक दिया', invalidate: [['campaigns'], ['campaign', id]] });
  const remove = useApiMutation(() => del(`/broker/campaigns/${id}`), { success: 'Draft हटाया', invalidate: [['campaigns']], onSuccess: onClose });
  const c = q.data;
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title={c?.name ?? 'Campaign'}
      description={c ? `${CHANNEL_LABEL[c.channel]} · ${formatDate(c.createdAt)}` : undefined}
    >
      {!c ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
            {c.templateName && <Badge>{c.templateName}</Badge>}
          </div>
          {c.status === 'DRAFT' ? (
            <div className="flex flex-wrap gap-2">
              <Button loading={start.isPending} onClick={() => confirm('अभी भेजें? भेजने के बाद रोक सकते हैं, वापस नहीं ले सकते।') && start.mutate(undefined)}>
                <Send className="size-4" /> अभी भेजें
              </Button>
              <Button variant="ghost" loading={remove.isPending} onClick={() => remove.mutate(undefined)}>
                <Trash2 className="size-4" /> Draft हटाएँ
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="कुल" value={c.total} />
                <Stat label="भेजे" value={c.sent} />
                <Stat label="Failed" value={c.failed} />
                <Stat label="Skipped" value={c.skipped} />
              </div>
              {c.status === 'RUNNING' && (
                <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate(undefined)}>
                  <Ban className="size-4" /> बाकी रोकें
                </Button>
              )}
              <div className="max-h-80 overflow-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <tbody>
                    {c.recipients.items.map((r: any) => (
                      <tr key={r.id} className="border-b border-line last:border-0">
                        <td className="px-3 py-2" data-no-i18n>
                          {r.name}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted">{r.channel ?? ''}</td>
                        <td className="px-3 py-2">
                          <Badge tone={r.status === 'SENT' ? 'success' : r.status === 'FAILED' ? 'danger' : 'neutral'}>{r.status}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted">{r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {c.recipients.totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 text-sm">
                  <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    ←
                  </Button>
                  {page} / {c.recipients.totalPages}
                  <Button size="sm" variant="secondary" disabled={page >= c.recipients.totalPages} onClick={() => setPage(page + 1)}>
                    →
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
