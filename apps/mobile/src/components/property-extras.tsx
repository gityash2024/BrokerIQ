import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useQuery } from '@tanstack/react-query';
import { Car, ShieldAlert, Star, TrainFront } from 'lucide-react-native';
import { OFFICE_HUBS, estimateCommute, formatINR } from '@brokeriq/shared';
import { api, post } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { Button, Card, Chip, Input, Loader, Row, SectionTitle, Sheet, Txt } from '@/ui';
import { useFlag } from '@/lib/config';

/** Anti-scam reminder next to contact options. */
export function SafetyNote() {
  const { c } = useTheme();
  return (
    <Card style={{ padding: 12, marginTop: 16, borderColor: c.warning, backgroundColor: `${c.warning}14` }}>
      <Row gap={8} style={{ alignItems: 'flex-start' }}>
        <ShieldAlert size={18} color={c.warning} />
        <Txt v="small" style={{ flex: 1 }}>
          Property देखे बिना token / advance न दें। Payment हमेशा visit और agreement के बाद करें — शक हो तो listing report करें।
        </Txt>
      </Row>
    </Card>
  );
}

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const timeLabel = (at: string) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/** Pick one of the broker's free visit slots and book it. */
export function SlotSheet({ listingId, open, onClose }: { listingId: string; open: boolean; onClose: () => void }) {
  const q = useQuery({ queryKey: ['slots', listingId], queryFn: () => api<any>(`/listings/${listingId}/slots?days=7`, { auth: false }), enabled: open });
  const [day, setDay] = useState<string | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const days: { date: string; slots: { at: string; available: number }[] }[] = q.data?.days ?? [];
  const active = day ?? days.find((d) => d.slots.some((s) => s.available > 0))?.date ?? null;
  const book = async () => {
    if (!at) return;
    setBusy(true);
    try {
      const r = await post<any>(`/listings/${listingId}/book-visit`, { at });
      toast.success(`Visit book हो गई: ${r.when}`);
      onClose();
    } catch (e) {
      showError(e);
      q.refetch();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Site visit book करें">
      {q.isLoading ? (
        <Loader />
      ) : !days.length ? (
        <Txt v="small" color="muted">
          अगले 7 दिन में कोई slot खाली नहीं — enquiry भेजें।
        </Txt>
      ) : (
        <View style={{ gap: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((d) => (
              <Chip key={d.date} label={dayLabel(d.date)} active={active === d.date} onPress={() => (setDay(d.date), setAt(null))} />
            ))}
          </ScrollView>
          <Row wrap>
            {days
              .find((d) => d.date === active)
              ?.slots.map((s) => (
                <Chip
                  key={s.at}
                  label={s.available > 0 ? timeLabel(s.at) : `${timeLabel(s.at)} ✕`}
                  active={at === s.at}
                  onPress={s.available > 0 ? () => setAt(s.at) : undefined}
                />
              ))}
          </Row>
          <Button title="Visit book करें" size="lg" loading={busy} disabled={!at} onPress={book} />
        </View>
      )}
    </Sheet>
  );
}

/** Record a token paid to the broker outside BrokerIQ; the broker confirms it. */
export function TokenSheet({ listingId, open, onClose }: { listingId: string; open: boolean; onClose: () => void }) {
  const info = useQuery({ queryKey: ['token-info', listingId], queryFn: () => api<any>(`/listings/${listingId}/token-info`), enabled: open });
  const [f, setF] = useState({ amount: '', mode: 'UPI', ref: '' });
  const [busy, setBusy] = useState(false);
  const d = info.data;
  const save = async () => {
    setBusy(true);
    try {
      await post(`/listings/${listingId}/token`, { amount: Number(f.amount), mode: f.mode, ref: f.ref || undefined });
      toast.success('Record हो गया — broker confirm करेंगे');
      onClose();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const upi =
    d?.org?.upiId && Number(f.amount) > 0
      ? `upi://pay?pa=${encodeURIComponent(d.org.upiId)}&pn=${encodeURIComponent(d.org.upiName || d.org.name)}&am=${Number(f.amount)}&cu=INR&tn=Token`
      : null;
  return (
    <Sheet open={open} onClose={onClose} title="Token / advance का record">
      <View style={{ gap: 10 }}>
        <Txt v="small" color="muted">
          Payment सीधे broker को होता है। यहाँ सिर्फ़ record रखें ताकि broker confirm करे।
        </Txt>
        {!!d?.org?.upiId && <Txt v="small">{`Broker का UPI: ${d.org.upiId}`}</Txt>}
        <Input label="Amount (₹)" value={f.amount} onChangeText={(v) => setF({ ...f, amount: v.replace(/\D/g, '') })} keyboardType="number-pad" />
        <Row wrap>
          {['UPI', 'CASH', 'BANK'].map((m) => (
            <Chip key={m} label={m} active={f.mode === m} onPress={() => setF({ ...f, mode: m })} />
          ))}
        </Row>
        <Input label="Reference (UTR)" value={f.ref} onChangeText={(v) => setF({ ...f, ref: v })} />
        {upi && <Button title={`UPI app से ${formatINR(Number(f.amount))} भेजें`} variant="secondary" onPress={() => Linking.openURL(upi)} />}
        <Button title="Record करें" loading={busy} disabled={!Number(f.amount)} onPress={save} />
      </View>
    </Sheet>
  );
}

/** Hidden while Super Admin has "commute" switched off. */
export function CommuteCard(props: { l: any }) {
  return useFlag('commute') ? <CommuteCardInner {...props} /> : null;
}

/** Estimated commute to a chosen office hub (car / metro). */
function CommuteCardInner({ l }: { l: any }) {
  const { c } = useTheme();
  const [hub, setHub] = useState('cyber-city');
  const from =
    l.latitude != null ? { lat: l.latitude, lng: l.longitude } : l.locality?.latitude != null ? { lat: l.locality.latitude, lng: l.locality.longitude } : null;
  if (!from) return null;
  const h = OFFICE_HUBS.find((x) => x.key === hub) ?? OFFICE_HUBS[0];
  const e = estimateCommute(from, h);
  return (
    <>
      <SectionTitle title="Office से दूरी" subtitle="अनुमानित, peak hours" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {OFFICE_HUBS.map((x) => (
          <Chip key={x.key} label={x.name} active={hub === x.key} onPress={() => setHub(x.key)} />
        ))}
      </ScrollView>
      <Row gap={10} style={{ marginTop: 10 }}>
        <Card style={{ flex: 1, padding: 12, borderColor: e.mode === 'car' ? c.brand : c.line }}>
          <Row gap={6}>
            <Car size={16} color={c.muted} />
            <Txt v="caption" color="muted">
              Car / cab
            </Txt>
          </Row>
          <Txt v="h3">{`~${e.carMin} मिनट`}</Txt>
        </Card>
        <Card style={{ flex: 1, padding: 12, borderColor: e.mode === 'metro' ? c.brand : c.line }}>
          <Row gap={6}>
            <TrainFront size={16} color={c.muted} />
            <Txt v="caption" color="muted">
              Metro
            </Txt>
          </Row>
          <Txt v="h3">{e.metroMin != null ? `~${e.metroMin} मिनट` : '—'}</Txt>
        </Card>
      </Row>
    </>
  );
}

/** Hidden while Super Admin has "locality_reviews" switched off. */
export function ReviewsSummary(props: { localitySlug: string; society?: string | null }) {
  return useFlag('locality_reviews') ? <ReviewsSummaryInner {...props} /> : null;
}

/** Approved resident ratings for the society (or locality). */
function ReviewsSummaryInner({ localitySlug, society }: { localitySlug: string; society?: string | null }) {
  const q = useQuery({
    queryKey: ['loc-reviews', localitySlug, society ?? ''],
    queryFn: () => api<any>(`/public/localities/${localitySlug}/reviews${society ? `?society=${encodeURIComponent(society)}` : ''}`, { auth: false }),
  });
  if (!q.data?.count) return null;
  const labels: [string, string][] = [
    ['water', 'पानी'],
    ['power', 'Power'],
    ['safety', 'सुरक्षा'],
    ['parking', 'Parking'],
    ['connectivity', 'Connectivity'],
    ['maintenance', 'Maintenance'],
  ];
  return (
    <>
      <SectionTitle title="रहने वालों की राय" subtitle={`${q.data.count} reviews`} />
      <Row wrap>
        {labels.map(([k, label]) => (
          <Card key={k} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
            <Row gap={4}>
              <Txt v="caption" color="muted">
                {label}
              </Txt>
              <Star size={11} color="#F59E0B" fill="#F59E0B" />
              <Txt v="caption">{String(q.data.avg[k] ?? '—')}</Txt>
            </Row>
          </Card>
        ))}
      </Row>
      {q.data.items.slice(0, 2).map((r: any) => (
        <Card key={r.id} style={{ padding: 12, marginTop: 8, gap: 2 }}>
          {!!r.pros && <Txt v="small">{`👍 ${r.pros}`}</Txt>}
          {!!r.cons && <Txt v="small">{`👎 ${r.cons}`}</Txt>}
        </Card>
      ))}
    </>
  );
}

/** 360° photo viewer (Pannellum inside a WebView). */
export function PanoramaSheet({ url, open, onClose }: { url: string | null; open: boolean; onClose: () => void }) {
  if (!url) return null;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"><script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script><style>html,body,#p{margin:0;height:100%;background:#0f172a}</style></head><body><div id="p"></div><script>pannellum.viewer('p',{type:'equirectangular',panorama:${JSON.stringify(url)},autoLoad:true,orientationOnByDefault:true});</script></body></html>`;
  return (
    <Sheet open={open} onClose={onClose} title="360° view" full>
      <View style={{ height: 420, borderRadius: 16, overflow: 'hidden' }}>
        <WebView source={{ html }} originWhitelist={['*']} javaScriptEnabled />
      </View>
    </Sheet>
  );
}
