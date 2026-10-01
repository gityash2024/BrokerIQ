'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, MessageCircle, Phone, Users } from 'lucide-react';
import { OFFICE_HUBS, formatINR, whatsappLink, type LocalityListItem } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { patch, useApiMutation } from '@/lib/hooks';
import { PageHeader } from '@/components/panel/shell';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Chip, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Avatar, Badge, Empty, Skeleton, Switch } from '@/components/ui/misc';

const FOOD: Record<string, string> = { VEG: 'Veg', NONVEG: 'Non-veg', ANY: 'कोई भी' };

export default function FlatmatesPage() {
  const profile = useQuery({ queryKey: ['flatmate-me'], queryFn: () => api<any>('/flatmates/me') });
  const [tab, setTab] = useState<'matches' | 'connections' | 'profile'>('matches');
  useEffect(() => {
    if (profile.isSuccess && !profile.data) setTab('profile');
  }, [profile.isSuccess, profile.data]);
  return (
    <>
      <PageHeader title="Flatmates" subtitle="Gurgaon में साथ रहने के लिए flatmate या room खोजें — number दोनों की सहमति के बाद ही दिखता है" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'matches', label: 'Matches' },
          { value: 'connections', label: 'Requests' },
          { value: 'profile', label: 'मेरी profile' },
        ]}
      />
      <div className="mt-5">
        {tab === 'profile' ? (
          <ProfileForm initial={profile.data} onSaved={() => (profile.refetch(), setTab('matches'))} />
        ) : tab === 'matches' ? (
          <Matches hasProfile={!!profile.data} />
        ) : (
          <Connections />
        )}
      </div>
    </>
  );
}

