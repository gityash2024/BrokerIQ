import { useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Linking, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlarmClock,
  CalendarPlus,
  Check,
  ChevronLeft,
  Handshake,
  MessageCircle,
  Phone,
  PhoneCall,
  Send,
  Share2,
  Sparkles,
  StickyNote,
  Trash2,
} from 'lucide-react-native';
import { LEAD_STAGES, LEAD_STAGE_COLORS, LEAD_STAGE_LABELS, formatPriceShort, timeAgo, whatsappLink, type LeadStage } from '@brokeriq/shared';
import { api, del, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError, useApiMutation } from '@/lib/hooks';
import { scheduleReminder } from '@/lib/push';
import { timePresets } from '@/lib/time';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { SourceBadge, StageBadge, TempBadge, useTeam } from '@/components/crm';
import { ListingRow } from '@/components/listing';
import { Avatar, Badge, Button, Card, Chip, ErrorView, IconBtn, Input, Loader, PressableScale, Row, Segmented, Sheet, Txt } from '@/ui';
import { useFlag } from '@/lib/config';

const OUTCOMES = [
  ['CONNECTED', '✅ Connected'],
  ['NO_ANSWER', '📵 No answer'],
  ['BUSY', '⏳ Busy'],
  ['CALLBACK', '🔁 Callback'],
  ['SWITCHED_OFF', '📴 Switched off'],
  ['WRONG_NUMBER', '❌ Wrong number'],
];

