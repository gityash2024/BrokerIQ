'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Building2, Camera, Rocket } from 'lucide-react';
import { api, compressImage, errorMessage, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Chip, Field, Input, Textarea } from '@/components/ui/field';
import { Avatar, Logo } from '@/components/ui/misc';
import type { LocalityListItem } from '@brokeriq/shared';

export default function Onboarding() {
  const { user, setSession } = useAuth();
  const router = useRouter();
  const { data: locs } = useQuery({ queryKey: ['localities-all'], queryFn: () => api<LocalityListItem[]>('/public/localities', { auth: false }) });
  const [f, setF] = useState({
    firmName: user?.organization?.name ?? '',
    phone: user?.phone ?? '',
    whatsapp: '',
    reraNumber: '',
    gstNumber: '',
    about: '',
    experienceYears: '',
    address: '',
    logoUrl: '',
    localityIds: [] as string[],
  });
  useEffect(() => {
    if (user) setF((x) => ({ ...x, firmName: x.firmName || user.organization?.name || '', phone: x.phone || user.phone || '' }));
  }, [user]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const logo = async (file?: File) => {
    if (!file) return;
    try {
      const { url } = await uploadFile(await compressImage(file, 600), 'logo');
      setF((x) => ({ ...x, logoUrl: url }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const submit = async () => {
    setLoading(true);
    try {
      const r = await api<any>('/broker/onboarding', {
        method: 'POST',
        body: {
          ...f,
          experienceYears: f.experienceYears ? Number(f.experienceYears) : null,
          logoUrl: f.logoUrl || null,
          whatsapp: f.whatsapp || null,
          reraNumber: f.reraNumber || null,
          gstNumber: f.gstNumber || null,
          website: '',
        },
      });
      setSession(r);
      toast.success('Setup पूरा! 🎉 अब leads connect करें');
      router.replace('/broker?welcome=1');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const toggle = (id: string) =>
    setF((x) => ({ ...x, localityIds: x.localityIds.includes(id) ? x.localityIds.filter((y) => y !== id) : [...x.localityIds, id].slice(0, 30) }));
  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-bg py-10 dark:from-brand-950/40">
      <div className="container-x max-w-3xl">
        <Logo />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card mt-8 p-6 sm:p-10">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white">
            <Building2 className="size-6" />
          </span>
          <h1 className="mt-4 font-display text-3xl font-extrabold">अपनी firm set up करें</h1>
          <p className="mt-1 text-muted">यह जानकारी आपकी public microsite और leads पर दिखेगी। बाद में Settings से बदल सकते हैं।</p>
          <div className="mt-8 flex items-center gap-4">
            <label className="group relative cursor-pointer">
              <Avatar name={f.firmName || 'Firm'} src={f.logoUrl} size={80} />
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
                <Camera className="size-5" />
              </span>
              <input type="file" accept="image/*" hidden onChange={(e) => logo(e.target.files?.[0])} />
            </label>
            <p className="text-sm text-muted">Logo upload करें (optional)</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Firm / Agency name" required>
              <Input value={f.firmName} onChange={(e) => setF({ ...f, firmName: e.target.value })} />
            </Field>
            <Field label="Business phone" required>
              <Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Field>
            <Field label="WhatsApp number" hint="खाली = business phone">
              <Input inputMode="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
            </Field>
            <Field label="Experience (years)">
              <Input inputMode="numeric" value={f.experienceYears} onChange={(e) => setF({ ...f, experienceYears: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="RERA agent number" hint="Verified badge के लिए ज़रूरी">
              <Input value={f.reraNumber} onChange={(e) => setF({ ...f, reraNumber: e.target.value })} />
            </Field>
            <Field label="GSTIN">
              <Input value={f.gstNumber} onChange={(e) => setF({ ...f, gstNumber: e.target.value })} />
            </Field>
            <Field label="Office address" className="sm:col-span-2">
              <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
            </Field>
            <Field label="About your firm" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={f.about}
                onChange={(e) => setF({ ...f, about: e.target.value })}
                placeholder="आपकी speciality — जैसे Golf Course Road luxury resale, Dwarka Expressway new launches…"
              />
            </Field>
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold">आप किन इलाकों के expert हैं?</p>
            <Input className="mt-2" placeholder="Sector खोजें…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="mt-3 flex max-h-52 flex-wrap gap-2 overflow-y-auto">
              {(locs ?? [])
                .filter((l) => f.localityIds.includes(l.id) || !q || l.name.toLowerCase().includes(q.toLowerCase()))
                .slice(0, 60)
                .map((l) => (
                  <Chip key={l.id} active={f.localityIds.includes(l.id)} onClick={() => toggle(l.id)}>
                    {l.name}
                  </Chip>
                ))}
            </div>
          </div>
          <Button size="lg" className="mt-8 w-full" onClick={submit} loading={loading} disabled={!f.firmName || !f.phone}>
            <Rocket className="size-5" /> Start using BrokerIQ
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
