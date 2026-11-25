'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { inventoryBulkActions, type InventoryBulkAction, type InventoryBulkPreview } from '@brokeriq/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { api, assertAccountContext, captureAccountContext, errorMessage } from '@/lib/api';
import { qs } from '@/lib/utils';

export function InventoryBulkActions({ selected, pageIds, filters, count, onSelect }: {
  selected: string[]; pageIds: string[]; filters: Record<string, unknown>; count: number; onSelect: (ids: string[]) => void;
}) {
  const [all, setAll] = useState(false);
  const [action, setAction] = useState<InventoryBulkAction | ''>('');
  const [preview, setPreview] = useState<InventoryBulkPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const cache = useQueryClient();
  const entirePage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const total = all ? count : selected.length;

  async function update(apply: boolean) {
    if (!action || busy || !total) return;
    const account = captureAccountContext();
    setBusy(true);
    try {
      if (apply && preview) {
        const result = await api<{ count: number; skipped: number }>('/inventory/bulk/apply', {
          method: 'PATCH', body: { action, rows: preview.rows, confirmWithdrawal: confirm },
        });
        assertAccountContext(account);
        toast.success(result.count + ' updated · ' + (result.skipped + preview.skipped) + ' skipped');
        setPreview(null); setAll(false); onSelect([]);
        await Promise.all(['ledger', 'ledger-stats', 'ledger-sectors', 'ledger-item', 'inventory-folders',
          'inventory-folder-items', 'broker-today', 'agent-assignments', 'agent-assignment-records'].map((key) => cache.invalidateQueries({ queryKey: [key] })));
      } else {
        const selection = all ? { mode: 'filtered', filters: Object.fromEntries(new URLSearchParams(qs(filters))) } : { mode: 'ids', ids: selected };
        const result = await api<InventoryBulkPreview>('/inventory/bulk/preview', { method: 'POST', body: { action, selection } });
        assertAccountContext(account);
        setConfirm(false);
        setPreview(result);
      }
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }

  if (!count && !selected.length) return null;
  return <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
    <Button size="sm" variant="secondary" disabled={busy || all || !pageIds.length} onClick={() => onSelect(entirePage
      ? selected.filter((id) => !pageIds.includes(id)) : [...new Set([...selected, ...pageIds])])}>
      {entirePage ? 'Clear this page' : 'Select this page'}
    </Button>
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setAll(!all); onSelect([]); }}>
      {all ? 'Clear filtered selection' : 'Select all filtered'}
    </Button>
    <span>{total} selected</span>
    <select value={action} aria-label="Bulk inventory action" className="rounded-lg border border-line bg-surface px-2 py-1.5"
      disabled={busy || !!preview} onChange={(event) => setAction(event.target.value as InventoryBulkAction | '')}>
      <option value="">Choose an action</option>
      {Object.entries(inventoryBulkActions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
    <Button size="sm" disabled={busy || !total || !action} onClick={() => void update(false)}>Preview</Button>
    {preview && <Dialog open onOpenChange={(open) => { if (!open && !busy) setPreview(null); }} title={action ? inventoryBulkActions[action] : 'Bulk update'}
      footer={<Button disabled={busy || !preview.rows.length || (preview.withdrawals > 0 && !confirm)}
        onClick={() => void update(true)}>Apply to {preview.rows.length} properties</Button>}>
      <p>{preview.rows.length} eligible · {preview.skipped} will be skipped</p>
      <p className="mt-2 text-sm text-muted">Records may be skipped if they need more details, need publication permission, or have changed since the preview.</p>
      {preview.withdrawals > 0 && <label className="mt-3 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
        I confirm withdrawal of {preview.withdrawals} linked marketplace listings.
      </label>}
    </Dialog>}
  </div>;
}