export default function LeadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { isBrokerAdmin } = useAuth();
  const qc = useQueryClient();
  const team = useTeam();
  const q = useQuery({ queryKey: ['lead', id], queryFn: () => api<any>(`/leads/${id}`) });
  const [tab, setTab] = useState<'timeline' | 'tasks' | 'matches' | 'ai'>('timeline');
  const [sheet, setSheet] = useState<null | 'note' | 'call' | 'followup' | 'visit' | 'lost' | 'deal' | 'wa'>(null);
  const callPending = useRef(false);
  const refresh = () => {
    q.refetch();
    qc.invalidateQueries({ queryKey: ['leads'] });
    qc.invalidateQueries({ queryKey: ['broker-dashboard'] });
  };
  // After a call, when the broker returns to the app, prompt to log the outcome.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && callPending.current) {
        callPending.current = false;
        setTimeout(() => setSheet('call'), 400);
      }
    });
    return () => sub.remove();
  }, []);
  const stage = useApiMutation((b: { stage: string; lostReason?: string }) => patch(`/leads/${id}/stage`, b), { success: 'Stage updated', onSuccess: refresh });
  const assign = useApiMutation((userId: string | null) => patch(`/leads/${id}/assign`, { assignedToId: userId }), { success: 'Assigned', onSuccess: refresh });

  if (q.isLoading) return <Loader />;
  if (q.isError)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      </SafeAreaView>
    );
  const l = q.data;
  const call = () => {
    callPending.current = true;
    Linking.openURL(`tel:${l.phone}`);
  };
  const waConv = l.conversations?.find((cv: any) => cv.channel === 'WHATSAPP');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <Row style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
        <IconBtn onPress={() => router.back()}>
          <ChevronLeft size={24} color={c.fg} />
        </IconBtn>
        <View style={{ flex: 1 }} />
        {isBrokerAdmin && (
          <IconBtn
            onPress={() =>
              del(`/leads/${id}`)
                .then(() => (toast.success('Lead हटाई'), qc.invalidateQueries({ queryKey: ['leads'] }), router.back()))
                .catch(showError)
            }
          >
            <Trash2 size={20} color={c.danger} />
          </IconBtn>
        )}
      </Row>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn} style={{ paddingHorizontal: 16, gap: 10 }}>
          <Row gap={12}>
            <Avatar name={l.name} size={60} />
            <View style={{ flex: 1, gap: 3 }}>
              <Txt v="h2">{l.name || 'Unknown'}</Txt>
              <Txt color="muted">
                {l.phone}
                {l.email ? ` · ${l.email}` : ''}
              </Txt>
              <Row wrap gap={6}>
                <SourceBadge source={l.source} />
                <TempBadge t={l.temperature} />
                {!!l.score && <Badge label={`Score ${l.score}`} color={c.brand} />}
              </Row>
            </View>
          </Row>
          <Row gap={8}>
            <Button title="Call" icon={<Phone size={17} color="#fff" />} style={{ flex: 1 }} onPress={call} />
            <Button
              title="WhatsApp"
              variant="whatsapp"
              icon={<MessageCircle size={17} color="#fff" />}
              style={{ flex: 1 }}
              onPress={() => (waConv ? router.push({ pathname: '/wa/[id]', params: { id: waConv.id } }) : setSheet('wa'))}
            />
          </Row>
          <Button
            title="Click-to-call (Exotel) — recording lead में save"
            size="sm"
            variant="secondary"
            icon={<PhoneCall size={15} color={c.fg} />}
            onPress={() =>
              post(`/leads/${id}/call`)
                .then(() => (toast.success('Call लग रही है — पहले आपका phone बजेगा'), refresh()))
                .catch(showError)
            }
          />
          {!!l.listing && (
            <Txt v="small" color="muted">
              Enquiry for:{' '}
              <Txt v="small" color="brand" onPress={() => router.push(`/property/${l.listing.slug}`)}>
                {l.listing.title}
              </Txt>
            </Txt>
          )}
          {!!l.sourceDetail && (
            <Txt v="caption" color="subtle">
              {l.sourceDetail}
            </Txt>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
            {LEAD_STAGES.map((s) => {
              const on = l.stage === s;
              const col = LEAD_STAGE_COLORS[s as LeadStage];
              return (
                <PressableScale
                  key={s}
                  onPress={() => (s === 'LOST' ? setSheet('lost') : s === 'WON' ? setSheet('deal') : stage.mutate({ stage: s }))}
                  style={{ paddingHorizontal: 12, height: 34, borderRadius: 12, justifyContent: 'center', backgroundColor: on ? col : `${col}18` }}
                >
                  <Txt v="caption" color={on ? 'white' : col} style={{ fontSize: 12 }}>
                    {LEAD_STAGE_LABELS[s as LeadStage]}
                  </Txt>
                </PressableScale>
              );
            })}
          </ScrollView>
          {isBrokerAdmin && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <Txt v="caption" color="subtle" style={{ alignSelf: 'center' }}>
                Assign:
              </Txt>
              {(team.data?.members ?? [])
                .filter((m: any) => m.status === 'ACTIVE')
                .map((m: any) => (
                  <Chip key={m.id} label={m.name.split(' ')[0]} active={l.assignedTo?.id === m.id} onPress={() => assign.mutate(m.id)} />
                ))}
            </ScrollView>
          )}
        </Animated.View>
        <View style={{ backgroundColor: c.bg, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'timeline', label: 'Timeline' },
              { value: 'tasks', label: 'Tasks', count: l.followUps.filter((f: any) => f.status === 'PENDING').length || undefined },
              { value: 'matches', label: 'Matches' },
              { value: 'ai', label: '✨ AI' },
            ]}
          />
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {tab === 'timeline' && (
            <>
              <Row gap={8}>
                <Button
                  title="Note"
                  size="sm"
                  variant="secondary"
                  icon={<StickyNote size={15} color={c.fg} />}
                  onPress={() => setSheet('note')}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Call log"
                  size="sm"
                  variant="secondary"
                  icon={<PhoneCall size={15} color={c.fg} />}
                  onPress={() => setSheet('call')}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Follow-up"
                  size="sm"
                  variant="secondary"
                  icon={<AlarmClock size={15} color={c.fg} />}
                  onPress={() => setSheet('followup')}
                  style={{ flex: 1 }}
                />
              </Row>
              {!!l.notes && (
                <Card style={{ padding: 12 }}>
                  <Txt v="small">{l.notes}</Txt>
                </Card>
              )}
              {l.activities.map((a: any, i: number) => (
                <Animated.View key={a.id} entering={FadeInDown.delay(Math.min(i, 10) * 30)} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.brand, marginTop: 6 }} />
                    {i < l.activities.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: c.line }} />}
                  </View>
                  <Card style={{ flex: 1, padding: 12, gap: 2, marginBottom: 4 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Txt v="caption" color="brand">
                        {a.type.replace(/_/g, ' ')}
                        {a.callOutcome ? ` · ${a.callOutcome.replace(/_/g, ' ')}` : ''}
                      </Txt>
                      <Txt v="caption" color="subtle">
                        {timeAgo(a.createdAt)}
                      </Txt>
                    </Row>
                    {!!a.content && <Txt v="small">{a.content}</Txt>}
                    {!!a.user?.name && (
                      <Txt v="caption" color="subtle">
                        — {a.user.name}
                      </Txt>
                    )}
                  </Card>
                </Animated.View>
              ))}
            </>
          )}
          {tab === 'tasks' && <Tasks lead={l} onChange={refresh} openSheet={setSheet} />}
          {tab === 'matches' && <Matches lead={l} onShared={refresh} />}
          {tab === 'ai' && <Ai lead={l} onDone={refresh} />}
        </View>
      </ScrollView>

      <NoteSheet open={sheet === 'note'} onClose={() => setSheet(null)} leadId={id} onDone={refresh} />
      <CallSheet open={sheet === 'call'} onClose={() => setSheet(null)} lead={l} onDone={refresh} onFollowUp={() => setSheet('followup')} />
      <FollowUpSheet open={sheet === 'followup'} onClose={() => setSheet(null)} lead={l} onDone={refresh} />
      <VisitSheet open={sheet === 'visit'} onClose={() => setSheet(null)} lead={l} onDone={refresh} />
      <LostSheet
        open={sheet === 'lost'}
        onClose={() => setSheet(null)}
        onSave={(reason) => (stage.mutate({ stage: 'LOST', lostReason: reason }), setSheet(null))}
      />
      <DealSheet open={sheet === 'deal'} onClose={() => setSheet(null)} lead={l} onDone={refresh} />
      <WaSheet open={sheet === 'wa'} onClose={() => setSheet(null)} lead={l} onDone={refresh} />
    </SafeAreaView>
  );
}

