import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FileDown, FileSpreadsheet, IndianRupee, Receipt, Users } from 'lucide-react-native';
import { formatINR } from '@brokeriq/shared';
import { api, post } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';
import { Button, Card, ErrorView, Header, Loader, Row, Screen, Stat, Txt } from '@/ui';

const EXPORTS = [
  { key: 'pdf', format: 'pdf', label: 'PDF (CA के लिए)' },
  { key: 'deals', format: 'csv', type: 'deals', label: 'Deals CSV' },
  { key: 'invoices', format: 'csv', type: 'invoices', label: 'Invoices CSV' },
  { key: 'gst', format: 'csv', type: 'gst', label: 'GST CSV' },
  { key: 'agents', format: 'csv', type: 'agents', label: 'Agents CSV' },
] as const;

/** This financial year's deals, commission and GST at a glance, with CSV (Excel/Tally) and PDF downloads. */
export default function Reports() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['broker-reports'], queryFn: () => api<any>('/broker/reports') });
  const t = q.data?.totals;
  const [busy, setBusy] = useState<string | null>(null);
  // The API hands out a 10-minute signed link; the browser downloads it (no auth header needed).
  const download = async (x: (typeof EXPORTS)[number]) => {
    setBusy(x.key);
    try {
      const r = await post<{ url: string }>('/broker/reports/download-link', {
        format: x.format,
        ...('type' in x ? { type: x.type } : {}),
        ...(q.data ? { from: q.data.from, to: q.data.to } : {}),
      });
      await Linking.openURL(r.url);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  };
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
          <Card style={{ padding: 14, marginTop: 12, gap: 10 }}>
            <Row>
              <FileSpreadsheet size={18} color={c.brand} />
              <Txt v="small" style={{ flex: 1 }}>
                Excel/Tally के लिए CSV और CA के लिए PDF download करें
              </Txt>
            </Row>
            <Row wrap>
              {EXPORTS.map((x) => (
                <Button
                  key={x.key}
                  title={x.label}
                  size="sm"
                  variant="secondary"
                  icon={<FileDown size={15} color={c.fg} />}
                  loading={busy === x.key}
                  disabled={!!busy}
                  onPress={() => download(x)}
                />
              ))}
            </Row>
          </Card>
        </>
      )}
    </Screen>
  );
}
