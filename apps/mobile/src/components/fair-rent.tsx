import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Scale } from 'lucide-react-native';
import { formatINR } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useFlag } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import { Card, Chip, Loader, Row, Txt } from '@/ui';

type Estimate = {
  locality: string;
  zone: string | null;
  bedrooms: number;
  scope: 'LOCALITY' | 'ZONE';
  samples: number;
  enough: boolean;
  median: number;
  p25: number;
  p75: number;
  verdict: 'LOW' | 'FAIR' | 'HIGH' | null;
};
const VERDICT = { LOW: ['आस-पास से सस्ता', '#059669'], FAIR: ['Fair rent', '#4F46E5'], HIGH: ['आस-पास से महँगा', '#D97706'] } as const;
const fetchEstimate = (localityId: string, bedrooms: number, furnishing?: string | null, price?: number | null) =>
  api<Estimate>(
    `/public/fair-rent?localityId=${localityId}&bedrooms=${bedrooms}${furnishing ? `&furnishing=${furnishing}` : ''}${price ? `&price=${price}` : ''}`,
    { auth: false },
  );

function Summary({ e }: { e: Estimate }) {
  return (
    <Txt v="small" color="muted">
      {`${e.scope === 'LOCALITY' ? e.locality : `${e.zone} zone`} · ${e.bedrooms} BHK: आम किराया ${formatINR(e.p25)} – ${formatINR(e.p75)} (median ${formatINR(e.median)}) · ${e.samples} listings, पिछले 12 महीने`}
    </Txt>
  );
}

/** Property screen: "क्या यह rent fair है?" */
export function FairRentCard({
  l,
}: {
  l: { purpose: string; category: string; bedrooms: number | null; price: number; furnishing: string | null; locality: { id: string } };
}) {
  const on = useFlag('fair_rent');
  const enabled = on && l.purpose === 'RENT' && l.category === 'RESIDENTIAL' && !!l.bedrooms && !!l.locality?.id;
  const q = useQuery({
    queryKey: ['fair-rent', l.locality?.id, l.bedrooms, l.furnishing, l.price],
    queryFn: () => fetchEstimate(l.locality.id, l.bedrooms!, l.furnishing, l.price),
    enabled,
    staleTime: 600_000,
  });
  const { c } = useTheme();
  if (!enabled || !q.data?.enough) return null;
  const v = q.data.verdict ? VERDICT[q.data.verdict] : null;
  return (
    <Card style={{ padding: 14, gap: 6 }}>
      <Row>
        <Scale size={18} color={c.brand} />
        <Txt v="bodyStrong" style={{ flex: 1 }}>
          क्या यह rent fair है?
        </Txt>
        {v && (
          <Txt v="bodyStrong" style={{ color: v[1] }}>
            {v[0]}
          </Txt>
        )}
      </Row>
      <Summary e={q.data} />
    </Card>
  );
}

/** Tools → Fair rent: locality + BHK → real rent range. */
export function FairRentTool() {
  const locs = useQuery({ queryKey: ['localities-all'], queryFn: () => api<any[]>('/public/localities', { auth: false }), staleTime: 600_000 });
  const [loc, setLoc] = useState<string | null>(null);
  const [bhk, setBhk] = useState(2);
  const q = useQuery({ queryKey: ['fair-rent-tool', loc, bhk], queryFn: () => fetchEstimate(loc!, bhk), enabled: !!loc });
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ padding: 16, gap: 10 }}>
        <Txt v="caption" color="muted">
          Sector / locality
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(locs.data ?? []).slice(0, 80).map((x) => (
            <Chip key={x.id} label={x.name} active={loc === x.id} onPress={() => setLoc(x.id)} />
          ))}
        </ScrollView>
        <Row wrap>
          {[1, 2, 3, 4, 5].map((b) => (
            <Chip key={b} label={`${b} BHK`} active={bhk === b} onPress={() => setBhk(b)} />
          ))}
        </Row>
      </Card>
      {!loc ? (
        <Txt v="small" color="muted">
          Locality चुनें — BrokerIQ की असली listings से आम किराया दिखेगा।
        </Txt>
      ) : q.isLoading ? (
        <Loader />
      ) : !q.data?.enough ? (
        <Card style={{ padding: 16 }}>
          <Txt v="small">{`इस locality + BHK के लिए अभी data कम है (${q.data?.samples ?? 0} listings)।`}</Txt>
        </Card>
      ) : (
        <Card style={{ padding: 16, gap: 6 }}>
          <Txt v="caption" color="muted">
            Median rent
          </Txt>
          <Txt v="h1" color="brand">
            {formatINR(q.data.median)}
          </Txt>
          <Summary e={q.data} />
        </Card>
      )}
    </View>
  );
}
