'use client';
import { BackButton } from '@/components/ui/back-button';
import { useState } from 'react';
import { roleModulePermissions, delegatedGrant } from '@brokeriq/shared';
import { useConfig, useConfigStatus } from '@/lib/config';
import { Link2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { CopyField } from '@/components/panel/integration-card';
import { PageHeader } from '@/components/panel/shell';
import { DelegatedPermissions } from '@/components/broker/team/delegated-permissions';
import { post, useApiMutation } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';

export default function InvitePage() {
  const { user } = useAuth();
  const [f, setF] = useState({ name: '', email: '', role: 'BROKER_AGENT' });
  const [selection, setPermissions] = useState<string[] | null>(null);
  const { modules } = useConfig();
  const { loaded } = useConfigStatus();
  const permissions = selection ?? roleModulePermissions(modules, f.role).flatMap(({ key, actions }) =>
    actions.map((action) => delegatedGrant(key, action)));
  const [result, setResult] = useState<{ link: string; emailed: boolean } | null>(null);
  const send = useApiMutation(
    () =>
      post<{ link: string; emailed: boolean }>('/broker/team/invite', {
        ...f,
        ...(f.role === 'SUB_BROKER_ADMIN' ? { delegatedPermissions: permissions } : {}),
        ...(['BROKER_ADMIN', 'BROKER_AGENT'].includes(f.role) && selection !== null ? { rolePermissions: selection } : {}),
      }),
    {
      invalidate: [['team']],
      onSuccess: (r) => {
        setResult(r);
        toast.success(r.emailed ? 'Invite email भेज दी गई' : 'Invite बन गया — link share करें');
      },
    },
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Invite Team Member"
        subtitle="Invite link is valid for 7 days"
        actions={
          <BackButton variant="secondary" href="/broker/team">
            Back to team
          </BackButton>
        }
      />
      {user?.role === 'BROKER_ADMIN' ? (
        <section className="card mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
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
                <Select value={f.role} onChange={(e) => { setF({ ...f, role: e.target.value }); setPermissions(null); }}>
                  <option value="BROKER_AGENT">Agent</option>
                  <option value="BROKER_ADMIN">Admin</option>
                  <option value="SUB_BROKER_ADMIN">Sub-Broker Admin</option>
                  <option value="PROPERTY_OWNER">Property Owner</option>
                </Select>
              </Field>
              {f.role !== 'PROPERTY_OWNER' && <DelegatedPermissions role={f.role} value={permissions} onChange={setPermissions} />}
            </div>
          )}
          {!result && (
            <Button loading={send.isPending} disabled={!f.name || !f.email || (f.role !== 'PROPERTY_OWNER' && !loaded)} onClick={() => send.mutate(undefined)}>
              <Send className="size-4" /> Send invite
            </Button>
          )}
        </section>
      ) : (
        <p role="alert">Broker Admin access required.</p>
      )}
    </div>
  );
}
