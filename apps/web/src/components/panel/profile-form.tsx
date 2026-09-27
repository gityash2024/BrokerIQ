'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Camera, Clock, FileUp, ShieldCheck, XCircle } from 'lucide-react';
import { api, compressImage, errorMessage, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Button } from '../ui/button';
import { Field, Input, Select } from '../ui/field';
import { Avatar, Badge } from '../ui/misc';

export function ProfileForm() {
  const { user, refreshMe } = useAuth();
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api('/me', { method: 'PATCH', body: { name: f.name, phone: f.phone || null } });
      await refreshMe();
      toast.success('Profile update हो गया');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const avatar = async (file?: File) => {
    if (!file) return;
    try {
      const { url } = await uploadFile(await compressImage(file, 600), 'avatar');
      await api('/me', { method: 'PATCH', body: { avatarUrl: url } });
      await refreshMe();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const changePw = async () => {
    try {
      await api('/auth/password/change', { method: 'POST', body: pw });
      toast.success('Password बदल गया');
      setPw({ currentPassword: '', newPassword: '' });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h2 className="font-display text-lg font-bold">Profile</h2>
        <div className="mt-5 flex items-center gap-4">
          <label className="group relative cursor-pointer">
            <Avatar name={user?.name} src={user?.avatarUrl} size={72} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
              <Camera className="size-5" />
            </span>
            <input type="file" accept="image/*" hidden onChange={(e) => avatar(e.target.files?.[0])} />
          </label>
          <div>
            <p className="font-semibold">{user?.email}</p>
            {user?.emailVerified ? <Badge tone="success"><BadgeCheck className="size-3" /> Email verified</Badge> : <Badge tone="warning">Email not verified</Badge>}
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <Field label="नाम">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Mobile" hint="Enquiries और chat के लिए ज़रूरी">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Button onClick={save} loading={saving}>Save</Button>
        </div>
      </div>
      <div className="space-y-6">
        <div className="card p-6">
          <h2 className="font-display text-lg font-bold">Password</h2>
          <div className="mt-4 space-y-3">
            <Input type="password" placeholder="Current password (अगर set है)" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            <Input type="password" placeholder="नया password (8+ अक्षर)" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            <Button variant="secondary" onClick={changePw} disabled={pw.newPassword.length < 8}>Update password</Button>
          </div>
        </div>
        <KycCard />
      </div>
    </div>
  );
}

export function KycCard({ broker }: { broker?: boolean }) {
  const q = useQuery({ queryKey: ['kyc'], queryFn: () => api<any[]>('/kyc/mine') });
  const [docType, setDocType] = useState(broker ? 'RERA_CERTIFICATE' : 'OWNERSHIP_PROOF');
  const [docNumber, setDocNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const { url } = await uploadFile(file.type.startsWith('image/') ? await compressImage(file) : file, 'kyc');
      await api('/kyc', { method: 'POST', body: { docType, fileUrl: url, docNumber: docNumber || null } });
      toast.success('Document review के लिए भेज दिया गया');
      q.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <ShieldCheck className="size-5 text-emerald-500" /> Verification (KYC)
      </h2>
      <p className="mt-1 text-sm text-muted">{broker ? 'RERA / GST document upload करें — verified badge से 3x ज़्यादा trust और leads।' : 'Ownership proof से आपकी listings पर “Verified” badge लगेगा।'}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
          {(broker ? ['RERA_CERTIFICATE', 'GST_CERTIFICATE', 'PAN', 'AADHAAR', 'OTHER'] : ['OWNERSHIP_PROOF', 'ELECTRICITY_BILL', 'AADHAAR', 'PAN', 'OTHER']).map((d) => (
            <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
          ))}
        </Select>
        <Input placeholder="Document number (optional)" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
      </div>
      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-4 text-sm font-semibold text-muted hover:border-brand-400">
        <FileUp className="size-4" /> {busy ? 'Uploading…' : 'Document upload करें (image / PDF)'}
        <input type="file" hidden accept="image/*,application/pdf" onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      {q.data && q.data.length > 0 && (
        <div className="mt-4 space-y-2">
          {q.data.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">{d.docType.replace(/_/g, ' ')}</a>
              <span className="flex items-center gap-1 text-xs">
                {d.status === 'VERIFIED' ? <BadgeCheck className="size-4 text-emerald-500" /> : d.status === 'REJECTED' ? <XCircle className="size-4 text-rose-500" /> : <Clock className="size-4 text-amber-500" />}
                {d.status} · {formatDate(d.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
