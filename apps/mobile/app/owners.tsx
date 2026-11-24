import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, KeyRound, MessageCircle, Phone, UserRound } from 'lucide-react-native';
import { formatINR, hasDelegatedAccess, whatsappLink } from '@brokeriq/shared';
import { api, captureAccountContext, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFlag } from '@/lib/config';
import { useApiMutation } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Chip, Empty, Header, Input, Loader, Row, Screen, Segmented, Sheet, Txt } from '@/ui';

const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400_000);

/** Landlord CRM + leases with renewal reminders (60 / 30 / 7 days before end). */
export default function Owners() {
  const [tab, setTab] = useState<'owners' | 'leases'>('owners');
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Owners & leases" subtitle="Lease ख़त्म होने से पहले reminder" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'owners', label: 'Owners' },
          { value: 'leases', label: 'Leases' },
        ]}
      />
      {tab === 'owners' ? <OwnerList /> : <Leases />}
    </Screen>
  );
}

type OwnerDraft = { id: string; name: string; phone: string; email?: string | null; notes?: string | null;
  _count: { listings: number }; tenancies: { id: string; endDate: string }[] };
type LeaseDraft = { id: string; tenantName: string; tenantPhone?: string | null; rent: number; startDate: string; endDate: string };

function OwnerList() {
  const { user } = useAuth();
  const canEdit = hasDelegatedAccess(user, 'owners', 'view', 'edit');
  const canDelete = ['BROKER_ADMIN', 'SUB_BROKER_ADMIN'].includes(user?.role ?? '') && hasDelegatedAccess(user, 'owners', 'view', 'delete');
  const [editing, setEditing] = useState<OwnerDraft | null>(null);
  const remove = useApiMutation((input: { id: string; context: ReturnType<typeof captureAccountContext> }) =>
    api('/broker/owners/' + input.id, { method: 'DELETE', ownerContext: input.context }),
  { success: 'Owner deleted', invalidate: [['owners']] });
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['owners', q], queryFn: () => api<OwnerDraft[]>(`/broker/owners${q ? `?q=${encodeURIComponent(q)}` : ''}`) });
  const reportsOn = useFlag('owner_reports');
  // Owner report: read-only page for the landlord (views, enquiries, visits); sent on WhatsApp.
  const report = useApiMutation(
    (o: { id: string; name: string; phone: string }) => post<{ url: string }>(`/broker/owners/${o.id}/report-link`).then((r) => ({ ...r, o })),
    {
      onSuccess: ({ url, o }) => Linking.openURL(whatsappLink(o.phone, `नमस्ते ${o.name} जी, आपकी property की report यहाँ देखें: ${url}`)),
    },
  );
  return (
    <>
      <Input placeholder="नाम या number…" value={q} onChangeText={setQ} containerStyle={{ marginTop: 12 }} />
      {list.isLoading ? (
        <Loader />
      ) : !list.data?.length ? (
        <Empty
          icon={<UserRound size={26} color={c.brand} />}
          title="अभी कोई owner नहीं"
          text="Listings में owner का नाम और number भरें — वो यहाँ अपने-आप आ जाएँगे।"
        />
      ) : (
        list.data.map((o) => (
          <Card key={o.id} style={{ padding: 14, gap: 6, marginTop: 10 }}>
            <Txt v="bodyStrong">{o.name}</Txt>
            <Txt v="small" color="muted">
              {o.phone}
            </Txt>
            <Row wrap>
              <Badge label={`${o._count.listings} listings`} color={c.brand} />
              {o.tenancies[0] && (
                <Badge label={`Lease ${daysLeft(o.tenancies[0].endDate)} दिन`} color={daysLeft(o.tenancies[0].endDate) <= 30 ? c.warning : c.success} />
              )}
            </Row>
            <Row>
              <Button title="Call" size="sm" variant="secondary" icon={<Phone size={14} color={c.fg} />} onPress={() => Linking.openURL(`tel:${o.phone}`)} />
              <Button
                title="WhatsApp"
                size="sm"
                variant="whatsapp"
                icon={<MessageCircle size={14} color="#fff" />}
                onPress={() => Linking.openURL(whatsappLink(o.phone, `नमस्ते ${o.name} जी,`))}
              />
              {reportsOn && (
                <Button title="Report link" size="sm" variant="ghost" icon={<FileBarChart size={14} color={c.brand} />} onPress={() => report.mutate(o)} />
              )}
            </Row>
            {(canEdit || canDelete) && <Row wrap>
              {canEdit && <Button title="Edit owner" size="sm" variant="secondary" onPress={() => setEditing(o)} />}
              {canDelete && !o._count.listings && !o.tenancies.length && <Button title="Delete owner" size="sm" variant="danger" loading={remove.isPending}
                onPress={() => {
                  const context = captureAccountContext();
                  Alert.alert('Delete this owner contact?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => remove.mutate({ id: o.id, context }) },
                  ]);
                }} />}
            </Row>}
          </Card>
        ))
      )}
      {editing && <OwnerEditSheet key={editing.id} owner={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function OwnerEditSheet({ owner, onClose }: { owner: OwnerDraft; onClose: () => void }) {
  const [form, setForm] = useState({ name: owner.name, phone: owner.phone, email: owner.email ?? '', notes: owner.notes ?? '' });
  const save = useApiMutation(() => patch('/broker/owners/' + owner.id, { ...form, email: form.email || null, notes: form.notes || null }),
    { success: 'Owner updated', invalidate: [['owners']], onSuccess: onClose });
  return <Sheet open title="Edit owner" onClose={onClose}>
    <Input label="Name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
    <Input label="Mobile" keyboardType="phone-pad" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} />
    <Input label="Email" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(email) => setForm({ ...form, email })} />
    <Input label="Notes" value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} />
    <Button title="Save" loading={save.isPending} disabled={!form.name.trim() || !form.phone.trim()} onPress={() => save.mutate(undefined)} />
  </Sheet>;
}

