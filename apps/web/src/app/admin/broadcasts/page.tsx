'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Bell, Mail, Megaphone, Send, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { post, useApiMutation } from '@/lib/hooks';
import { cn, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Badge, Empty, Skeleton } from '@/components/ui/misc';

const CH = { IN_APP: { label: 'In-app', icon: Bell }, PUSH: { label: 'Push + in-app', icon: Smartphone }, EMAIL: { label: 'Email', icon: Mail } } as const;

export default function Page() {
  const list = useQuery({ queryKey: ['admin-broadcasts'], queryFn: () => api<any[]>('/admin/broadcasts') });
  const [f, setF] = useState({ audience: 'ALL', channel: 'IN_APP', title: '', body: '', link: '' });
  const send = useApiMutation(() => post('/admin/broadcasts', { ...f, link: f.link || null }), {
    success: (r: any) => `${r.sentCount} लोगों को भेजा गया`,
    invalidate: [['admin-broadcasts']],
    onSuccess: () => setF({ ...f, title: '', body: '', link: '' }),
  });
  return (
    <>
      <PageHeader title="Broadcasts" subtitle="Users या brokers को announcement, offer या update भेजें" />
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="card p-6">
          <p className="mb-2 text-sm font-semibold">Audience</p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              ['ALL', 'सभी'],
              ['USERS', 'Users / owners'],
              ['BROKERS', 'Brokers'],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setF({ ...f, audience: v })}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-sm font-semibold',
                  f.audience === v ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'border-line text-muted',
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="mb-2 text-sm font-semibold">Channel</p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {Object.entries(CH).map(([v, c]) => (
              <button
                key={v}
                onClick={() => setF({ ...f, channel: v })}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold',
                  f.channel === v ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'border-line text-muted',
                )}
              >
                <c.icon className="size-4" /> {c.label}
              </button>
            ))}
          </div>
          <div className="space-y-4">
            <Field label="Title" required>
              <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="🎉 Sector 65 में नई listings" />
            </Field>
            <Field label="Message" required>
              <Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
            </Field>
            <Field label="Link (optional)" hint="जैसे /buy?localityId=… या पूरा URL">
              <Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
            </Field>
          </div>
          <Button
            className="mt-5 w-full"
            loading={send.isPending}
            disabled={f.title.length < 2 || f.body.length < 2}
            onClick={() => confirm('Broadcast भेजें? यह undo नहीं होगा।') && send.mutate(undefined)}
          >
            <Send className="size-4" /> भेजें
          </Button>
          {f.channel === 'EMAIL' && (
            <p className="mt-2 text-xs text-muted">Email के लिए SMTP ज़रूरी है — recipients BCC में जाते हैं (एक-दूसरे का email नहीं दिखता)।</p>
          )}
        </div>
        <div>
          <div className="card mb-5 p-5">
            <p className="mb-3 text-xs font-bold tracking-wider text-subtle uppercase">Preview</p>
            <motion.div
              key={f.title + f.body}
              initial={{ scale: 0.98, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex gap-3 rounded-2xl bg-surface-2 p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
                <Megaphone className="size-5" />
              </span>
              <div>
                <p className="font-semibold">{f.title || 'Title'}</p>
                <p className="text-sm text-muted">{f.body || 'Message…'}</p>
              </div>
            </motion.div>
          </div>
          <p className="mb-2 text-sm font-bold">History</p>
          {!list.data ? (
            <Skeleton className="h-40" />
          ) : !list.data.length ? (
            <Empty title="अभी कोई broadcast नहीं" />
          ) : (
            <div className="space-y-2">
              {list.data.map((b) => (
                <div key={b.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{b.title}</p>
                    <Badge>{b.audience}</Badge>
                    <Badge tone="brand">{b.channel}</Badge>
                    <span className="ml-auto text-xs text-subtle">{formatDateTime(b.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{b.body}</p>
                  <p className="mt-1 text-xs text-subtle">{b.sentCount} recipients</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