function ProfileForm({ initial, onSaved }: { initial: any; onSaved: () => void }) {
  const locs = useQuery({ queryKey: ['localities-all'], queryFn: () => api<LocalityListItem[]>('/public/localities', { auth: false }), staleTime: 600_000 });
  const [f, setF] = useState<any>({
    lookingFor: 'FLATMATE',
    gender: 'MALE',
    prefGender: 'ANY',
    budgetMax: '',
    localityIds: [],
    officeHub: '',
    food: 'ANY',
    smoking: false,
    drinking: false,
    pets: false,
    occupation: '',
    about: '',
    isActive: true,
  });
  const [locQ, setLocQ] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initial)
      setF({
        ...initial,
        budgetMax: initial.budgetMax ?? '',
        officeHub: initial.officeHub ?? '',
        occupation: initial.occupation ?? '',
        about: initial.about ?? '',
      });
  }, [initial]);
  const save = async () => {
    setBusy(true);
    try {
      await api('/flatmates/me', {
        method: 'POST',
        body: {
          lookingFor: f.lookingFor,
          gender: f.gender,
          prefGender: f.prefGender,
          budgetMax: f.budgetMax ? Number(f.budgetMax) : null,
          localityIds: f.localityIds,
          officeHub: f.officeHub || null,
          food: f.food,
          smoking: f.smoking,
          drinking: f.drinking,
          pets: f.pets,
          occupation: f.occupation || null,
          about: f.about || null,
          isActive: f.isActive,
        },
      });
      toast.success('Profile saved');
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string) =>
    setF({ ...f, localityIds: f.localityIds.includes(id) ? f.localityIds.filter((x: string) => x !== id) : [...f.localityIds, id] });
  return (
    <div className="card max-w-3xl space-y-4 p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="मैं ढूँढ रहा/रही हूँ">
          <Select value={f.lookingFor} onChange={(e) => setF({ ...f, lookingFor: e.target.value })}>
            <option value="FLATMATE">Flatmate (मेरे पास flat है)</option>
            <option value="ROOM">Room / साथ में flat</option>
          </Select>
        </Field>
        <Field label="मैं">
          <Select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Flatmate चाहिए">
          <Select value={f.prefGender} onChange={(e) => setF({ ...f, prefGender: e.target.value })}>
            <option value="ANY">कोई भी</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </Select>
        </Field>
        <Field label="अपना हिस्सा (₹/month)">
          <Input inputMode="numeric" value={f.budgetMax} onChange={(e) => setF({ ...f, budgetMax: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="Office">
          <Select value={f.officeHub} onChange={(e) => setF({ ...f, officeHub: e.target.value })}>
            <option value="">—</option>
            {OFFICE_HUBS.map((h) => (
              <option key={h.key} value={h.key}>
                {h.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Food">
          <Select value={f.food} onChange={(e) => setF({ ...f, food: e.target.value })}>
            <option value="ANY">कोई भी</option>
            <option value="VEG">Veg</option>
            <option value="NONVEG">Non-veg</option>
          </Select>
        </Field>
      </div>
      <Field label="इलाके" hint={f.localityIds.length ? `${f.localityIds.length} चुने` : 'खाली = पूरा Gurgaon'}>
        <Input className="mb-2" placeholder="Sector खोजें…" value={locQ} onChange={(e) => setLocQ(e.target.value)} />
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
          {(locs.data ?? [])
            .filter((l) => !locQ || l.name.toLowerCase().includes(locQ.toLowerCase()))
            .slice(0, 40)
            .map((l) => (
              <Chip key={l.id} active={f.localityIds.includes(l.id)} onClick={() => toggle(l.id)}>
                <span data-no-i18n>{l.name}</span>
              </Chip>
            ))}
        </div>
      </Field>
      <div className="flex flex-wrap gap-4 text-sm">
        {(['smoking', 'drinking', 'pets'] as const).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <Switch checked={f[k]} onCheckedChange={(x) => setF({ ...f, [k]: x })} /> {k === 'smoking' ? 'Smoking' : k === 'drinking' ? 'Drinking' : 'Pets'}
          </label>
        ))}
        <label className="flex items-center gap-2">
          <Switch checked={f.isActive} onCheckedChange={(x) => setF({ ...f, isActive: x })} /> Profile दिखाएँ
        </label>
      </div>
      <Field label="Occupation">
        <Input value={f.occupation} onChange={(e) => setF({ ...f, occupation: e.target.value })} />
      </Field>
      <Field label="अपने बारे में">
        <Textarea
          rows={3}
          value={f.about}
          onChange={(e) => setF({ ...f, about: e.target.value })}
          placeholder="जैसे: early riser, work from office, cooking पसंद है"
        />
      </Field>
      <Button onClick={save} loading={busy}>
        Save
      </Button>
    </div>
  );
}

function Matches({ hasProfile }: { hasProfile: boolean }) {
  const q = useQuery({ queryKey: ['flatmate-matches'], queryFn: () => api<any[]>('/flatmates/matches'), enabled: hasProfile });
  const connect = async (userId: string) => {
    try {
      await api(`/flatmates/connect/${userId}`, { method: 'POST', body: {} });
      toast.success('Request भेजी — accept होने पर number दिखेगा');
      q.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  if (!hasProfile) return <Empty icon={<Users className="size-6" />} title="पहले अपनी profile बनाएँ" />;
  if (q.isLoading) return <Skeleton className="h-48" />;
  if (!q.data?.length) return <Empty icon={<Users className="size-6" />} title="अभी कोई match नहीं" text="इलाके या budget थोड़ा बढ़ाकर देखें।" />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {q.data.map((m) => (
        <div key={m.id} className="card space-y-2 p-4 text-sm">
          <div className="flex items-center gap-3">
            <Avatar name={m.name} src={m.avatarUrl} size={44} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 font-semibold" data-no-i18n>
                {m.name}
                {m.verified && <BadgeCheck className="size-4 text-emerald-500" />}
              </p>
              <p className="text-xs text-muted">
                {m.lookingFor === 'ROOM' ? 'Room ढूँढ रहे' : 'Flatmate ढूँढ रहे'}
                {m.occupation ? ` · ${m.occupation}` : ''}
              </p>
            </div>
            <Badge tone="success">{m.score}%</Badge>
          </div>
          <p className="text-muted">
            {m.budgetMax ? `${formatINR(m.budgetMax)} तक · ` : ''}Food: {FOOD[m.food]}
            {m.officeHub ? ` · ${OFFICE_HUBS.find((h) => h.key === m.officeHub)?.name ?? ''}` : ''}
          </p>
          {m.about && (
            <p className="line-clamp-3" data-no-i18n>
              {m.about}
            </p>
          )}
          {m.connection ? (
            <Badge>{m.connection.status === 'ACCEPTED' ? 'Connected ✓' : m.connection.mine ? 'Request भेजी' : 'आपके लिए request'}</Badge>
          ) : (
            <Button size="sm" onClick={() => connect(m.userId)}>
              Connect
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function Connections() {
  const q = useQuery({ queryKey: ['flatmate-connections'], queryFn: () => api<any[]>('/flatmates/connections') });
  const respond = useApiMutation((b: { id: string; status: string }) => patch(`/flatmates/connections/${b.id}`, { status: b.status }), {
    success: 'Updated',
    invalidate: [['flatmate-connections'], ['flatmate-matches']],
  });
  if (q.isLoading) return <Skeleton className="h-32" />;
  if (!q.data?.length) return <Empty icon={<Users className="size-6" />} title="कोई request नहीं" />;
  return (
    <div className="space-y-3">
      {q.data.map((c) => (
        <div key={c.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Avatar name={c.other.name} src={c.other.avatarUrl} size={40} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold" data-no-i18n>
              {c.other.name}
            </p>
            <p className="text-xs text-muted">
              {c.status === 'ACCEPTED' ? 'Connected' : c.incoming ? 'आपके लिए request' : 'Request भेजी'}
              {c.message ? ` · “${c.message}”` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            {c.other.phone && (
              <>
                <Button size="sm" variant="secondary" href={`tel:${c.other.phone}`}>
                  <Phone className="size-4" /> Call
                </Button>
                <Button size="sm" variant="whatsapp" href={whatsappLink(c.other.phone, 'नमस्ते, BrokerIQ flatmates से')} external>
                  <MessageCircle className="size-4" /> WhatsApp
                </Button>
              </>
            )}
            {c.incoming && c.status === 'PENDING' && (
              <>
                <Button size="sm" onClick={() => respond.mutate({ id: c.id, status: 'ACCEPTED' })}>
                  Accept
                </Button>
                <Button size="sm" variant="ghost" onClick={() => respond.mutate({ id: c.id, status: 'DECLINED' })}>
                  Decline
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