function Leases() {
  const { user } = useAuth();
  const canEdit = hasDelegatedAccess(user, 'owners', 'view', 'edit');
  const canEnd = hasDelegatedAccess(user, 'owners', 'view', 'delete');
  const [editing, setEditing] = useState<LeaseDraft | null>(null);
  const { c } = useTheme();
  const list = useQuery({ queryKey: ['tenancies'], queryFn: () => api<any[]>('/broker/tenancies') });
  const renew = useApiMutation((id: string) => patch(`/broker/tenancies/${id}`, { renewMonths: 11 }), {
    success: 'Lease renew हुआ',
    invalidate: [['tenancies']],
  });
  const end = useApiMutation((input: { id: string; context: ReturnType<typeof captureAccountContext> }) =>
    api('/broker/tenancies/' + input.id, { method: 'PATCH', body: { status: 'ENDED' }, ownerContext: input.context }), { success: 'Lease बंद', invalidate: [['tenancies']] });
  const rentOn = useFlag('rent_tracker');
  const inspectOn = useFlag('inspections');
  const [payFor, setPayFor] = useState<any>(null);
  if (list.isLoading) return <Loader />;
  if (!list.data?.length)
    return <Empty icon={<KeyRound size={26} color={c.brand} />} title="अभी कोई lease नहीं" text="Rent deal close करने पर lease अपने-आप बनता है (11 महीने)।" />;
  return (
    <>
      {list.data.map((t) => {
        const left = daysLeft(t.endDate);
        return (
          <Card key={t.id} style={{ padding: 14, gap: 6, marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {t.tenantName}
              </Txt>
              <Badge
                label={t.status === 'ACTIVE' ? (left >= 0 ? `${left} दिन बाकी` : 'ख़त्म') : t.status}
                color={t.status !== 'ACTIVE' ? c.muted : left <= 30 ? c.warning : c.success}
              />
            </Row>
            <Txt v="small" color="muted" numberOfLines={1}>{`${t.listing?.title ?? 'Property'} · ${formatINR(t.rent)}/month`}</Txt>
            <Txt v="caption" color="subtle">{`${new Date(t.startDate).toLocaleDateString('en-IN')} → ${new Date(t.endDate).toLocaleDateString('en-IN')}`}</Txt>
            {t.status === 'ACTIVE' && (
              <Row wrap>
                {rentOn && <Button title="किराया मिला" size="sm" onPress={() => setPayFor(t)} />}
                {inspectOn && <Button title="Checklist" size="sm" variant="secondary" onPress={() => router.push(`/inspection/${t.id}`)} />}
                {canEdit && <>
                  <Button title="Renew (11 महीने)" size="sm" variant="secondary" onPress={() => renew.mutate(t.id)} />
                  <Button title="Edit lease" size="sm" variant="secondary" onPress={() => setEditing(t)} />
                </>}
                {canEnd && <Button title="बंद करें" size="sm" variant="ghost" onPress={() => {
                  const context = captureAccountContext();
                  Alert.alert('End this lease?', 'The lease history will be kept.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'End lease', style: 'destructive', onPress: () => end.mutate({ id: t.id, context }) },
                  ]);
                }} />}
              </Row>
            )}
          </Card>
        );
      })}
      <RentPaidSheet tenancy={payFor} onClose={() => setPayFor(null)} />
      {editing && <LeaseEditSheet key={editing.id} lease={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function LeaseEditSheet({ lease, onClose }: { lease: LeaseDraft; onClose: () => void }) {
  const [form, setForm] = useState({ tenantName: lease.tenantName, tenantPhone: lease.tenantPhone ?? '', rent: String(lease.rent),
    startDate: lease.startDate.slice(0, 10), endDate: lease.endDate.slice(0, 10) });
  const save = useApiMutation(() => patch('/broker/tenancies/' + lease.id,
    { ...form, rent: Number(form.rent), tenantPhone: form.tenantPhone || null }),
  { success: 'Lease updated', invalidate: [['tenancies'], ['owners']], onSuccess: onClose });
  return <Sheet open title="Edit lease" onClose={onClose}>
    <Input label="Tenant name" value={form.tenantName} onChangeText={(tenantName) => setForm({ ...form, tenantName })} />
    <Input label="Mobile" keyboardType="phone-pad" value={form.tenantPhone} onChangeText={(tenantPhone) => setForm({ ...form, tenantPhone })} />
    <Input label="Monthly rent (₹)" keyboardType="numeric" value={form.rent} onChangeText={(rent) => setForm({ ...form, rent: rent.replace(/[^\d.]/g, '') })} />
    <Input label="Start date (YYYY-MM-DD)" value={form.startDate} onChangeText={(startDate) => setForm({ ...form, startDate })} />
    <Input label="End date (YYYY-MM-DD)" value={form.endDate} onChangeText={(endDate) => setForm({ ...form, endDate })} />
    <Button title="Save" loading={save.isPending} disabled={!form.tenantName.trim() || !form.rent || !Number.isFinite(Number(form.rent)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(form.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(form.endDate)} onPress={() => save.mutate(undefined)} />
  </Sheet>;
}

const istMonth = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 7);

/** Mark this month's rent received → tenant gets the receipt (app + email). */
function RentPaidSheet({ tenancy, onClose }: { tenancy: any | null; onClose: () => void }) {
  const [f, setF] = useState({ amount: '', mode: 'UPI', reference: '' });
  const month = istMonth();
  const save = useApiMutation(
    () =>
      post<any>(`/broker/tenancies/${tenancy.id}/rent-payments`, {
        month,
        amount: Number(f.amount || tenancy.rent),
        mode: f.mode,
        reference: f.reference || null,
      }),
    {
      success: 'Paid mark हुआ — tenant को receipt भेज दी',
      onSuccess: (r) => (onClose(), setF({ amount: '', mode: 'UPI', reference: '' }), Linking.openURL(r.receiptUrl)),
    },
  );
  return (
    <Sheet
      open={!!tenancy}
      onClose={onClose}
      title={`${new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })} का किराया`}
    >
      <Input
        label="Amount (₹)"
        placeholder={tenancy ? String(tenancy.rent) : ''}
        value={f.amount}
        onChangeText={(v) => setF({ ...f, amount: v.replace(/\D/g, '') })}
        keyboardType="number-pad"
      />
      <Row wrap style={{ marginTop: 10 }}>
        {['UPI', 'BANK', 'CASH', 'CHEQUE'].map((m) => (
          <Chip key={m} label={m} active={f.mode === m} onPress={() => setF({ ...f, mode: m })} />
        ))}
      </Row>
      <Input label="Ref / UTR (optional)" value={f.reference} onChangeText={(v) => setF({ ...f, reference: v })} containerStyle={{ marginTop: 10 }} />
      <Button title="Paid mark करें + receipt" full loading={save.isPending} onPress={() => save.mutate(undefined)} style={{ marginTop: 12 }} />
    </Sheet>
  );
}
