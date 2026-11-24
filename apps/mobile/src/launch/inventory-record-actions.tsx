import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { hasDelegatedAccess, type LedgerItem } from '@brokeriq/shared';
import { api, captureAccountContext, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { Button, Row } from '@/ui';

export function NativeInventoryRecordActions({ item, edit = true, onArchived }: { item: LedgerItem; edit?: boolean; onArchived?: () => void }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!user || !['BROKER_ADMIN', 'SUB_BROKER_ADMIN'].includes(user.role) || item.deletedAt || item.canEdit === false) return null;
  const canDelete = hasDelegatedAccess(user, 'inventory', 'view', 'delete');
  const canEdit = edit && hasDelegatedAccess(user, 'inventory', 'view', 'edit');

  function confirmArchive() {
    const ownerContext = captureAccountContext();
    Alert.alert('Archive property?', 'Any public listing will be withdrawn.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api(`/inventory/${encodeURIComponent(item.id)}`, { method: 'DELETE', ownerContext });
            onArchived?.();
            await cache.invalidateQueries({ predicate: ({ queryKey }) => /^(inventory-folder|ledger|broker-today|agent-assignment)/.test(String(queryKey[0])) });
            toast.success('Property archived');
          } catch (error) {
            toast.error(errorMessage(error));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (!canDelete && !canEdit) return null;
  return (
    <Row gap={6} wrap>
      {canEdit && <Button title="Edit" size="sm" variant="ghost" onPress={() => router.push({ pathname: '/inventory-edit', params: { id: item.id } })} />}
      {canDelete && <Button title="Archive" size="sm" variant="ghost" disabled={busy} onPress={confirmArchive} />}
    </Row>
  );
}
