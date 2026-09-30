'use client';
import { useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Crown, Link2, Mail, MoreHorizontal, Send, ShieldCheck, Trophy, UserMinus, UserPlus, Users, X } from 'lucide-react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { timeAgo } from '@brokeriq/shared';
import { useAuth } from '@/lib/auth';
import { del, patch, post, useApiMutation } from '@/lib/hooks';
import { cn, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { useTeam } from '@/components/broker/bits';
import { CopyField } from '@/components/panel/integration-card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Avatar, Badge, Empty, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';

export default function TeamPage() {
  const { user } = useAuth();
  const admin = user?.role === 'BROKER_ADMIN';
  const q = useTeam();
  const [invite, setInvite] = useState(false);
  const inv = [['team']];
  const update = useApiMutation(({ id, ...b }: any) => patch(`/broker/team/${id}`, b), { success: 'Updated', invalidate: inv });
  const remove = useApiMutation((id: string) => del(`/broker/team/${id}`), { success: 'Member हटाया — उनकी leads unassigned हो गईं', invalidate: inv });
  const cancel = useApiMutation((id: string) => del(`/broker/team/invites/${id}`), { success: 'Invite cancel', invalidate: inv });

  if (q.isError) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  const members = (q.data?.members ?? []) as any[];
  const ranked = [...members]
    .filter((m) => m.status === 'ACTIVE')
    .sort((a, b) => b.stats.won30d - a.stats.won30d || b.stats.activities30d - a.stats.activities30d);

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Agents invite करें, roles दें, performance देखें"
        actions={
          admin && (
            <Button size="sm" onClick={() => setInvite(true)}>
              <UserPlus className="size-4" /> Member invite करें
            </Button>
          )
        }
      />

      {ranked.length > 1 && (
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {ranked.slice(0, 3).map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn('card relative overflow-hidden p-5', i === 0 && 'border-saffron-300 dark:border-saffron-500/40')}
            >
              {i === 0 && <div className="absolute -top-12 -right-12 size-40 rounded-full bg-saffron-400/20 blur-2xl" />}
              <div className="relative flex items-center gap-3">
                <div className="relative">
                  <Avatar name={m.name} src={m.avatarUrl} size={48} />
                  <span
                    className={cn(
                      'absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full text-[11px] font-extrabold text-white ring-2 ring-surface',
                      ['bg-saffron-500', 'bg-slate-400', 'bg-amber-700'][i],
                    )}
                  >
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{m.name}</p>
                  <p className="text-xs text-muted">
                    {m.stats.won30d} won · {m.stats.activities30d} activities (30 दिन)
                  </p>
                </div>
                {i === 0 && <Trophy className="size-6 text-saffron-500" />}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!q.data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold tracking-wide text-subtle uppercase">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-center">Open leads</th>
                <th className="px-4 py-3 text-center">Won (30d)</th>
                <th className="px-4 py-3 text-center">Activities (30d)</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className={cn('border-b border-line last:border-0', m.status !== 'ACTIVE' && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} src={m.avatarUrl} size={36} />
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {m.name} {m.id === user?.id && <span className="text-xs font-normal text-muted">(आप)</span>}
                        </p>
                        <p className="truncate text-xs text-muted">{m.email ?? m.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {m.role === 'BROKER_ADMIN' ? (
                      <Badge tone="brand">
                        <Crown className="size-3" /> Admin
                      </Badge>
                    ) : (
                      <Badge>Agent</Badge>
                    )}
                    {m.status === 'SUSPENDED' && (
                      <Badge tone="danger" className="ml-1">
                        Suspended
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">{m.stats.openLeads}</td>
                  <td className="px-4 py-3 text-center font-semibold text-emerald-600">{m.stats.won30d}</td>
                  <td className="px-4 py-3 text-center">{m.stats.activities30d}</td>
                  <td className="px-4 py-3 text-xs text-muted">{m.lastLoginAt ? timeAgo(m.lastLoginAt) : 'कभी नहीं'}</td>
                  <td className="px-4 py-3 text-right">
                    {admin && m.id !== user?.id && (
                      <DM.Root>
                        <DM.Trigger className="rounded-lg p-2 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Actions">
                          <MoreHorizontal className="size-4" />
                        </DM.Trigger>
                        <DM.Portal>
                          <DM.Content align="end" className="z-50 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-xl">
                            <DM.Item
                              onSelect={() => update.mutate({ id: m.id, role: m.role === 'BROKER_ADMIN' ? 'BROKER_AGENT' : 'BROKER_ADMIN' })}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-surface-2"
                            >
                              <ShieldCheck className="size-4" /> {m.role === 'BROKER_ADMIN' ? 'Agent बनाएँ' : 'Admin बनाएँ'}
                            </DM.Item>
                            <DM.Item
                              onSelect={() => update.mutate({ id: m.id, status: m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-surface-2"
                            >
                              <X className="size-4" /> {m.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                            </DM.Item>
                            <DM.Item
                              onSelect={() => confirm(`${m.name} को team से हटाएँ? उनकी leads unassigned हो जाएँगी।`) && remove.mutate(m.id)}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 outline-none hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            >
                              <UserMinus className="size-4" /> Team से हटाएँ
                            </DM.Item>
                          </DM.Content>
                        </DM.Portal>
                      </DM.Root>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {admin && (q.data?.invites ?? []).length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-bold">Pending invites</p>
          <div className="grid gap-3 md:grid-cols-2">
            {q.data.invites.map((i: any) => (
              <div key={i.id} className="card flex items-center gap-3 p-4">
                <div className="grid size-10 place-items-center rounded-xl bg-surface-2 text-muted">
                  <Mail className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{i.name}</p>
                  <p className="truncate text-xs text-muted">
                    {i.email} · {i.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'} · expires {formatDate(i.expiresAt, { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <Button size="xs" variant="ghost" onClick={() => cancel.mutate(i.id)}>
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {q.data && members.length === 1 && !(q.data.invites ?? []).length && (
        <Empty
          className="mt-6"
          icon={<Users className="size-7" />}
          title="अकेले काम कर रहे हैं?"
          text="Agents जोड़ें — leads round-robin से बँटेंगी और हर agent का performance यहाँ दिखेगा।"
          action={
            admin && (
              <Button onClick={() => setInvite(true)}>
                <UserPlus className="size-4" /> पहला agent invite करें
              </Button>
            )
          }
        />
      )}
      <InviteDialog open={invite} onOpenChange={setInvite} />
    </>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [f, setF] = useState({ name: '', email: '', role: 'BROKER_AGENT' });
  const [result, setResult] = useState<{ link: string; emailed: boolean } | null>(null);
  const send = useApiMutation(() => post<{ link: string; emailed: boolean }>('/broker/team/invite', f), {
    invalidate: [['team']],
    onSuccess: (r) => {
      setResult(r);
      toast.success(r.emailed ? 'Invite email भेज दी गई' : 'Invite बन गया — link share करें');
    },
  });
  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setResult(null);
      setF({ name: '', email: '', role: 'BROKER_AGENT' });
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Team member invite करें"
      description="Invite link 7 दिन valid रहता है"
      footer={
        !result && (
          <Button loading={send.isPending} disabled={!f.name || !f.email} onClick={() => send.mutate(undefined)}>
            <Send className="size-4" /> Invite भेजें
          </Button>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Link2 className="size-5" />
            <p className="text-sm font-semibold">
              {result.emailed
                ? `${f.email} पर email चला गया। चाहें तो link WhatsApp पर भी भेजें:`
                : 'Email (SMTP) configure नहीं है — ये link खुद WhatsApp पर भेजें:'}
            </p>
          </div>
          <CopyField label="Invite link" value={result.link} />
          <Button variant="whatsapp" external href={`https://wa.me/?text=${encodeURIComponent(`${f.name}, हमारी team join करें: ${result.link}`)}`}>
            WhatsApp पर भेजें
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="नाम" required>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Role" hint="Admin: billing, connectors, automations, पूरी team की leads। Agent: सिर्फ़ अपनी assigned leads।">
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="BROKER_AGENT">Agent</option>
              <option value="BROKER_ADMIN">Admin</option>
            </Select>
          </Field>
        </div>
      )}
    </Dialog>
  );
}
