'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList } from 'lucide-react';
import { FURNISHING_LABELS, type Furnishing } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Chip, Field, Input, Select, Textarea } from '../ui/field';
import { useFlag } from '@/lib/config';

export interface RequirementPrefill {
  bedrooms?: number[];
  maxBudget?: number;
  localitySlugs?: string[];
}

/** "अपनी ज़रूरत बताएँ": tenant states BHK / budget / sectors → instant matches + alerts on new listings. */
export function RequirementDialog({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill?: RequirementPrefill }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const { data: locs } = useQuery({ queryKey: ['localities-all'], queryFn: () => api<any[]>('/public/localities', { auth: false }), staleTime: 600_000, enabled: open });
  const [f, setF] = useState({ name: '', phone: '', bedrooms: [] as number[], maxBudget: '', localityIds: [] as string[], furnishing: '', moveInBy: '', notes: '', shareWithBrokers: true });
  const [busy, setBusy] = useState(false);
  const [locQ, setLocQ] = useState('');
  useEffect(() => {
    if (!open) return;
    setF((x) => ({
      ...x,
      name: x.name || user?.name || '',
      phone: x.phone || user?.phone || '',
      bedrooms: prefill?.bedrooms?.length ? prefill.bedrooms : x.bedrooms,
      maxBudget: prefill?.maxBudget ? String(prefill.maxBudget) : x.maxBudget,
    }));
  }, [open, user, prefill]);
  useEffect(() => {
    if (open && locs && prefill?.localitySlugs?.length) setF((x) => ({ ...x, localityIds: locs.filter((l) => prefill.localitySlugs!.includes(l.slug)).map((l) => l.id) }));
  }, [open, locs, prefill]);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api<any>('/requirements', {
        method: 'POST',
        body: { name: f.name, phone: f.phone, bedrooms: f.bedrooms, maxBudget: f.maxBudget ? Number(f.maxBudget) : null, localityIds: f.localityIds, furnishing: f.furnishing || null, moveInBy: f.moveInBy || null, notes: f.notes || null, shareWithBrokers: f.shareWithBrokers },
      });
      qc.invalidateQueries({ queryKey: ['requirements'] });
      toast.success(`ज़रूरत save हुई — अभी ${r.matches.length} matching properties${f.shareWithBrokers && r.requirement.sharedOrgIds.length ? `, ${r.requirement.sharedOrgIds.length} brokers को भेजी` : ''}`);
      onClose();
      router.push(`/account/requirements?id=${r.requirement.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const shownLocs = (locs ?? []).filter((l) => !locQ || l.name.toLowerCase().includes(locQ.toLowerCase())).slice(0, 40);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="अपनी ज़रूरत बताएँ"
      description="जैसे ही मिलती property आएगी, हम आपको तुरंत बताएँगे।"
      footer={<Button onClick={submit} loading={busy} disabled={!f.name || !f.phone}>Save करें</Button>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="नाम" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Mobile" required><Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </div>
        <Field label="BHK">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((b) => (
              <Chip key={b} active={f.bedrooms.includes(b)} onClick={() => setF({ ...f, bedrooms: toggle(f.bedrooms, b) })}>{b === 4 ? '4+ BHK' : `${b} BHK`}</Chip>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Max rent (₹/month)"><Input inputMode="numeric" value={f.maxBudget} onChange={(e) => setF({ ...f, maxBudget: e.target.value.replace(/\D/g, '') })} placeholder="40000" /></Field>
          <Field label="Furnishing">
            <Select value={f.furnishing} onChange={(e) => setF({ ...f, furnishing: e.target.value })}>
              <option value="">कोई भी</option>
              {Object.entries(FURNISHING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="कब से चाहिए"><Input type="date" value={f.moveInBy} onChange={(e) => setF({ ...f, moveInBy: e.target.value })} /></Field>
        </div>
        <Field label="Sectors / इलाके" hint={f.localityIds.length ? `${f.localityIds.length} चुने` : 'खाली छोड़ें तो पूरा Gurgaon'}>
          <Input className="mb-2" placeholder="Sector खोजें…" value={locQ} onChange={(e) => setLocQ(e.target.value)} />
          <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
            {shownLocs.map((l) => (
              <Chip key={l.id} active={f.localityIds.includes(l.id)} onClick={() => setF({ ...f, localityIds: toggle(f.localityIds, l.id) })}>
                <span data-no-i18n>{l.name}</span>
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="और कुछ"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="जैसे: Metro के पास, pets allowed, family" /></Field>
        <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={f.shareWithBrokers} onChange={(e) => setF({ ...f, shareWithBrokers: e.target.checked })} />
          <span>मेरी ज़रूरत और नंबर इन इलाकों के <b>3 भरोसेमंद brokers</b> को भेजें, ताकि वे मिलती properties दिखा सकें। (बंद करने पर सिर्फ़ BrokerIQ alerts मिलेंगे)</span>
        </label>
      </div>
    </Dialog>
  );
}

/** Hidden while Super Admin has "tenant_requirements" switched off. */
export function RequirementButton(props: { prefill?: RequirementPrefill; variant?: 'primary' | 'secondary' | 'accent'; className?: string }) {
  return useFlag('tenant_requirements') ? <RequirementButtonInner {...props} /> : null;
}

/** Button that opens the requirement form (sends guests to login first). */
function RequirementButtonInner({ prefill, variant = 'secondary', className }: { prefill?: RequirementPrefill; variant?: 'primary' | 'secondary' | 'accent'; className?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} className={className} onClick={() => (user ? setOpen(true) : router.push(`/login?next=${encodeURIComponent(pathname)}`))}>
        <ClipboardList className="size-4" /> अपनी ज़रूरत बताएँ
      </Button>
      <RequirementDialog open={open} onClose={() => setOpen(false)} prefill={prefill} />
    </>
  );
}
