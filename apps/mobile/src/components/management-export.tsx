import { useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api, authStore, qs } from '@/lib/api';
import { showError } from '@/lib/hooks';
import { Button, Row, Txt } from '@/ui';

/** Explicit OS share sheet; credentials stay in headers and no public download token is minted. */
export function ManagementExport({ endpoint, ids, label = 'Filtered' }: { endpoint: string; ids: string[]; label?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const tooMany = ids.length > 500;
  const download = async (format: string) => {
    if (busy || !ids.length || tooMany) return;
    const user = authStore.get()?.user;
    const scope = () => {
      const current = authStore.get()?.user;
      return `${current?.id}:${current?.role}:${current?.organization?.id}`;
    };
    const owner = scope();
    let file: File | undefined;
    setBusy(format);
    try {
      if (!user || !(await Sharing.isAvailableAsync())) throw new Error('इस device पर file sharing उपलब्ध नहीं है');
      const bytes = await api<Uint8Array>(`${endpoint}${qs({ format, ids: ids.join(',') })}`, { responseType: 'bytes' });
      if (scope() !== owner) throw new Error('Account permissions changed. Reopen this screen.');
      file = new File(Paths.cache, `brokeriq-report-${Date.now()}.${format}`);
      file.create();
      file.write(bytes);
      await Sharing.shareAsync(file.uri, {
        mimeType: format === 'pdf' ? 'application/pdf' : format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
        dialogTitle: `${label} report`,
      });
    } catch (error) {
      showError(error);
    } finally {
      if (file?.exists) file.delete();
      setBusy(null);
    }
  };
  return (
    <>
      <Txt v="caption" color="muted">
        {label}: {ids.length} records{tooMany ? ' · एक बार में 500 तक चुनें' : ''}
      </Txt>
      <Row gap={8}>
        {['csv', 'xlsx', 'pdf'].map((format) => (
          <Button
            key={format}
            title={format.toUpperCase()}
            variant="secondary"
            size="sm"
            loading={busy === format}
            disabled={!!busy || !ids.length || tooMany}
            onPress={() => download(format)}
          />
        ))}
      </Row>
    </>
  );
}
