'use client';
import { useState } from 'react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  ExternalLink,
  FileText,
  Link2,
  Mail,
  MoreHorizontal,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { timeAgo } from '@brokeriq/shared';
import { api } from '@/lib/api';
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

  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);

  if (q.isError) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  const members = q.data?.members ?? [];
  const ranked = [...members]
    .filter((m) => m.status === 'ACTIVE')
    .sort((a, b) => b.stats.won30d - a.stats.won30d || b.stats.activities30d - a.stats.activities30d);

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Agents invite करें, roles दें, KYC verify करें, performance देखें"
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
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-bold tracking-wide text-subtle uppercase">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">KYC Status</th>
                <th className="px-4 py-3 text-center">Open leads</th>
                <th className="px-4 py-3 text-center">Won (30d)</th>
                <th className="px-4 py-3 text-center">Activities (30d)</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => {
                const kycStatus = m.kycStatus || 'UNVERIFIED';

                return (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedAgent(m)}
                    className={cn(
                      'border-b border-line last:border-0 cursor-pointer hover:bg-surface-2/50 transition-colors',
                      m.status !== 'ACTIVE' && 'opacity-60',
                    )}
                  >
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
                    <td className="px-4 py-3">
                      {kycStatus === 'VERIFIED' ? (
                        <Badge tone="success" className="font-bold">
                          <ShieldCheck className="size-3 mr-1" /> Verified
                        </Badge>
                      ) : kycStatus === 'PENDING' ? (
                        <Badge tone="warning" className="font-bold animate-pulse">
                          Pending Review
                        </Badge>
                      ) : kycStatus === 'REJECTED' ? (
                        <Badge tone="danger">Rejected</Badge>
                      ) : (
                        <Badge tone="neutral">Not submitted</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{m.stats.openLeads}</td>
                    <td className="px-4 py-3 text-center font-semibold text-emerald-600">{m.stats.won30d}</td>
                    <td className="px-4 py-3 text-center">{m.stats.activities30d}</td>
                    <td className="px-4 py-3 text-xs text-muted">{m.lastLoginAt ? timeAgo(m.lastLoginAt) : 'कभी नहीं'}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="xs" variant="ghost" onClick={() => setSelectedAgent(m)}>
                          Details & KYC
                        </Button>
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {admin && (q.data?.invites ?? []).length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-bold">Pending invites</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(q.data?.invites ?? []).map((i) => (
              <div key={i.id} className="card flex min-w-0 items-center gap-3 p-4">
                <div className="grid size-10 place-items-center rounded-xl bg-surface-2 text-muted">
                  <Mail className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{i.name}</p>
                  <p className="truncate text-xs text-muted">
                    {i.email} · {i.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'} · expires {formatDate(i.expiresAt, { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <Button size="xs" variant="ghost" className="shrink-0" onClick={() => cancel.mutate(i.id)}>
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
      <AgentKycModal agent={selectedAgent} open={!!selectedAgent} onOpenChange={(v) => !v && setSelectedAgent(null)} />
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

function AgentKycModal({
  agent,
  open,
  onOpenChange,
}: {
  agent: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const kycDetailsQuery = useQuery({
    queryKey: ['agent-kyc-details', agent?.id],
    queryFn: () => api<any>(`/broker/team/agents/${agent.id}/kyc`),
    enabled: !!agent?.id && open,
  });

  const reviewMutation = useApiMutation(
    (b: { status: 'VERIFIED' | 'REJECTED'; reviewNote?: string }) =>
      patch(`/broker/team/agents/${agent.id}/kyc`, b),
    {
      success: (res: any) =>
        res.status === 'VERIFIED'
          ? 'Agent KYC स्वीकृत व वेरिफाइड हो गया ✅'
          : 'Agent KYC अस्वीकृत कर दिया गया',
      invalidate: [['team'], ['agent-kyc-details', agent?.id]],
      onSuccess: () => {
        setShowRejectInput(false);
        setRejectNote('');
      },
    },
  );

  if (!agent) return null;
  const kyc = kycDetailsQuery.data;
  const status = kyc?.status || agent.kycStatus || 'UNVERIFIED';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${agent.name} • Member Details & KYC`}
      description={`${agent.email ?? agent.phone ?? ''} · Role: ${agent.role === 'BROKER_ADMIN' ? 'Admin' : 'Agent'}`}
    >
      <div className="space-y-5">
        {/* Agent Profile & Performance summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/60 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={agent.name} src={agent.avatarUrl} size={44} />
            <div>
              <p className="font-bold">{agent.name}</p>
              <p className="text-xs text-muted">{agent.phone || agent.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === 'VERIFIED' ? (
              <Badge tone="success" className="font-bold">
                <ShieldCheck className="size-3.5 mr-1" /> KYC Verified
              </Badge>
            ) : status === 'PENDING' ? (
              <Badge tone="warning" className="font-bold animate-pulse">
                <Clock className="size-3.5 mr-1" /> Pending Review
              </Badge>
            ) : status === 'REJECTED' ? (
              <Badge tone="danger">
                <ShieldAlert className="size-3.5 mr-1" /> Rejected
              </Badge>
            ) : (
              <Badge tone="neutral">
                <Shield className="size-3.5 mr-1" /> Not Submitted
              </Badge>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-line bg-surface p-2.5">
            <p className="text-xs text-muted">Open Leads</p>
            <p className="text-base font-bold">{agent.stats?.openLeads ?? 0}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-2.5">
            <p className="text-xs text-muted">Won (30d)</p>
            <p className="text-base font-bold text-emerald-600">{agent.stats?.won30d ?? 0}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-2.5">
            <p className="text-xs text-muted">Activities (30d)</p>
            <p className="text-base font-bold">{agent.stats?.activities30d ?? 0}</p>
          </div>
        </div>

        {/* KYC Documents Section */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-subtle uppercase tracking-wider">
            KYC Identity Documents • पहचान दस्तावेज़
          </h4>

          {kycDetailsQuery.isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : !kyc?.aadhaarNumber && !kyc?.panNumber && !kyc?.livelinessStraightUrl ? (
            <div className="rounded-xl border border-line bg-surface-2/40 p-6 text-center text-muted text-xs">
              इस agent ने अभी तक KYC विवरण और दस्तावेज़ सबमिट नहीं किए हैं।
            </div>
          ) : (
            <div className="space-y-3">
              {/* Aadhaar & PAN Cards */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-4 text-saffron-500" />
                    <span className="font-semibold text-xs">Aadhaar Card</span>
                  </div>
                  <p className="font-mono text-sm font-bold tracking-wider">
                    {kyc.aadhaarNumber ? kyc.aadhaarNumber.replace(/(\d{4})(?=\d)/g, '$1 ') : 'Not provided'}
                  </p>
                  {kyc.aadhaarPhotoUrl ? (
                    <a
                      href={kyc.aadhaarPhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block h-28 overflow-hidden rounded-lg border border-line bg-surface-2"
                    >
                      <img src={kyc.aadhaarPhotoUrl} alt="Aadhaar" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      <span className="absolute bottom-1 right-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                        <ExternalLink className="size-2.5" /> View
                      </span>
                    </a>
                  ) : (
                    <p className="text-xs text-muted">No document photo uploaded</p>
                  )}
                </div>

                <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-indigo-500" />
                    <span className="font-semibold text-xs">PAN Card</span>
                  </div>
                  <p className="font-mono text-sm font-bold tracking-wider uppercase">
                    {kyc.panNumber || 'Not provided'}
                  </p>
                  {kyc.panPhotoUrl ? (
                    <a
                      href={kyc.panPhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block h-28 overflow-hidden rounded-lg border border-line bg-surface-2"
                    >
                      <img src={kyc.panPhotoUrl} alt="PAN" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      <span className="absolute bottom-1 right-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                        <ExternalLink className="size-2.5" /> View
                      </span>
                    </a>
                  ) : (
                    <p className="text-xs text-muted">No document photo uploaded</p>
                  )}
                </div>
              </div>

              {/* Face Liveliness Check 3-pose Gallery */}
              <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    <span className="font-semibold text-xs">Face Liveliness Check (3 Poses)</span>
                  </div>
                  <span className="text-[11px] text-muted">Straight, Left, Right</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Straight', url: kyc.livelinessStraightUrl },
                    { label: 'Left Pose', url: kyc.livelinessLeftUrl },
                    { label: 'Right Pose', url: kyc.livelinessRightUrl },
                  ].map((p, i) => (
                    <div key={i} className="flex flex-col items-center rounded-lg border border-line bg-surface-2 p-1.5 text-center">
                      <div className="relative aspect-square w-full overflow-hidden rounded bg-black/20">
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noreferrer">
                            <img src={p.url} alt={p.label} className="h-full w-full object-cover" />
                          </a>
                        ) : (
                          <div className="grid h-full place-items-center text-muted text-[10px]">No photo</div>
                        )}
                      </div>
                      <span className="mt-1 text-[11px] font-semibold">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Review Note display if any */}
              {kyc.reviewNote && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-800 dark:text-rose-200">
                  <span className="font-bold">Rejection Note: </span> {kyc.reviewNote}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rejection input box */}
        {showRejectInput && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-2">
            <Field label="Rejection Note • अस्वीकृति का कारण" required hint="एजेंट को यह कारण दिखेगा ताकि वे सही दस्तावेज़ अपलोड कर सकें">
              <Input
                value={rejectNote}
                placeholder="उदा: आधार कार्ड की फ़ोटो स्पष्ट नहीं है"
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button size="xs" variant="ghost" onClick={() => setShowRejectInput(false)}>
                Cancel
              </Button>
              <Button
                size="xs"
                variant="danger"
                disabled={!rejectNote.trim() || reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ status: 'REJECTED', reviewNote: rejectNote })}
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        )}

        {/* Verification Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            {!showRejectInput && status !== 'REJECTED' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950"
                onClick={() => setShowRejectInput(true)}
              >
                <X className="size-4 mr-1" /> Reject KYC
              </Button>
            )}

            {status !== 'VERIFIED' && (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ status: 'VERIFIED' })}
              >
                <ShieldCheck className="size-4 mr-1" /> Approve & Verify KYC
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
