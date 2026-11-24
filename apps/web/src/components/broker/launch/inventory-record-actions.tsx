'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { hasDelegatedAccess, type LedgerItem } from '@brokeriq/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function InventoryRecordActions({ item }: { item: LedgerItem }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!user || !['BROKER_ADMIN', 'SUB_BROKER_ADMIN'].includes(user.role) || item.deletedAt || item.canEdit === false) return null;
  const canDelete = hasDelegatedAccess(user, 'inventory', 'view', 'delete');
  const canEdit = hasDelegatedAccess(user, 'inventory', 'view', 'edit');
  const id = encodeURIComponent(item.id);

  async function archive() {
    if (busy || !window.confirm('Archive this private property? Any public listing will be withdrawn.')) return;
    setBusy(true);
    try {
      await api(`/inventory/${id}`, { method: 'DELETE' });
      await cache.invalidateQueries({ predicate: ({ queryKey }) => /^(inventory-folder|ledger|broker-today|agent-assignment)/.test(String(queryKey[0])) });
      toast.success('Property archived');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!canDelete && !canEdit) return null;
  return (
    <span className="inline-flex gap-1">
      {canEdit && <Button size="sm" variant="ghost" href={`/broker/inventory/${id}/edit`}>Edit</Button>}
      {canDelete && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void archive()}>Archive</Button>}
    </span>
  );
}
