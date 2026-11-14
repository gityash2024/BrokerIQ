'use client';
import { DelegatedPermissions } from '@/components/broker/team/delegated-permissions';
import { firmRoleLabel } from '@brokeriq/shared';
import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { type BrokerTeamResponse, SHIFT_LOCATION_INTERVAL_MS } from '@brokeriq/shared';
import { ArrowLeft, MapPin, ShieldCheck, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { patch, del, useApiMutation } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Avatar, Badge, Skeleton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { ApiErrorState } from '@/components/ui/api-error';
import { formatDate, safeTimeAgo } from '@/lib/utils';

type Member = BrokerTeamResponse['members'][number] & { updatedAt: string; organization?: { name: string } };
const labels = { monthlyDeals: 'Deals target', monthlyLeads: 'Leads target', monthlyRevenue: 'Revenue target (₹)', commissionPct: 'Commission %' };
const targetInputs = (member: Member) =>
  Object.fromEntries(Object.keys(labels).map((key) => [key, member.targets?.[key as keyof typeof labels]?.toString() ?? '']));
export default function TeamMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['team', 'member', user?.id, id], queryFn: () => api<{ member: Member }>(`/broker/team/${encodeURIComponent(id)}`), enabled: !!user && !!id, refetchInterval: SHIFT_LOCATION_INTERVAL_MS, refetchOnWindowFocus: 'always', refetchOnReconnect: 'always' });
  if (q.isError) return <ApiErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <Skeleton className="h-64 rounded-xl" />;
  return <Editor key={`${user?.id}:${id}`} member={q.data.member} />;
}
function Editor({ member }: { member: Member }) {
  const { user } = useAuth();
  const teamBase = user?.role === 'SUPER_ADMIN' ? '/admin/team' : '/broker/team';
  const [baseline, setBaseline] = useState(member.updatedAt);
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone || '');
  const [targets, setTargets] = useState(targetInputs(member));
  const [action, setAction] = useState<'role' | 'status' | 'remove' | 'delegate' | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [removed, setRemoved] = useState(false);
  const update = useApiMutation(
    (body: Record<string, unknown>) => patch<{ updatedAt: string }>(`/broker/team/${member.id}`, { ...body, expectedUpdatedAt: baseline }),
    {
      success: 'सदस्य अपडेट हो गया',
      invalidate: [['team']],
      onSuccess: (result) => {
        setBaseline(result.updatedAt);
        setAction(null);
      },
    },
  );
  const remove = useApiMutation(() => del(`/broker/team/${member.id}`), {
    success: 'सदस्य टीम से हटाया गया',
    invalidate: [['team']],
    onSuccess: () => {
      setAction(null);
      setRemoved(true);
    },
  });
  const canEdit = user?.role === 'BROKER_ADMIN' || user?.role === 'SUPER_ADMIN';
  const conflict = baseline !== member.updatedAt;
  const invalid = Object.entries(targets).some(
    ([key, value]) => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0 || (key === 'commissionPct' && Number(value) > 100)),
  );
  const loc = member.lastLocation;
  const busy = update.isPending || remove.isPending;
  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href={user?.role === 'SUPER_ADMIN' ? '/admin' : '/broker'}>Workspace</Link>
        <span>/</span>
        <Link href={teamBase}>Team & Agents</Link>
        <span>/</span>
        <span>{member.name}</span>
      </nav>
      <Link href={teamBase} className="inline-flex items-center gap-2 text-sm text-brand">
        <ArrowLeft className="size-4" /> टीम सूची
      </Link>
      {removed ? (
        <div className="card p-6">सदस्य की firm access समाप्त कर दी गई है।</div>
      ) : (
        <>
          <div className="card flex flex-wrap items-center gap-4 p-5">
            <Avatar name={member.name} src={member.avatarUrl} size={56} />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{member.name}</h1>
              <p className="text-sm text-muted">
                {member.email} · {member.phone || 'फोन उपलब्ध नहीं'}
              </p>
              <p className="text-sm text-muted">
                {member.organization?.name} · Joined {formatDate(member.createdAt)}
              </p>
            </div>
            <Badge>{member.role}</Badge>
            <Badge>{member.status}</Badge>
          </div>
          {conflict && (
            <div className="card space-y-3 border-amber-500 p-4">
              <p>इस सदस्य में दूसरे बदलाव आए हैं। अपना draft देखकर नए बदलाव लें; पुराना edit save नहीं होगा।</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setName(member.name);
                  setPhone(member.phone || '');
                  setTargets(targetInputs(member));
                  setBaseline(member.updatedAt);
                }}
              >
                नए बदलाव लें
              </Button>
            </div>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            <section className="card space-y-3 p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <MapPin className="size-4" /> पिछली दर्ज लोकेशन
              </h2>
              {loc ? (
                <>
                  <p>{safeTimeAgo(loc.capturedAt)}</p>
                  <p className="text-sm text-muted">{(loc as any).address || 'Address उपलब्ध नहीं'}</p>
                  <p className="text-sm">
                    {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)} · Accuracy: {loc.accuracy == null ? 'अज्ञात' : `±${Math.round(loc.accuracy)}m`}
                  </p>
                  <a className="text-sm text-brand" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}>
                    Maps में देखें ↗
                  </a>
                </>
              ) : (
                <p className="text-sm text-muted">कोई location record नहीं। Tracking केवल अनुमति वाली active shift में होती है।</p>
              )}
            </section>
            <section className="card space-y-3 p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <ShieldCheck className="size-4" /> KYC और समय
              </h2>
              <Badge>{member.kycStatus}</Badge>
              <p className="text-sm text-muted">Documents और review KYC module में उपलब्ध हैं।</p>
              <div className="flex flex-wrap gap-3">
                <Link className="text-brand" href={user?.role === 'SUPER_ADMIN' ? `/admin/kyc?agentId=${member.id}` : `/broker/kyc?member=${member.id}`}>
                  KYC खोलें →
                </Link>
                <Link className="text-brand" href={`${teamBase}/time-logging?memberId=${member.id}`}>
                  Time logging →
                </Link>
              </div>
            </section>
          </div>
          <form
            className="card space-y-5 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate({
                name: name.trim(),
                phone: phone.trim() || null,
                targets: Object.fromEntries(
                  Object.entries(targets)
                    .filter(([, value]) => value !== '')
                    .map(([key, value]) => [key, Number(value)]),
                ),
              });
            }}
          >
            <h2 className="font-bold">प्रोफाइल और मासिक लक्ष्य</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="नाम">
                <Input value={name} minLength={2} required disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="फोन">
                <Input value={phone} type="tel" disabled={!canEdit} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>
            <p className="text-sm text-muted">
              इस महीने Won: {member.fulfillment?.dealsWonMonth ?? 0} · मिली Leads: {(member.fulfillment as any)?.leadsReceivedMonth ?? 0} · Open Leads:{' '}
              {member.stats.openLeads}. खाली target को zero नहीं माना जाएगा।
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(labels).map(([key, label]) => (
                <Field label={label} key={key}>
                  <Input
                    type="number"
                    min={0}
                    max={key === 'commissionPct' ? 100 : undefined}
                    step="any"
                    placeholder="Not set"
                    value={targets[key]}
                    disabled={!canEdit}
                    onChange={(e) => setTargets((old) => ({ ...old, [key]: e.target.value }))}
                  />
                </Field>
              ))}
            </div>
            {canEdit && (
              <Button type="submit" loading={update.isPending} disabled={busy || conflict || invalid || name.trim().length < 2}>
                <Save className="mr-2 size-4" /> बदलाव सेव करें
              </Button>
            )}
          </form>
          {canEdit && user?.id !== member.id && (
            <div className="card flex flex-wrap gap-3 p-5">
              {user.role === 'BROKER_ADMIN' && member.role !== 'BROKER_ADMIN' && (
                <Button variant="secondary" disabled={busy || conflict} onClick={() => {
                  setPermissions(member.delegatedPermissions ?? []);
                  setAction('delegate');
                }}>
                  {member.role === 'SUB_BROKER_ADMIN' ? 'Edit permissions' : 'Make Sub-Broker Admin'}
                </Button>
              )}
              <Button variant="secondary" disabled={busy || conflict} onClick={() => setAction('role')}>
                {member.role === 'BROKER_ADMIN' ? 'Agent बनाएँ' : 'Admin बनाएँ'}
              </Button>
              <Button variant="secondary" disabled={busy || conflict} onClick={() => setAction('status')}>
                {member.status === 'ACTIVE' ? 'Suspend करें' : 'Reactivate करें'}
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => setAction('remove')}>
                Team से हटाएँ
              </Button>
            </div>
          )}
        </>
      )}
      <Dialog open={!!action} onOpenChange={(open) => !open && setAction(null)} title="Team action की पुष्टि">
        <p className="text-sm">
          {action === 'remove'
            ? `${member.name} की firm access समाप्त होगी और assigned काम unassigned होंगे। पहले जरूरी काम reassign करें।`
            : `${member.name} की भूमिका या status बदलने पर permissions और active sessions बदलेंगे।`}
        </p>
        {action === 'delegate' && <DelegatedPermissions value={permissions} onChange={setPermissions} />}
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setAction(null)}>
            रद्द करें
          </Button>
          <Button
            loading={busy}
            onClick={() =>
              action === 'remove'
                ? remove.mutate(undefined)
                : update.mutate(
                    action === 'delegate' ? { role: 'SUB_BROKER_ADMIN', delegatedPermissions: permissions } : action === 'role'
                      ? { role: member.role === 'BROKER_ADMIN' ? 'BROKER_AGENT' : 'BROKER_ADMIN' }
                      : { status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
                  )
            }
          >
            पुष्टि करें
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
