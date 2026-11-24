import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasDelegatedAccess, type InventoryFolderDefinition } from '@brokeriq/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { Button, Input, Row, Sheet } from '@/ui';

const endpoint = '/inventory/folder-definitions';

export function useInventoryFolderDefinitions(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inventory-folder-definitions', user?.organization?.id, user?.id],
    queryFn: () => api<InventoryFolderDefinition[]>(endpoint),
    enabled: enabled && !!user?.organization?.id && hasDelegatedAccess(user, 'inventory', 'view'),
  });
}

export function NativeInventoryFolderControls({ onCreated, sectorsOnly = false }: {
  onCreated: (folder: InventoryFolderDefinition) => void;
  sectorsOnly?: boolean;
}) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [kind, setKind] = useState<'SECTOR' | 'CUSTOM' | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user?.organization?.id || !hasDelegatedAccess(user, 'inventory', 'view', 'create')) return null;

  function open(next: 'SECTOR' | 'CUSTOM') {
    setLabel('');
    setKind(next);
  }

  async function save() {
    if (!kind || !label.trim() || busy) return;
    setBusy(true);
    try {
      const folder = await api<InventoryFolderDefinition>(endpoint, { method: 'POST', body: { kind, label } });
      void cache.invalidateQueries({ predicate: ({ queryKey }) => /^(inventory-folder|ledger-sectors)/.test(String(queryKey[0])) });
      onCreated(folder);
      setKind(null);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return (
    <Row gap={6} wrap>
      <Button title="Create sector folder" size="sm" variant="secondary" onPress={() => open('SECTOR')} />
      {!sectorsOnly && <Button title="Create folder" size="sm" variant="secondary" onPress={() => open('CUSTOM')} />}
      <Sheet open={!!kind} onClose={() => { if (!busy) setKind(null); }} title={kind === 'SECTOR' ? 'Create sector folder' : 'Create folder'}
        footer={<Button title="Create" disabled={busy || !label.trim()} onPress={() => void save()} />}>
        <Input label="Folder name" maxLength={100} value={label} onChangeText={setLabel} placeholder={kind === 'SECTOR' ? 'Sector 30' : undefined} />
      </Sheet>
    </Row>
  );
}
