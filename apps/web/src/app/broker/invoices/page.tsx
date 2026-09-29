'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Copy, FileText, Plus, Send, Settings2, Trash2 } from 'lucide-react';
import { formatINR, whatsappLink } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { patch, post, useApiMutation } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Badge, Empty, Skeleton, Switch } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';

const TONE: Record<string, any> = { DRAFT: 'neutral', SENT: 'warning', PAID: 'success', CANCELLED: 'neutral' };

function InvoicesInner() {
  const sp = useSearchParams();
  const { user } = useAuth();
  const admin = user?.role === 'BROKER_ADMIN';
  const [status, setStatus] = useState('');
  const [create, setCreate] = useState<boolean>(!!sp.get('deal'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paying, setPaying] = useState<any>(null);
  const list = useQuery({ queryKey: ['invoices', status], queryFn: () => api<any[]>(`/broker/invoices${status ? `?status=${status}` : ''}`) });
  const settings = useQuery({ queryKey: ['payment-settings'], queryFn: () => api<any>('/broker/payment-settings') });
  const send = async (id: string) => {
    try {
      const r = await post<any>(`/broker/invoices/${id}/send`);
      if (r.whatsapp || r.email) toast.success(`Invoice भेजा गया${r.whatsapp ? ' (WhatsApp)' : ''}${r.email ? ' (Email)' : ''}`);
      else window.open(whatsappLink('', r.text), '_blank');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const total = (list.data ?? []).filter((i) => i.status === 'SENT').reduce((s, i) => s + i.total, 0);
  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Brokerage invoice बनाएँ, client को WhatsApp पर भेजें — client सीधे आपके UPI पर pay करता है"
        actions={
          <div className="flex gap-2">
            {admin && <Button size="sm" variant="secondary" onClick={() => setSettingsOpen(true)}><Settings2 className="size-4" /> UPI settings</Button>}
            <Button size="sm" onClick={() => setCreate(true)}><Plus className="size-4" /> नया invoice</Button>
          </div>
        }
      />
      {settings.data && !settings.data.upiId && (
        <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          अपना UPI ID जोड़ें ताकि invoice पर "UPI से pay करें" बटन और QR दिखे। {admin && <button className="font-semibold underline" onClick={() => setSettingsOpen(true)}>अभी जोड़ें</button>}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={status} onChange={setStatus} options={[{ value: '', label: 'All' }, { value: 'SENT', label: 'Pending' }, { value: 'PAID', label: 'Paid' }, { value: 'CANCELLED', label: 'Cancelled' }]} />
        {total > 0 && <span className="text-sm text-muted">Pending: <b className="text-fg">{formatINR(total)}</b></span>}
      </div>
      {list.isLoading ? (
        <Skeleton className="h-48" />
      ) : !list.data?.length ? (
        <Empty icon={<FileText className="size-6" />} title="अभी कोई invoice नहीं" text="Deal close होने पर brokerage का invoice बनाइए।" action={<Button onClick={() => setCreate(true)}>Invoice बनाएँ</Button>} />
      ) : (
        <div className="space-y-3">
          {list.data.map((i) => (
            <div key={i.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold">{i.number}</span>
                  <Badge tone={TONE[i.status]}>{i.status === 'SENT' ? (i.dueDate && new Date(i.dueDate) < new Date() ? 'Overdue' : 'Pending') : i.status}</Badge>
                </div>
                <p className="mt-1 text-sm"><span data-no-i18n>{i.clientName}</span> · <b>{formatINR(i.total)}</b>{i.dueDate ? ` · due ${formatDate(i.dueDate)}` : ''}</p>
                {i.status === 'PAID' && <p className="text-xs text-emerald-600">Paid {i.paidAt ? formatDate(i.paidAt) : ''}{i.paidMode ? ` · ${i.paidMode}` : ''}{i.paidRef ? ` · ${i.paidRef}` : ''}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={async () => { const d = await api<any>(`/broker/invoices/${i.id}`); await navigator.clipboard.writeText(d.link); toast.success('Link copy हो गया'); }}><Copy className="size-4" /> Link</Button>
                {i.status === 'SENT' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => send(i.id)}><Send className="size-4" /> भेजें</Button>
                    <Button size="sm" onClick={() => setPaying(i)}><CheckCircle2 className="size-4" /> Paid</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <CreateInvoice open={create} dealId={sp.get('deal')} onClose={() => setCreate(false)} />
      <PaymentSettings open={settingsOpen} data={settings.data} onClose={() => setSettingsOpen(false)} />
      <MarkPaid inv={paying} onClose={() => setPaying(null)} />
    </>
  );
}

function CreateInvoice({ open, dealId, onClose }: { open: boolean; dealId: string | null; onClose: () => void }) {
  const deals = useQuery({ queryKey: ['deals-for-invoice'], queryFn: () => api<any[]>('/deals'), enabled: open });
  const [f, setF] = useState({ dealId: dealId ?? '', clientName: '', clientPhone: '', clientEmail: '', gstPct: '0', dueDate: '', notes: '' });
  const [items, setItems] = useState([{ description: 'Brokerage', amount: '' }]);
  useEffect(() => {
    const d = deals.data?.find((x: any) => x.id === f.dealId);
    if (d) {
      setF((x) => ({ ...x, clientName: x.clientName || d.lead?.name || '', clientPhone: x.clientPhone || d.lead?.phone || '' }));
      if (!items[0].amount && d.commissionAmount) setItems([{ description: `Brokerage — ${d.title}`, amount: String(Math.round(d.commissionAmount)) }]);
    }
  }, [f.dealId, deals.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useApiMutation(
    () =>
      post('/broker/invoices', {
        dealId: f.dealId || undefined,
        clientName: f.clientName,
        clientPhone: f.clientPhone || undefined,
        clientEmail: f.clientEmail || undefined,
        gstPct: Number(f.gstPct) || 0,
        dueDate: f.dueDate || undefined,
        notes: f.notes || undefined,
        items: items.filter((i) => i.description && i.amount).map((i) => ({ description: i.description, amount: Number(i.amount) })),
      }),
    { success: 'Invoice बन गया', invalidate: [['invoices']], onSuccess: () => onClose() },
  );
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} size="lg" title="नया invoice" footer={<Button onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!f.clientName || !items.some((i) => i.amount)}>Invoice बनाएँ</Button>}>
      <div className="space-y-4">
        <Field label="Deal (optional)">
          <Select value={f.dealId} onChange={(e) => setF({ ...f, dealId: e.target.value })}>
            <option value="">— बिना deal —</option>
            {(deals.data ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.title} · {formatINR(d.dealValue)}</option>)}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Client का नाम" required><Input value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} /></Field>
          <Field label="Mobile"><Input inputMode="tel" value={f.clientPhone} onChange={(e) => setF({ ...f, clientPhone: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={f.clientEmail} onChange={(e) => setF({ ...f, clientEmail: e.target.value })} /></Field>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-2">
              <Input className="flex-1" placeholder="Description" value={it.description} onChange={(e) => setItems(items.map((x, j) => (j === idx ? { ...x, description: e.target.value } : x)))} />
              <Input className="w-36" inputMode="numeric" placeholder="₹" value={it.amount} onChange={(e) => setItems(items.map((x, j) => (j === idx ? { ...x, amount: e.target.value.replace(/[^\d.]/g, '') } : x)))} />
              {items.length > 1 && <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, j) => j !== idx))}><Trash2 className="size-4" /></Button>}
            </div>
          ))}
          <Button size="xs" variant="ghost" onClick={() => setItems([...items, { description: '', amount: '' }])}><Plus className="size-3.5" /> Item</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="GST %"><Select value={f.gstPct} onChange={(e) => setF({ ...f, gstPct: e.target.value })}><option value="0">No GST</option><option value="18">18%</option></Select></Field>
          <Field label="Due date"><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

function PaymentSettings({ open, data, onClose }: { open: boolean; data: any; onClose: () => void }) {
  const [f, setF] = useState({ upiId: '', upiName: '', invoicePrefix: '', weeklyReport: true });
  useEffect(() => {
    if (data) setF({ upiId: data.upiId ?? '', upiName: data.upiName ?? '', invoicePrefix: data.invoicePrefix ?? '', weeklyReport: data.weeklyReport !== false });
  }, [data]);
  const save = useApiMutation(() => patch('/broker/payment-settings', f), { success: 'Saved', invalidate: [['payment-settings']], onSuccess: () => onClose() });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title="UPI & invoice settings" footer={<Button onClick={() => save.mutate(undefined)} loading={save.isPending}>Save</Button>}>
      <div className="space-y-3">
        <Field label="UPI ID" hint="जैसे sharmarealty@okicici — client का पैसा सीधे इसी पर आएगा"><Input value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value.trim() })} /></Field>
        <Field label="UPI पर दिखने वाला नाम"><Input value={f.upiName} onChange={(e) => setF({ ...f, upiName: e.target.value })} /></Field>
        <Field label="Invoice number prefix" hint="जैसे SR → SR-0001"><Input value={f.invoicePrefix} onChange={(e) => setF({ ...f, invoicePrefix: e.target.value.toUpperCase() })} /></Field>
        <label className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
          <Switch checked={f.weeklyReport} onCheckedChange={(x) => setF({ ...f, weeklyReport: x })} />
          <span className="text-sm font-medium">हर सोमवार हफ़्ते की report (leads, visits, deals)</span>
        </label>
      </div>
    </Dialog>
  );
}

function MarkPaid({ inv, onClose }: { inv: any; onClose: () => void }) {
  const [f, setF] = useState({ paidMode: 'UPI', paidRef: '' });
  const save = useApiMutation(() => patch(`/broker/invoices/${inv.id}`, { status: 'PAID', ...f }), { success: 'Paid mark हुआ', invalidate: [['invoices'], ['deals']], onSuccess: () => onClose() });
  return (
    <Dialog open={!!inv} onOpenChange={(v) => !v && onClose()} title={`${inv?.number ?? ''} — payment मिला`} footer={<Button onClick={() => save.mutate(undefined)} loading={save.isPending}>Paid mark करें</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="कैसे मिला"><Select value={f.paidMode} onChange={(e) => setF({ ...f, paidMode: e.target.value })}>{['UPI', 'Cash', 'Bank transfer', 'Cheque'].map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Reference (UTR / cheque no.)"><Input value={f.paidRef} onChange={(e) => setF({ ...f, paidRef: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesInner />
    </Suspense>
  );
}
