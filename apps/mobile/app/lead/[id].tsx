import { useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Linking, ScrollView, Share, View } from 'react-native';
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
import { LEAD_STAGES, LEAD_STAGE_COLORS, LEAD_STAGE_LABELS, formatPriceShort, timeAgo, whatsappLink, moduleAllowed, type LeadStage } from '@brokeriq/shared';
import { api, del, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { showError, useApiMutation } from '@/lib/hooks';
import { scheduleReminder } from '@/lib/push';
import { timePresets } from '@/lib/time';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { SourceBadge, StageBadge, TempBadge, useAssignees } from '@/components/crm';
import { ListingRow } from '@/components/listing';
import { Avatar, Badge, Button, Card, Chip, ErrorView, IconBtn, Input, Loader, PressableScale, Row, Segmented, Sheet, Txt } from '@/ui';
import { useFlag, useConfig } from '@/lib/config';

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
  const { isBrokerAdmin, user } = useAuth();
  const config = useConfig();
  const assistantOn = moduleAllowed(config.modules, 'assistant', user?.role ?? '');
  const dealsOn = moduleAllowed(config.modules, 'deals', user?.role ?? '');
  const qc = useQueryClient();
  const team = useAssignees();
  const q = useQuery({ queryKey: ['lead', id], queryFn: () => api<any>(`/leads/${id}`) });
  const [tab, setTab] = useState<'timeline' | 'tasks' | 'matches' | 'ai'>('timeline');
  const [sheet, setSheet] = useState<null | 'note' | 'call' | 'followup' | 'visit' | 'lost' | 'not_interested' | 'deal' | 'wa'>(null);
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
                {!!l.scoredAt && <Badge label={`Score ${l.score}`} color={c.brand} />}
              </Row>
              {!!l.scoreReasons?.length && (
                <Txt v="caption" color="muted" numberOfLines={2}>
                  {l.scoreReasons.join(' · ')}
                </Txt>
              )}
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
          <Button
            title="Requirements & matching"
            variant="secondary"
            size="sm"
            onPress={() => router.push({ pathname: '/requirements', params: { leadId: id } })}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
            {LEAD_STAGES.map((s) => {
              const on = l.stage === s;
              const col = LEAD_STAGE_COLORS[s as LeadStage];
              return (
                <PressableScale
                  key={s}
                  onPress={() => (s === 'LOST' ? setSheet('lost') : s === 'NOT_INTERESTED' ? setSheet('not_interested') : stage.mutate({ stage: s }))}
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
              ...(assistantOn ? [{ value: 'ai' as const, label: '✨ AI' }] : []),
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
          {tab === 'ai' && assistantOn && <Ai lead={l} onDone={refresh} />}
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
      <NotInterestedSheet
        open={sheet === 'not_interested'}
        onClose={() => setSheet(null)}
        onSave={(reason) => (stage.mutate({ stage: 'NOT_INTERESTED', lostReason: reason || undefined }), setSheet(null))}
      />
      {dealsOn && <DealSheet open={sheet === 'deal'} onClose={() => setSheet(null)} lead={l} onDone={refresh} />}
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
  const { c } = useTheme();
  const [at, setAt] = useState<Date | null>(null);
  const [isCustomDate, setIsCustomDate] = useState(false);
  const [customDateStr, setCustomDateStr] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [customTimeHour, setCustomTimeHour] = useState('11');
  const [customTimeMinute, setCustomTimeMinute] = useState('00');
  const [customTimePeriod, setCustomTimePeriod] = useState<'AM' | 'PM'>('AM');
  const [searchProperty, setSearchProperty] = useState('');
  const [listingId, setListingId] = useState<string | null>(lead.listing?.id ?? null);
  const [address, setAddress] = useState('');

  const mine = useQuery({ queryKey: ['my-listings-pick'], queryFn: () => api<any>('/inventory?pageSize=100'), enabled: open });

  const applyCustomDateTime = (dateStr: string, hourStr: string, minuteStr: string, period: 'AM' | 'PM') => {
    try {
      const parts = dateStr.split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      let h = parseInt(hourStr, 10) || 10;
      if (period === 'PM' && h < 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      const m = parseInt(minuteStr, 10) || 0;
      const d = new Date(year, (month || 1) - 1, day || 1, h, m);
      if (!isNaN(d.getTime())) setAt(d);
    } catch {}
  };

  const save = useApiMutation(() => post('/visits', { leadId: lead.id, scheduledAt: at!.toISOString(), address: address || null }), {
    success: 'Site visit scheduled 🗓',
    onSuccess: () => {
      scheduleReminder(`🏠 Site visit: ${lead.name}`, address || 'Visit शुरू होने वाली है', at!, 30).catch(() => undefined);
      onClose();
      onDone();
    },
  });

  const allProperties = (mine.data?.items ?? []).filter((item: any, idx: number, self: any[]) => {
    return self.findIndex((o: any) => o.id === item.id || (o.houseNo && o.sector && o.houseNo === item.houseNo && o.sector === item.sector)) === idx;
  });

  const filteredProperties = allProperties.filter((x: any) => {
    if (!searchProperty.trim()) return true;
    const q = searchProperty.toLowerCase();
    const str = `${x.houseNo || ''} ${x.unitLabel || ''} ${x.sector || ''} ${x.bedrooms || ''} BHK ${x.furnishing || ''} ${x.rent || ''}`.toLowerCase();
    return str.includes(q);
  });

  return (
    <Sheet open={open} onClose={onClose} title="Site visit schedule करें">
      <Txt v="label" color="subtle">
        कब (Date & Time)
      </Txt>
      <Row wrap gap={6} style={{ marginTop: 4, marginBottom: 8 }}>
        {timePresets().map((p) => {
          const active = !isCustomDate && at?.getTime() === p.at.getTime();
          return (
            <Chip
              key={p.label}
              label={p.label}
              active={active}
              onPress={() => {
                setIsCustomDate(false);
                setAt(p.at);
              }}
            />
          );
        })}
        <Chip
          label="📅 Custom Date / Time"
          active={isCustomDate}
          onPress={() => {
            setIsCustomDate(true);
            applyCustomDateTime(customDateStr, customTimeHour, customTimeMinute, customTimePeriod);
          }}
        />
      </Row>

      {isCustomDate && (
        <Card style={{ padding: 12, gap: 10, backgroundColor: `${c.brand}0c`, borderColor: `${c.brand}30`, marginBottom: 12 }}>
          <Txt v="small" color="brand" style={{ fontWeight: '700' }}>
            अपने हिसाब से तारीख और समय चुनें:
          </Txt>
          <Row gap={8} style={{ alignItems: 'center' }}>
            <View style={{ flex: 2 }}>
              <Txt v="caption" color="muted">तारीख (YYYY-MM-DD)</Txt>
              <Input
                value={customDateStr}
                onChangeText={(v) => {
                  setCustomDateStr(v);
                  applyCustomDateTime(v, customTimeHour, customTimeMinute, customTimePeriod);
                }}
                placeholder="2026-10-30"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="caption" color="muted">घंटे (1-12)</Txt>
              <Input
                value={customTimeHour}
                onChangeText={(v) => {
                  setCustomTimeHour(v);
                  applyCustomDateTime(customDateStr, v, customTimeMinute, customTimePeriod);
                }}
                keyboardType="numeric"
                placeholder="11"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="caption" color="muted">मिनट</Txt>
              <Input
                value={customTimeMinute}
                onChangeText={(v) => {
                  setCustomTimeMinute(v);
                  applyCustomDateTime(customDateStr, customTimeHour, v, customTimePeriod);
                }}
                keyboardType="numeric"
                placeholder="30"
              />
            </View>
            <View style={{ flex: 1.2, alignSelf: 'flex-end', paddingBottom: 2 }}>
              <Row gap={4}>
                <Chip
                  label="AM"
                  active={customTimePeriod === 'AM'}
                  onPress={() => {
                    setCustomTimePeriod('AM');
                    applyCustomDateTime(customDateStr, customTimeHour, customTimeMinute, 'AM');
                  }}
                />
                <Chip
                  label="PM"
                  active={customTimePeriod === 'PM'}
                  onPress={() => {
                    setCustomTimePeriod('PM');
                    applyCustomDateTime(customDateStr, customTimeHour, customTimeMinute, 'PM');
                  }}
                />
              </Row>
            </View>
          </Row>
        </Card>
      )}

      {at && (
        <Row gap={6} style={{ alignItems: 'center', marginBottom: 10 }}>
          <CalendarPlus size={16} color={c.brand} />
          <Txt v="small" color="brand" style={{ fontWeight: '600' }}>
            Scheduled for: {at.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </Txt>
        </Row>
      )}

      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 4 }}>
        <Txt v="label" color="subtle">
          Property (कोई भी चुनें या सर्च करें)
        </Txt>
        {filteredProperties.length > 0 && (
          <Txt v="caption" color="muted">{filteredProperties.length} उपलब्ध</Txt>
        )}
      </Row>

      <Input
        value={searchProperty}
        onChangeText={setSearchProperty}
        placeholder="🔍 Sector / House / BHK से फ़िल्टर करें..."
        containerStyle={{ marginBottom: 8 }}
      />

      <ScrollView horizontal={false} style={{ maxHeight: 180, marginBottom: 10 }} showsVerticalScrollIndicator={false}>
        <Row wrap gap={6}>
          {filteredProperties.slice(0, 30).map((x: any) => {
            const active = listingId === x.id;
            const title = [x.houseNo, x.unitLabel, x.sector].filter(Boolean).join(' ') || 'Property';
            const detail = [x.bedrooms ? `${x.bedrooms} BHK` : null, x.rent ? `₹${(x.rent / 1000).toFixed(0)}k` : null, x.furnishing ? x.furnishing.slice(0, 4) : null].filter(Boolean).join(' · ');
            return (
              <PressableScale
                key={x.id}
                onPress={() => {
                  setListingId(x.id);
                  setAddress([x.houseNo, x.unitLabel, x.sector, x.address].filter(Boolean).join(', '));
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: active ? c.brand : c.line,
                  backgroundColor: active ? `${c.brand}14` : c.surface,
                  marginBottom: 4,
                }}
              >
                <Txt v="bodyStrong" color={active ? 'brand' : 'default'} style={{ fontSize: 13 }}>
                  {title}
                </Txt>
                {detail ? (
                  <Txt v="caption" color={active ? 'brand' : 'muted'} style={{ fontSize: 11, marginTop: 2 }}>
                    {detail}
                  </Txt>
                ) : null}
              </PressableScale>
            );
          })}
        </Row>
      </ScrollView>

      <Txt v="label" color="subtle" style={{ marginBottom: 4 }}>
        Meeting Point / Custom Address
      </Txt>
      <Input
        value={address}
        onChangeText={setAddress}
        placeholder="Gate No., Land mark, या कोई भी नया address लिखें…"
      />

      <Button
        title="Schedule visit"
        loading={save.isPending}
        disabled={!at}
        style={{ marginTop: 14 }}
        onPress={() => save.mutate(undefined)}
      />
    </Sheet>
  );
}

function NotInterestedSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (r: string) => void }) {
  const [r, setR] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title="Lead इच्छुक क्यों नहीं है?">
      <Txt v="caption" color="muted" style={{ marginBottom: 8 }}>
        कारण चुनें (वैकल्पिक):
      </Txt>
      <Row wrap gap={6} style={{ marginBottom: 12 }}>
        {['Budget mismatch', 'Location mismatch', 'Plan postponed', 'Looking for different BHK', 'Rented elsewhere', 'Fake / wrong number'].map((x) => (
          <Chip key={x} label={x} active={r === x} onPress={() => setR(r === x ? '' : x)} />
        ))}
      </Row>
      <Input value={r} onChangeText={setR} placeholder="कोई अन्य कारण (optional)..." />
      <Row gap={10} style={{ marginTop: 14 }}>
        <View style={{ flex: 1 }}>
          <Button title="Mark Not Interested" variant="secondary" onPress={() => onSave(r)} />
        </View>
      </Row>
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
      <Button title="भेजें" variant="whatsapp" icon={<Send size={17} color="#fff" />} loading={busy} disabled={!t.trim()} onPress={send} />
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
  const compareOn = useFlag('comparison_pdf');
  const [picked, setPicked] = useState<string[] | null>(null);
  const pick = (id: string) =>
    setPicked((p) => (!p ? p : p.includes(id) ? p.filter((x) => x !== id) : p.length >= 5 ? (toast.error('ज़्यादा से ज़्यादा 5 properties'), p) : [...p, id]));
  const compare = useApiMutation(() => post<any>('/broker/comparisons', { listingIds: picked, leadId: lead.id }), {
    onSuccess: (r) => {
      setPicked(null);
      Share.share({ message: `${String(lead.name).split(' ')[0]} जी, आपके लिए properties की तुलना: ${r.pdfUrl}` });
    },
  });
  return (
    <>
      {compareOn && (
        <Row>
          {picked ? (
            <>
              <Button
                title={`PDF बनाएँ (${picked.length})`}
                size="sm"
                disabled={picked.length < 2}
                loading={compare.isPending}
                onPress={() => compare.mutate(undefined)}
              />
              <Button title="Cancel" size="sm" variant="ghost" onPress={() => setPicked(null)} />
            </>
          ) : (
            <Button title="Comparison PDF" size="sm" variant="secondary" onPress={() => setPicked([])} />
          )}
        </Row>
      )}
      {picked && (
        <Txt v="caption" color="muted">
          2–5 properties पर tap करके चुनें
        </Txt>
      )}
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
              onPress={picked ? () => pick(item.id) : undefined}
              selected={!!picked?.includes(item.id)}
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
