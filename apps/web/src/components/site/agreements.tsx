'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, ExternalLink, FileSignature, PenLine, Plus } from 'lucide-react';
import { formatINR } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '../ui/button';
import { Field, Input, Select, Textarea } from '../ui/field';
import { Dialog } from '../ui/dialog';
import { Badge, Empty, Skeleton } from '../ui/misc';
import { useFlag } from '@/lib/config';

const STEPS = [
  [
    'Haryana e-stamp paper',
    'egrashry.nic.in पर "e-Stamp" से stamp duty भरें और e-stamp paper निकलवाएँ (11 महीने के agreement पर आम तौर पर कम duty लगती है)।',
    'https://egrashry.nic.in',
  ],
  ['Print और sign', 'नीचे वाला draft e-stamp paper पर print करें। दोनों पक्ष और 2 गवाह हर page पर sign करें।', null],
  ['Police verification', 'Tenant की police verification Haryana Police की Harsamay service से online करवाएँ।', 'https://harsamay.gov.in'],
] as const;

/** Draft 11-month rent agreement → PDF, plus the Haryana e-stamp / police verification steps. */
export function Agreements() {
  const q = useQuery({ queryKey: ['agreements'], queryFn: () => api<any[]>('/agreements') });
  const [open, setOpen] = useState(false);
  const [sign, setSign] = useState<any>(null);
  const esignOn = useFlag('agreement_esign');
  const download = async (id: string) => {
    try {
      const { url } = await api<{ url: string }>(`/agreements/${id}/link`, { method: 'POST' });
      window.location.href = url; // attachment download — stays on this page
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {STEPS.map(([t, d, link], i) => (
          <div key={t} className="card p-4 text-sm">
            <p className="font-semibold">
              {i + 1}. {t}
            </p>
            <p className="mt-1 text-muted">{d}</p>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
                खोलें <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        ))}
      </div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> नया agreement
        </Button>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-32" />
      ) : !q.data?.length ? (
        <Empty
          icon={<FileSignature className="size-6" />}
          title="अभी कोई agreement नहीं"
          text="Details भरें — 11 महीने का draft PDF तुरंत बनेगा।"
          action={<Button onClick={() => setOpen(true)}>Agreement बनाएँ</Button>}
        />
      ) : (
        <div className="space-y-3">
          {q.data.map((a) => (
            <div key={a.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold" data-no-i18n>
                  {a.landlordName} → {a.tenantName}
                </p>
                <p className="truncate text-sm text-muted">
                  <span data-no-i18n>{a.propertyAddress}</span> · {formatINR(a.rent)}/month · {formatDate(a.startDate)} से {a.months} महीने
                </p>
                {a.signStatus !== 'DRAFT' && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(a.signatures ?? []).map((s: any) => (
                      <Badge key={s.party} tone={s.signedAt ? 'success' : 'warning'}>
                        {s.party === 'LANDLORD' ? 'Landlord' : 'Tenant'} {s.signedAt ? '✓ signed' : 'pending'}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {esignOn && a.signStatus !== 'SIGNED' && (
                  <Button size="sm" onClick={() => setSign(a)}>
                    <PenLine className="size-4" /> {a.signStatus === 'SIGNING' ? 'दोबारा भेजें' : 'OTP से sign करवाएँ'}
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => download(a.id)}>
                  <Download className="size-4" /> PDF
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-subtle">यह एक standard template है, legal सलाह नहीं। ज़रूरत हो तो किसी वकील से जाँच करवाएँ।</p>
      <AgreementDialog open={open} onClose={() => setOpen(false)} onSaved={(id) => (q.refetch(), download(id))} />
      <SignDialog agreement={sign} onClose={() => setSign(null)} onSent={() => q.refetch()} />
    </>
  );
}

function AgreementDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState<Record<string, string>>({
    landlordName: '',
    landlordAddress: '',
    landlordPhone: '',
    tenantName: '',
    tenantAddress: '',
    tenantPhone: '',
    propertyAddress: '',
    rent: '',
    deposit: '',
    maintenance: '',
    startDate: '',
    lockInMonths: '0',
    noticeMonths: '1',
    escalationPct: '0',
    furnishing: '',
    extra: '',
  });
  const [busy, setBusy] = useState(false);
  const n = (k: string) => (f[k] ? Number(f[k]) : undefined);
  const save = async () => {
    setBusy(true);
    try {
      const a = await api<any>('/agreements', {
        method: 'POST',
        body: {
          landlordName: f.landlordName,
          landlordAddress: f.landlordAddress || undefined,
          landlordPhone: f.landlordPhone || undefined,
          tenantName: f.tenantName,
          tenantAddress: f.tenantAddress || undefined,
          tenantPhone: f.tenantPhone || undefined,
          propertyAddress: f.propertyAddress,
          rent: n('rent'),
          deposit: n('deposit') ?? 0,
          maintenance: n('maintenance'),
          startDate: f.startDate,
          lockInMonths: n('lockInMonths') ?? 0,
          noticeMonths: n('noticeMonths') ?? 1,
          escalationPct: n('escalationPct') ?? 0,
          furnishing: f.furnishing || undefined,
          extraClauses: f.extra
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean),
        },
      });
      toast.success('Agreement बन गया');
      onClose();
      onSaved(a.id);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const inp = (k: string, label: string, props: Record<string, any> = {}) => (
    <Field label={label}>
      <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </Field>
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="Rent agreement (11 महीने)"
      footer={
        <Button onClick={save} loading={busy} disabled={!f.landlordName || !f.tenantName || !f.propertyAddress || !f.rent || !f.startDate}>
          PDF बनाएँ
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {inp('landlordName', 'Owner (Licensor) का नाम')}
        {inp('landlordPhone', 'Owner mobile')}
        <div className="sm:col-span-2">{inp('landlordAddress', 'Owner का पता')}</div>
        {inp('tenantName', 'Tenant (Licensee) का नाम')}
        {inp('tenantPhone', 'Tenant mobile')}
        <div className="sm:col-span-2">{inp('tenantAddress', 'Tenant का स्थायी पता')}</div>
        <div className="sm:col-span-2">{inp('propertyAddress', 'Property का पूरा पता')}</div>
        {inp('rent', 'Rent (₹/month)', { inputMode: 'numeric' })}
        {inp('deposit', 'Security deposit (₹)', { inputMode: 'numeric' })}
        {inp('maintenance', 'Maintenance (₹/month)', { inputMode: 'numeric' })}
        {inp('startDate', 'Start date', { type: 'date' })}
        {inp('lockInMonths', 'Lock-in (महीने)', { inputMode: 'numeric' })}
        {inp('noticeMonths', 'Notice period (महीने)', { inputMode: 'numeric' })}
        {inp('escalationPct', 'Renewal पर बढ़ोतरी (%)', { inputMode: 'numeric' })}
        <Field label="Furnishing">
          <Select value={f.furnishing} onChange={(e) => setF({ ...f, furnishing: e.target.value })}>
            <option value="">—</option>
            <option value="FULLY_FURNISHED">Fully furnished</option>
            <option value="SEMI_FURNISHED">Semi-furnished</option>
            <option value="UNFURNISHED">Unfurnished</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="और शर्तें (हर line एक)">
            <Textarea rows={3} value={f.extra} onChange={(e) => setF({ ...f, extra: e.target.value })} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

/** Sends both parties a link to read the agreement and confirm it with an OTP (email, or the firm's own WhatsApp when there is no email). */
function SignDialog({ agreement, onClose, onSent }: { agreement: any | null; onClose: () => void; onSent: () => void }) {
  const [f, setF] = useState({ landlordEmail: '', tenantEmail: '' });
  const [busy, setBusy] = useState(false);
  const reachable = (email: string, phone?: string | null) => !!email.trim() || !!phone;
  const send = async () => {
    setBusy(true);
    try {
      await api(`/agreements/${agreement.id}/sign`, { method: 'POST', body: f });
      toast.success('दोनों को sign link भेज दिया');
      onSent();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!agreement}
      onOpenChange={(v) => !v && onClose()}
      title="OTP से sign करवाएँ"
      description="Landlord और tenant को link जाएगा — agreement पढ़कर OTP से confirm करेंगे। Email न हो तो link और OTP आपकी firm के अपने WhatsApp से जाएँगे। Final PDF में confirmation certificate (समय, IP, SHA-256) जुड़ जाता है।"
      footer={
        <Button
          onClick={send}
          loading={busy}
          disabled={!agreement || !reachable(f.landlordEmail, agreement.landlordPhone) || !reachable(f.tenantEmail, agreement.tenantPhone)}
        >
          Link भेजें
        </Button>
      }
    >
      <div className="space-y-3">
        <Field
          label={`Landlord email${agreement ? ` (${agreement.landlordName})` : ''}`}
          hint={agreement?.landlordPhone ? `खाली छोड़ें तो WhatsApp ${agreement.landlordPhone} पर जाएगा` : undefined}
          required={!agreement?.landlordPhone}
        >
          <Input type="email" value={f.landlordEmail} onChange={(e) => setF({ ...f, landlordEmail: e.target.value })} data-no-i18n />
        </Field>
        <Field
          label={`Tenant email${agreement ? ` (${agreement.tenantName})` : ''}`}
          hint={agreement?.tenantPhone ? `खाली छोड़ें तो WhatsApp ${agreement.tenantPhone} पर जाएगा` : undefined}
          required={!agreement?.tenantPhone}
        >
          <Input type="email" value={f.tenantEmail} onChange={(e) => setF({ ...f, tenantEmail: e.target.value })} data-no-i18n />
        </Field>
        <p className="text-xs text-muted">Electronic confirmation सहमति का सबूत है; stamp duty / registration की जगह नहीं लेता।</p>
      </div>
    </Dialog>
  );
}