function NoteSheet({ open, onClose, leadId, onDone }: { open: boolean; onClose: () => void; leadId: string; onDone: () => void }) {
  const [t, setT] = useState('');
  const save = useApiMutation(() => post(`/leads/${leadId}/activities`, { type: 'NOTE', content: t }), {
    success: 'Note saved',
    onSuccess: () => (setT(''), onClose(), onDone()),
  });
  return (
    <Sheet open={open} onClose={onClose} title="Note">
      <Input value={t} onChangeText={setT} multiline placeholder="Client ने क्या कहा…" autoFocus />
      <Button title="Save" loading={save.isPending} disabled={!t.trim()} onPress={() => save.mutate(undefined)} />
    </Sheet>
  );
}

function CallSheet({ open, onClose, lead, onDone, onFollowUp }: { open: boolean; onClose: () => void; lead: any; onDone: () => void; onFollowUp: () => void }) {
  const [outcome, setOutcome] = useState('CONNECTED');
  const [t, setT] = useState('');
  const save = useApiMutation(() => post(`/leads/${lead.id}/activities`, { type: 'CALL', callOutcome: outcome, content: t || null }), {
    success: 'Call logged',
    onSuccess: () => {
      setT('');
      onClose();
      onDone();
      if (outcome !== 'WRONG_NUMBER') setTimeout(onFollowUp, 350);
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title={`${lead.name} से call कैसी रही?`}>
      <Row wrap>
        {OUTCOMES.map(([k, l]) => (
          <Chip key={k} label={l} active={outcome === k} onPress={() => setOutcome(k)} />
        ))}
      </Row>
      <Input value={t} onChangeText={setT} multiline placeholder="Notes (budget, timeline, requirement…)" />
      <Button title="Save & next follow-up" loading={save.isPending} onPress={() => save.mutate(undefined)} />
    </Sheet>
  );
}

function FollowUpSheet({ open, onClose, lead, onDone }: { open: boolean; onClose: () => void; lead: any; onDone: () => void }) {
  const [type, setType] = useState('CALL');
  const [note, setNote] = useState('');
  const [at, setAt] = useState<Date | null>(null);
  const presets = timePresets();
  const save = useApiMutation(() => post('/follow-ups', { leadId: lead.id, type, dueAt: at!.toISOString(), note: note || null }), {
    success: 'Follow-up scheduled ⏰',
    onSuccess: () => {
      scheduleReminder(`⏰ ${lead.name} को ${type === 'CALL' ? 'call' : type.toLowerCase()} करें`, note || lead.phone, at!).catch(() => undefined);
      setNote('');
      setAt(null);
      onClose();
      onDone();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Follow-up schedule करें">
      <Row wrap>
        {['CALL', 'WHATSAPP', 'MEETING'].map((t) => (
          <Chip key={t} label={t[0] + t.slice(1).toLowerCase()} active={type === t} onPress={() => setType(t)} />
        ))}
      </Row>
      <Txt v="label" color="subtle">
        कब
      </Txt>
      <Row wrap>
        {presets.map((p) => (
          <Chip key={p.label} label={p.label} active={at?.getTime() === p.at.getTime()} onPress={() => setAt(p.at)} />
        ))}
      </Row>
      {at && (
        <Txt v="small" color="brand">
          {at.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
        </Txt>
      )}
      <Input value={note} onChangeText={setNote} placeholder="क्या बात करनी है…" />
      <Button title="Schedule" loading={save.isPending} disabled={!at} onPress={() => save.mutate(undefined)} />
    </Sheet>
  );
}

function VisitSheet({ open, onClose, lead, onDone }: { open: boolean; onClose: () => void; lead: any; onDone: () => void }) {
  const [at, setAt] = useState<Date | null>(null);
  const [listingId, setListingId] = useState<string | null>(lead.listing?.id ?? null);
  const [address, setAddress] = useState('');
  const mine = useQuery({ queryKey: ['my-listings-pick'], queryFn: () => api<any>('/listings/mine?pageSize=50&status=ACTIVE'), enabled: open });
  const save = useApiMutation(() => post('/visits', { leadId: lead.id, listingId, scheduledAt: at!.toISOString(), address: address || null }), {
    success: 'Site visit scheduled 🗓',
    onSuccess: () => {
      scheduleReminder(`🏠 Site visit: ${lead.name}`, address || 'Visit शुरू होने वाली है', at!, 30).catch(() => undefined);
      onClose();
      onDone();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Site visit">
      <Row wrap>
        {timePresets().map((p) => (
          <Chip key={p.label} label={p.label} active={at?.getTime() === p.at.getTime()} onPress={() => setAt(p.at)} />
        ))}
      </Row>
      <Txt v="label" color="subtle">
        Property
      </Txt>
      <Row wrap>
        {(mine.data?.items ?? []).slice(0, 12).map((x: any) => (
          <Chip key={x.id} label={x.title.slice(0, 32)} active={listingId === x.id} onPress={() => setListingId(listingId === x.id ? null : x.id)} />
        ))}
      </Row>
      <Input value={address} onChangeText={setAddress} placeholder="Meeting point (optional)" />
      <Button title="Schedule visit" loading={save.isPending} disabled={!at} onPress={() => save.mutate(undefined)} />
    </Sheet>
  );
}

function LostSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (r: string) => void }) {
  const [r, setR] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title="Lead lost क्यों हुई?">
      <Row wrap>
        {['Budget mismatch', 'Bought elsewhere', 'Not responding', 'Plan postponed', 'Location mismatch', 'Fake / wrong number'].map((x) => (
          <Chip key={x} label={x} active={r === x} onPress={() => setR(x)} />
        ))}
      </Row>
      <Input value={r} onChangeText={setR} placeholder="Reason" />
      <Button title="Mark lost" variant="danger" disabled={!r.trim()} onPress={() => onSave(r)} />
    </Sheet>
  );
}

function DealSheet({ open, onClose, lead, onDone }: { open: boolean; onClose: () => void; lead: any; onDone: () => void }) {
  const [f, setF] = useState({ title: lead.listing?.title ?? `${lead.name} deal`, dealValue: '', commissionPct: '1' });
  const save = useApiMutation(
    () =>
      post('/deals', {
        leadId: lead.id,
        listingId: lead.listing?.id ?? null,
        title: f.title,
        dealValue: Number(f.dealValue),
        commissionPct: Number(f.commissionPct) || null,
        closedAt: new Date().toISOString(),
      }),
    {
      success: 'Deal closed 🎉 Lead WON',
      onSuccess: () => (onClose(), onDone()),
    },
  );
  return (
    <Sheet open={open} onClose={onClose} title="Deal close करें 🎉">
      <Input label="Title" value={f.title} onChangeText={(v) => setF({ ...f, title: v })} />
      <Input
        label="Deal value (₹)"
        value={f.dealValue}
        onChangeText={(v) => setF({ ...f, dealValue: v.replace(/\D/g, '') })}
        keyboardType="numeric"
        hint={f.dealValue ? formatPriceShort(Number(f.dealValue)) : undefined}
      />
      <Input label="Commission %" value={f.commissionPct} onChangeText={(v) => setF({ ...f, commissionPct: v })} keyboardType="decimal-pad" />
      <Button
        title="Won — save deal"
        variant="success"
        icon={<Handshake size={18} color="#fff" />}
        loading={save.isPending}
        disabled={!f.dealValue || f.title.length < 2}
        onPress={() => save.mutate(undefined)}
      />
    </Sheet>
  );
}

function WaSheet({ open, onClose, lead, onDone }: { open: boolean; onClose: () => void; lead: any; onDone: () => void }) {
  const [t, setT] = useState(`नमस्ते ${lead.name?.split(' ')[0] ?? ''} 👋 `);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await post('/whatsapp/send', { leadId: lead.id, text: t });
      toast.success('WhatsApp भेजा गया');
      onClose();
      onDone();
    } catch {
      // Not connected / outside 24h window → fall back to the WhatsApp app.
      Linking.openURL(whatsappLink(lead.phone, t));
      post(`/leads/${lead.id}/activities`, { type: 'WHATSAPP', content: t })
        .then(onDone)
        .catch(() => undefined);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="WhatsApp message">
      <Input value={t} onChangeText={setT} multiline />
      <Txt v="caption" color="muted">
        Business WhatsApp connected है तो app से जाएगा (inbox में save होगा), नहीं तो WhatsApp app खुलेगा।
      </Txt>
      <Button title="Send" variant="whatsapp" icon={<Send size={17} color="#fff" />} loading={busy} disabled={!t.trim()} onPress={send} />
    </Sheet>
  );
}

function Tasks({ lead, onChange, openSheet }: { lead: any; onChange: () => void; openSheet: (s: 'followup' | 'visit') => void }) {
  const { c } = useTheme();
  const done = useApiMutation((fid: string) => patch(`/follow-ups/${fid}`, { status: 'DONE' }), { success: 'Done ✅', onSuccess: onChange });
  return (
    <>
      <Row gap={8}>
        <Button title="Follow-up" size="sm" icon={<AlarmClock size={15} color="#fff" />} style={{ flex: 1 }} onPress={() => openSheet('followup')} />
        <Button
          title="Site visit"
          size="sm"
          variant="accent"
          icon={<CalendarPlus size={15} color="#111" />}
          style={{ flex: 1 }}
          onPress={() => openSheet('visit')}
        />
      </Row>
      {lead.followUps.map((f: any) => (
        <Card key={f.id} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: f.status === 'PENDING' ? 1 : 0.55 }}>
          <AlarmClock size={18} color={f.status === 'PENDING' && new Date(f.dueAt) < new Date() ? c.danger : c.brand} />
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong">
              {f.type} · {new Date(f.dueAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </Txt>
            {!!f.note && (
              <Txt v="caption" color="muted">
                {f.note}
              </Txt>
            )}
          </View>
          {f.status === 'PENDING' ? (
            <IconBtn onPress={() => done.mutate(f.id)} style={{ backgroundColor: `${c.success}22` }}>
              <Check size={18} color={c.success} />
            </IconBtn>
          ) : (
            <Badge label={f.status} />
          )}
        </Card>
      ))}
      {lead.visits.map((v: any) => (
        <Card key={v.id} style={{ padding: 12, gap: 2 }}>
          <Txt v="bodyStrong">🏠 {new Date(v.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Txt>
          <Txt v="caption" color="muted">
            {v.listing?.title ?? v.address ?? ''} · {v.status}
          </Txt>
        </Card>
      ))}
      {!lead.followUps.length && !lead.visits.length && (
        <Txt v="small" color="muted">
          अभी कोई task नहीं
        </Txt>
      )}
    </>
  );
}

function Matches({ lead, onShared }: { lead: any; onShared: () => void }) {
  const coBrokingOn = useFlag('cobroking');
  const [scope, setScope] = useState<'org' | 'all'>('org');
  const q = useQuery({ queryKey: ['matches', lead.id, scope], queryFn: () => api<any[]>(`/leads/${lead.id}/matches?scope=${scope}`) });
  const share = async (listingId: string) => {
    try {
      const r = await post<{ text: string }>(`/leads/${lead.id}/share`, { listingId });
      try {
        await post('/whatsapp/send', { leadId: lead.id, text: r.text });
        toast.success('WhatsApp पर भेजा गया');
      } catch {
        Linking.openURL(whatsappLink(lead.phone, r.text));
      }
      onShared();
    } catch (e) {
      showError(e);
    }
  };
  const coBroke = (listingId: string) =>
    post('/cobroking/requests', { listingId, leadId: lead.id })
      .then(() => toast.success('Co-broke request भेजी'))
      .catch(showError);
  return (
    <>
      <Segmented
        value={scope}
        onChange={setScope}
        options={[
          { value: 'org', label: 'मेरी inventory' },
          { value: 'all', label: 'पूरा marketplace' },
        ]}
      />
      {!lead.requirement && (
        <Txt v="small" color="warning">
          Requirement (budget, BHK, locality) भरें — matching बेहतर होगी। (Web CRM → Requirement)
        </Txt>
      )}
      {q.isLoading ? (
        <Loader />
      ) : !q.data?.length ? (
        <Txt v="small" color="muted">
          कोई matching property नहीं
        </Txt>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={q.data}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <ListingRow
              l={item}
              right={
                <View style={{ alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Badge label={`${item.matchScore}%`} color="#10B981" />
                  <IconBtn onPress={() => share(item.id)}>
                    <Share2 size={18} color="#16A34A" />
                  </IconBtn>
                  {coBrokingOn && item.coBroking && item.organization && item.organization.id !== lead.organizationId && (
                    <IconBtn onPress={() => coBroke(item.id)}>
                      <Handshake size={18} color="#4F46E5" />
                    </IconBtn>
                  )}
                </View>
              }
            />
          )}
        />
      )}
    </>
  );
}

function Ai({ lead, onDone }: { lead: any; onDone: () => void }) {
  const { c } = useTheme();
  const [r, setR] = useState<any>(lead.aiSummary ? { summary: lead.aiSummary } : null);
  const run = useApiMutation(() => post<any>(`/leads/${lead.id}/ai`), { onSuccess: (x) => (setR(x), onDone()) });
  return (
    <>
      <Button
        title={r ? 'दोबारा analyse करें' : 'AI से lead analyse करें'}
        icon={<Sparkles size={17} color="#fff" />}
        loading={run.isPending}
        onPress={() => run.mutate(undefined)}
      />
      {r && (
        <Animated.View entering={FadeInDown} style={{ gap: 10 }}>
          <Card style={{ padding: 14, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="label" color="brand">
                Summary
              </Txt>
              {r.temperature && <TempBadge t={r.temperature} />}
            </Row>
            <Txt v="small">{r.summary}</Txt>
          </Card>
          {!!r.nextAction && (
            <Card style={{ padding: 14, gap: 4, borderColor: c.accent }}>
              <Txt v="label" color="accent">
                Next best action
              </Txt>
              <Txt v="small">{r.nextAction}</Txt>
            </Card>
          )}
          {!!r.suggestedReply && (
            <Card style={{ padding: 14, gap: 8 }}>
              <Txt v="label" color="success">
                Suggested WhatsApp
              </Txt>
              <Txt v="small">{r.suggestedReply}</Txt>
              <Button title="WhatsApp पर भेजें" size="sm" variant="whatsapp" onPress={() => Linking.openURL(whatsappLink(lead.phone, r.suggestedReply))} />
            </Card>
          )}
        </Animated.View>
      )}
      <StageBadge stage={lead.stage} />
    </>
  );
}
