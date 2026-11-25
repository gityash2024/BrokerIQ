import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { inventoryBulkActions, type InventoryBulkAction, type InventoryBulkPreview } from '@brokeriq/shared';
import { api, captureAccountContext, errorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button, Row, Sheet, Txt } from '@/ui';
import { ChoiceField } from '@/launch/form';

export function NativeInventoryBulkActions({ selected, pageIds, filters, count, onSelect }: {
  selected: string[]; pageIds: string[]; filters: Record<string, unknown>; count: number; onSelect: (ids: string[]) => void;
}) {
  const cache = useQueryClient();
  const [all, setAll] = useState(false);
  const [action, setAction] = useState<InventoryBulkAction | null>(null);
  const [preview, setPreview] = useState<InventoryBulkPreview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const loaded = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const total = all ? count : selected.length;

  async function update(apply: boolean) {
    if (!action || busy || !total) return;
    const ownerContext = captureAccountContext();
    setBusy(true);
    try {
      if (apply && preview) {
        const result = await api<{ count: number; skipped: number }>('/inventory/bulk/apply', {
          method: 'PATCH', body: { action, rows: preview.rows, confirmWithdrawal: confirm }, ownerContext,
        });
        toast.success(result.count + ' updated · ' + (result.skipped + preview.skipped) + ' skipped');
        setPreview(null); setAll(false); onSelect([]);
        await Promise.all(['ledger', 'ledger-stats', 'ledger-item', 'inventory-folders', 'inventory-folder-items',
          'broker-today', 'agent-assignments', 'agent-assignment-records'].map((key) => cache.invalidateQueries({ queryKey: [key] })));
      } else {
        const selection = all ? { mode: 'filtered', filters: Object.fromEntries(Object.entries(filters).filter(([, value]) =>
          value !== '' && value !== undefined && value !== null)) } : { mode: 'ids', ids: selected };
        setPreview(await api<InventoryBulkPreview>('/inventory/bulk/preview', { method: 'POST', body: { action, selection }, ownerContext }));
        setConfirm(false);
      }
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return <>
    <Row wrap gap={6}>
      <Button size="sm" variant="secondary" title={loaded ? 'Clear loaded' : 'Select loaded'}
        disabled={busy || all || !pageIds.length} onPress={() => onSelect(loaded ? selected.filter((id) => !pageIds.includes(id)) : [...new Set([...selected, ...pageIds])])} />
      <Button size="sm" variant="secondary" title={all ? 'Clear filtered selection' : 'Select all filtered'}
        disabled={busy || !count} onPress={() => { setAll(!all); onSelect([]); }} />
      <Txt v="caption">{total} selected</Txt>
    </Row>
    {total > 0 && <>
      <ChoiceField label="Bulk inventory action" value={action} choices={Object.keys(inventoryBulkActions)}
        labels={inventoryBulkActions} emptyLabel="Choose an action" onChange={(value) => setAction(value as InventoryBulkAction | null)} />
      <Button size="sm" title="Preview" disabled={!action || busy} onPress={() => void update(false)} />
    </>}
    {preview && <Sheet open title={action ? inventoryBulkActions[action] : 'Bulk update'} onClose={() => { if (!busy) setPreview(null); }}
      footer={<Button title={'Apply to ' + preview.rows.length + ' properties'} disabled={busy || !preview.rows.length || (preview.withdrawals > 0 && !confirm)}
        onPress={() => void update(true)} />}>
      <Txt>{preview.rows.length} eligible · {preview.skipped} will be skipped</Txt>
      <Txt color="muted">Records may be skipped if they need more details, need publication permission, or have changed since the preview.</Txt>
      {preview.withdrawals > 0 && <Button size="sm" variant={confirm ? 'primary' : 'secondary'}
        title={confirm ? 'Withdrawal confirmed' : 'Confirm withdrawal of ' + preview.withdrawals + ' linked listings'}
        onPress={() => setConfirm(!confirm)} />}
    </Sheet>}
  </>;
}
