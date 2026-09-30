import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, IndianRupee, Receipt, Users } from 'lucide-react-native';
import { formatINR } from '@brokeriq/shared';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { Card, ErrorView, Header, Loader, Row, Screen, Stat, Txt } from '@/ui';

/** This financial year's deals, commission and GST at a glance (CSV/PDF export is on the website). */
export default function Reports() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['broker-reports'], queryFn: () => api<any>('/broker/reports') });
  const t = q.data?.totals;
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Reports & GST" subtitle={q.data ? `${q.data.from} → ${q.data.to}` : 'इस financial year का हिसाब'} />
      {q.isError ? (
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      ) : !t ? (
        <Loader />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <View style={{ width: '48%' }}>
              <Stat label="Deals" value={t.deals} icon={<Users size={18} color={c.brand} />} />
            </View>
            <View style={{ width: '48%' }}>
              <Stat label="Commission" value={formatINR(t.commission)} icon={<IndianRupee size={18} color={c.success} />} />
            </View>
            <View style={{ width: '48%' }}>
              <Stat label="Pending" value={formatINR(t.pending)} icon={<IndianRupee size={18} color={c.warning} />} tint={c.warning} />
            </View>
            <View style={{ width: '48%' }}>
              <Stat label="GST" value={formatINR(t.gst)} icon={<Receipt size={18} color={c.info} />} />
            </View>
          </View>
          <Card style={{ marginTop: 12 }}>
            {q.data.months.length ? (
              q.data.months.map((m: any, i: number) => (
                <View key={m.month} style={{ padding: 14, borderTopWidth: i ? 1 : 0, borderColor: c.line, gap: 2 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="bodyStrong">{new Date(`${m.month}-01`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</Txt>
                    <Txt v="bodyStrong">{formatINR(m.commission)}</Txt>
                  </Row>
                  <Txt
                    v="caption"
                    color="muted"
                  >{`${m.deals} deals · मिला ${formatINR(m.received)} · invoiced ${formatINR(m.invoiced)} · GST ${formatINR(m.gst)}`}</Txt>
                </View>
              ))
            ) : (
              <Txt v="small" color="muted" style={{ padding: 16 }}>
                अभी कोई closed deal या invoice नहीं।
              </Txt>
            )}
          </Card>
          <Card style={{ padding: 14, marginTop: 12 }}>
            <Row>
              <FileSpreadsheet size={18} color={c.brand} />
              <Txt v="small" style={{ flex: 1 }}>
                Excel/Tally CSV और CA के लिए PDF: website पर Broker → Reports & GST।
              </Txt>
            </Row>
          </Card>
        </>
      )}
    </Screen>
  );
}
