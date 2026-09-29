'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Briefcase } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Button } from '../ui/button';
import { Field, Input } from '../ui/field';
import { Badge } from '../ui/misc';

/** "Verified tenant": office email OTP (or approved ID) → brokers see a badge and reply faster. */
export function TenantVerifyCard() {
  const q = useQuery({ queryKey: ['tenant-profile'], queryFn: () => api<any>('/me/tenant-profile') });
  const [f, setF] = useState({ occupation: '', employer: '', email: '', code: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.data) setF((x) => ({ ...x, occupation: q.data.occupation ?? '', employer: q.data.employer ?? '', email: x.email || q.data.workEmail || '' }));
  }, [q.data]);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      q.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const d = q.data;
  return (
    <div className="card mt-6 space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold"><Briefcase className="size-5 text-brand-600" /> Verified tenant</h3>
        {d?.tenantVerifiedAt ? <Badge tone="success"><BadgeCheck className="size-3.5" /> Verified</Badge> : <Badge>Not verified</Badge>}
      </div>
      <p className="text-sm text-muted">Verified tenants की enquiries brokers को badge के साथ दिखती हैं और उन्हें जल्दी जवाब मिलता है। Office email से verify करें, या ऊपर Aadhaar/PAN upload करें।</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Occupation"><Input value={f.occupation} onChange={(e) => setF({ ...f, occupation: e.target.value })} placeholder="जैसे: Software engineer" /></Field>
        <Field label="Company"><Input value={f.employer} onChange={(e) => setF({ ...f, employer: e.target.value })} /></Field>
      </div>
      <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => api('/me/tenant-profile', { method: 'PATCH', body: { occupation: f.occupation || null, employer: f.employer || null } }), 'Saved')}>Save</Button>
      {!d?.workEmailVerifiedAt && (
        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_auto]">
          <Field label="Office email" hint="Gmail / Yahoo नहीं — company का email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@company.com" /></Field>
          <Button className="self-end" loading={busy} disabled={!f.email} onClick={() => run(async () => { await api('/me/work-email', { method: 'POST', body: { email: f.email } }); setSent(true); }, 'Code भेजा गया — email देखें')}>Code भेजें</Button>
          {sent && (
            <>
              <Field label="6-digit code"><Input inputMode="numeric" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} /></Field>
              <Button className="self-end" loading={busy} disabled={f.code.length !== 6} onClick={() => run(() => api('/me/work-email/verify', { method: 'POST', body: { code: f.code } }), 'Verified ✓')}>Verify</Button>
            </>
          )}
        </div>
      )}
      {d?.workEmailVerifiedAt && <p className="text-sm text-emerald-600">Office email verified: <span data-no-i18n>{d.workEmail}</span></p>}
    </div>
  );
}
